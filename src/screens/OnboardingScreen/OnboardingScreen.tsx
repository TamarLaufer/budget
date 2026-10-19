import { useCallback, useEffect, useState } from "react";
import { Switch } from "react-native";

import { messageFromUnknown, errorMessage } from "../../api/errorMessage";
import { refreshEmailVerification, resendVerificationEmail, signOut } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorBanner, InfoBanner } from "../../components/ui/Feedback";
import { BodyText, Card, MutedText, Row, ScrollScreen, SectionTitle, SpaceBetweenRow, Title } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  acceptInvitation,
  createHousehold,
  declineInvitation,
  fetchReceivedInvitations,
} from "../../store/slices/householdSlice";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";

/** Shown to signed-in users without a household: create one, or accept an invitation. */
export default function OnboardingScreen() {
  return (
    <ScrollScreen withTopInset>
      <Title>{strings.ONBOARDING_TITLE}</Title>
      <MutedText style={{ textAlign: "center" }}>{strings.ONBOARDING_SUBTITLE}</MutedText>
      <InvitationsCard />
      <CreateHouseholdCard />
      <Button label={strings.SIGN_OUT} variant="link" onPress={() => void signOut()} />
    </ScrollScreen>
  );
}

function CreateHouseholdCard() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [withDefaults, setWithDefaults] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(createHousehold({ name: name.trim(), withDefaultCategories: withDefaults })).unwrap();
    } catch (e) {
      setError(messageFromUnknown(e));
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>{strings.CREATE_HOUSEHOLD}</SectionTitle>
      <TextField label={strings.HOUSEHOLD_NAME} value={name} onChangeText={setName} maxLength={60} />
      <SpaceBetweenRow>
        <BodyText>{strings.WITH_DEFAULT_CATEGORIES}</BodyText>
        <Switch value={withDefaults} onValueChange={setWithDefaults} />
      </SpaceBetweenRow>
      <ErrorBanner message={error} />
      <Button label={strings.CREATE_HOUSEHOLD} onPress={submit} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}

function InvitationsCard() {
  const dispatch = useAppDispatch();
  const firebaseUser = useAppSelector((s) => s.auth.firebaseUser);
  const { received, receivedLoad } = useAppSelector((s) => s.household);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const verified = firebaseUser?.emailVerified ?? false;

  const load = useCallback(() => {
    if (verified) void dispatch(fetchReceivedInvitations());
  }, [dispatch, verified]);

  useEffect(load, [load]);

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    setActionError(null);
    try {
      if (accept) {
          await dispatch(acceptInvitation(id)).unwrap();
      } else {
        await dispatch(declineInvitation(id)).unwrap();
        setBusyId(null);
      }
    } catch (e) {
      setActionError(messageFromUnknown(e));
      setBusyId(null);
      load();
    }
  };

  const checkVerified = async () => {
    setNotice(null);
    try {
      const nowVerified = await refreshEmailVerification();
      if (!nowVerified) setNotice(strings.STILL_NOT_VERIFIED);
    } catch (e) {
      setNotice(messageFromUnknown(e));
    }
  };

  const resend = async () => {
    try {
      await resendVerificationEmail();
      setNotice(strings.VERIFICATION_SENT);
    } catch (e) {
      setNotice(messageFromUnknown(e));
    }
  };

  if (!verified) {
    return (
      <Card>
        <SectionTitle>{strings.VERIFY_EMAIL_TITLE}</SectionTitle>
        <BodyText>{format(strings.VERIFY_EMAIL_BODY, { email: firebaseUser?.email ?? "" })}</BodyText>
        <InfoBanner message={notice} />
        <Row>
          <Button label={strings.I_VERIFIED} onPress={checkVerified} compact />
          <Button label={strings.RESEND_VERIFICATION} variant="secondary" onPress={resend} compact />
        </Row>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>{strings.PENDING_INVITATIONS}</SectionTitle>
      <ErrorBanner
        message={receivedLoad.status === "failed" ? errorMessage(receivedLoad.error) : actionError}
        onRetry={receivedLoad.status === "failed" ? load : undefined}
      />
      {receivedLoad.status === "loading" && !receivedLoad.loaded ? <MutedText>{strings.LOADING}</MutedText> : null}
      {receivedLoad.loaded && received.length === 0 ? <EmptyState title={strings.NO_INVITATIONS} /> : null}
      {received.map((invitation) => (
        <Card key={invitation.id}>
          <BodyText>
            {format(strings.INVITED_BY, {
              name: invitation.invitedBy.displayName ?? invitation.invitedBy.email,
              household: invitation.householdName,
            })}
          </BodyText>
          <Row>
            <Button
              label={strings.ACCEPT}
              onPress={() => respond(invitation.id, true)}
              loading={busyId === invitation.id}
              disabled={busyId !== null}
              compact
            />
            <Button
              label={strings.DECLINE}
              variant="secondary"
              onPress={() => respond(invitation.id, false)}
              disabled={busyId !== null}
              compact
            />
          </Row>
        </Card>
      ))}
    </Card>
  );
}
