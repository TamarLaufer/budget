import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch } from "react-native";

import type { InvitableRole, MemberDto } from "../../../shared/api";
import { errorMessage, messageFromUnknown } from "../../api/errorMessage";
import { signOut } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { ErrorBanner, InfoBanner } from "../../components/ui/Feedback";
import { BodyText, Card, MutedText, Row, ScrollScreen, SectionTitle, SpaceBetweenRow, Title } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useScreenData } from "../../hooks/useScreenData";
import { isPushSupported, registerDevice, requestPermission } from "../../notifications/pushNotifications";
import { useAppDispatch, useAppSelector } from "../../store";
import { paymentMethodSelectors, selectCanManage, type Dataset } from "../../store/selectors";
import { householdChanged } from "../../store/shared";
import { updateBudgetAlerts, updateDisplayName } from "../../store/slices/authSlice";
import { createPaymentMethod, updatePaymentMethod } from "../../store/slices/catalogSlices";
import {
  fetchInvitations,
  fetchMembers,
  leaveHousehold,
  removeMember,
  renameHousehold,
  revokeInvitation,
  sendInvitation,
  updateMemberRole,
} from "../../store/slices/householdSlice";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import { colors } from "../../theme";

/** Runs an async action and exposes busy/error state for the button that triggered it. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(messageFromUnknown(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function confirm(title: string, onConfirm: () => void) {
  Alert.alert(title, undefined, [
    { text: strings.CANCEL, style: "cancel" },
    { text: strings.CONFIRM, style: "destructive", onPress: onConfirm },
  ]);
}

export default function SettingsScreen() {
  const canManage = useAppSelector(selectCanManage);
  return (
    <ScrollScreen withTopInset>
      <Title>{strings.TAB_SETTINGS}</Title>
      <ProfileSection />
      {isPushSupported ? <BudgetAlertsSection /> : null}
      <HouseholdSection canManage={canManage} />
      <MembersSection />
      {canManage ? <InvitationsSection /> : null}
      <PaymentMethodsSection canManage={canManage} />
      {__DEV__ ? <Button label={strings.ANIMATION_PRACTICE} variant="link" onPress={() => router.push("/practice")} /> : null}
      <Button label={strings.SIGN_OUT} variant="danger" onPress={() => void signOut()} />
    </ScrollScreen>
  );
}

function ProfileSection() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.me?.user);
  const [name, setName] = useState(user?.displayName ?? "");
  const { busy, error, run } = useAction();

  return (
    <Card>
      <SectionTitle>{strings.PROFILE}</SectionTitle>
      <MutedText>{user?.email}</MutedText>
      <TextField label={strings.DISPLAY_NAME} value={name} onChangeText={setName} maxLength={60} />
      <ErrorBanner message={error} />
      <Button
        label={strings.SAVE}
        compact
        loading={busy}
        disabled={name.trim() === (user?.displayName ?? "")}
        onPress={() => void run(() => dispatch(updateDisplayName(name.trim() || null)).unwrap())}
      />
    </Card>
  );
}

/**
 * Opt-in for budget threshold notifications. The server stores and enforces the preference, so
 * turning it off stops alerts even while the app is closed.
 */
function BudgetAlertsSection() {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector((s) => s.auth.me?.notifications.budgetAlertsEnabled ?? false);
  const userId = useAppSelector((s) => s.auth.me?.user.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  const toggle = (value: boolean) =>
    void run(async () => {
      setNotice(null);
      if (value) {
        if (!(await requestPermission())) {
          setNotice(strings.BUDGET_ALERTS_PERMISSION_DENIED);
          return;
        }
        try {
          if (!userId) throw new Error("No profile");
          await registerDevice(userId);
        } catch {
          setNotice(strings.BUDGET_ALERTS_UNAVAILABLE);
          return;
        }
      }
      await dispatch(updateBudgetAlerts(value)).unwrap();
    });

  return (
    <Card>
      <SpaceBetweenRow>
        <SectionTitle>{strings.BUDGET_ALERTS}</SectionTitle>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={busy}
          trackColor={{ false: colors.track, true: colors.primary }}
          thumbColor={colors.surface}
          accessibilityLabel={strings.BUDGET_ALERTS}
          testID="budget-alerts-switch"
        />
      </SpaceBetweenRow>
      <MutedText>{strings.BUDGET_ALERTS_HINT}</MutedText>
      <InfoBanner message={notice} />
      <ErrorBanner message={error} />
    </Card>
  );
}

function HouseholdSection({ canManage }: { canManage: boolean }) {
  const dispatch = useAppDispatch();
  const membership = useAppSelector((s) => s.auth.me?.membership);
  const [name, setName] = useState(membership?.household.name ?? "");
  const { busy, error, run } = useAction();
  if (!membership) return null;

  return (
    <Card>
      <SectionTitle>{strings.HOUSEHOLD}</SectionTitle>
      <MutedText>{strings.ROLES[membership.role]}</MutedText>
      {canManage ? (
        <>
          <TextField label={strings.HOUSEHOLD_NAME} value={name} onChangeText={setName} maxLength={60} />
          <ErrorBanner message={error} />
          <Button
            label={strings.SAVE}
            compact
            loading={busy}
            disabled={!name.trim() || name.trim() === membership.household.name}
            onPress={() => void run(() => dispatch(renameHousehold(name.trim())).unwrap())}
          />
        </>
      ) : (
        <BodyText>{membership.household.name}</BodyText>
      )}
    </Card>
  );
}

function MembersSection() {
  const dispatch = useAppDispatch();
  const { members, membersLoad } = useAppSelector((s) => s.household);
  const me = useAppSelector((s) => s.auth.me);
  const myRole = me?.membership?.role;

  useEffect(() => {
    void dispatch(fetchMembers());
  }, [dispatch]);

  return (
    <Card>
      <SectionTitle>{strings.MEMBERS}</SectionTitle>
      <ErrorBanner
        message={membersLoad.status === "failed" ? errorMessage(membersLoad.error) : null}
        onRetry={() => void dispatch(fetchMembers())}
      />
      {members.map((member) => (
        <MemberItem key={member.id} member={member} isMe={member.user.id === me?.user.id} myRole={myRole} />
      ))}
    </Card>
  );
}

function MemberItem({ member, isMe, myRole }: { member: MemberDto; isMe: boolean; myRole: string | undefined }) {
  const dispatch = useAppDispatch();
  const { busy, error, run } = useAction();
  const name = member.user.displayName ?? member.user.email;
  const ownerManagesOther = myRole === "OWNER" && !isMe && member.role !== "OWNER";
  const canLeave = isMe && member.role !== "OWNER";

  const leave = () =>
    confirm(strings.LEAVE_HOUSEHOLD_CONFIRM, () =>
      void run(async () => {
        await dispatch(leaveHousehold(member.id)).unwrap();
        // Drop the old household's cached data; the guards then show onboarding.
        dispatch(householdChanged());
      }),
    );

  return (
    <Card>
      <SpaceBetweenRow>
        <BodyText>
          {name} {isMe ? strings.YOU : ""}
        </BodyText>
        <MutedText>{strings.ROLES[member.role]}</MutedText>
      </SpaceBetweenRow>
      <ErrorBanner message={error} />
      {ownerManagesOther ? (
        <Row>
          <Button
            compact
            variant="secondary"
            loading={busy}
            label={member.role === "ADMIN" ? strings.MAKE_MEMBER : strings.MAKE_ADMIN}
            onPress={() =>
              void run(() =>
                dispatch(updateMemberRole({ memberId: member.id, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" })).unwrap(),
              )
            }
          />
          <Button
            compact
            variant="danger"
            label={strings.REMOVE_MEMBER}
            onPress={() =>
              confirm(format(strings.REMOVE_MEMBER_CONFIRM, { name }), () => void run(() => dispatch(removeMember(member.id)).unwrap()))
            }
          />
        </Row>
      ) : null}
      {canLeave ? <Button compact variant="danger" label={strings.LEAVE_HOUSEHOLD} loading={busy} onPress={leave} /> : null}
    </Card>
  );
}

function InvitationsSection() {
  const dispatch = useAppDispatch();
  const { invitations, invitationsLoad } = useAppSelector((state) => state.household);
  const isOwner = useAppSelector((s) => s.auth.me?.membership?.role === "OWNER");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("MEMBER");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    void dispatch(fetchInvitations());
  }, [dispatch]);

  const send = async () => {
    setSent(false);
    const ok = await run(() => dispatch(sendInvitation({ email: email.trim(), role })).unwrap());
    if (ok) {
      setEmail("");
      setSent(true);
    }
  };

  const roleOptions = [
    { value: "MEMBER" as const, label: strings.ROLES.MEMBER ?? "" },
    ...(isOwner ? [{ value: "ADMIN" as const, label: strings.ROLES.ADMIN ?? "" }] : []),
  ];

  return (
    <Card>
      <SectionTitle>{strings.INVITE_MEMBER}</SectionTitle>
      <TextField
        label={strings.INVITE_EMAIL}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <ChipGroup options={roleOptions} selected={role} onSelect={setRole} />
      <ErrorBanner message={error} />
      <InfoBanner message={sent ? strings.INVITATION_SENT : null} />
      <Button label={strings.SEND_INVITATION} onPress={() => void send()} loading={busy} disabled={!email.trim()} />

      <SectionTitle>{strings.SENT_INVITATIONS}</SectionTitle>
      <ErrorBanner
        message={invitationsLoad.status === "failed" ? errorMessage(invitationsLoad.error) : null}
        onRetry={() => void dispatch(fetchInvitations())}
      />
      {invitations.map((invitation) => (
        <SpaceBetweenRow key={invitation.id}>
          <MutedText style={{ flex: 1 }}>
            {invitation.email} · {strings.INVITATION_STATUS[invitation.status]}
          </MutedText>
          {invitation.status === "PENDING" ? (
            <Button compact variant="secondary" label={strings.REVOKE} onPress={() => void dispatch(revokeInvitation(invitation.id))} />
          ) : null}
        </SpaceBetweenRow>
      ))}
    </Card>
  );
}

const PAYMENT_METHODS: readonly Dataset[] = ["paymentMethods"];

function PaymentMethodsSection({ canManage }: { canManage: boolean }) {
  const dispatch = useAppDispatch();
  const methods = useAppSelector(paymentMethodSelectors.selectAll);
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  useScreenData(PAYMENT_METHODS);

  return (
    <Card>
      <SectionTitle>{strings.PAYMENT_METHODS}</SectionTitle>
      {methods.map((method) => (
        <SpaceBetweenRow key={method.id}>
          <BodyText>
            {method.name} {method.isActive ? "" : `(${strings.INACTIVE})`}
          </BodyText>
          {canManage ? (
            <Button
              compact
              variant="secondary"
              label={method.isActive ? strings.DEACTIVATE : strings.ACTIVATE}
              onPress={() => void run(() => dispatch(updatePaymentMethod({ id: method.id, changes: { isActive: !method.isActive } })).unwrap())}
            />
          ) : null}
        </SpaceBetweenRow>
      ))}
      {canManage ? (
        <>
          <TextField label={strings.NEW_PAYMENT_METHOD} value={name} onChangeText={setName} maxLength={60} />
          <ErrorBanner message={error} />
          <Button
            label={strings.ADD}
            compact
            loading={busy}
            disabled={!name.trim()}
            onPress={() =>
              void run(async () => {
                await dispatch(createPaymentMethod(name.trim())).unwrap();
                setName("");
              })
            }
          />
        </>
      ) : (
        <InfoBanner message={strings.MANAGERS_ONLY} />
      )}
    </Card>
  );
}
