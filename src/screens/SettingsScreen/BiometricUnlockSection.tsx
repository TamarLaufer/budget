import { useEffect, useState } from "react";
import { Switch } from "react-native";

import { getBiometricAvailability, verifyBiometric, type BiometricAvailability, type BiometricOutcome } from "../../appLock/biometrics";
import { ErrorBanner, InfoBanner } from "../../components/ui/Feedback";
import { Card, MutedText, SectionTitle, SpaceBetweenRow } from "../../components/ui/Layout";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectLockEnabled } from "../../store/selectors";
import { setLockPreference } from "../../store/slices/appLockSlice";
import { strings } from "../../strings/he";
import { colors } from "../../theme";

const ENABLE_FAILURES: Record<Exclude<BiometricOutcome, "success">, string> = {
  cancelled: strings.BIOMETRIC_ENABLE_CANCELLED,
  failed: strings.BIOMETRIC_ENABLE_FAILED,
  lockout: strings.BIOMETRIC_ENABLE_LOCKOUT,
  unavailable: strings.BIOMETRIC_NOT_ENROLLED,
};

const UNAVAILABLE: Partial<Record<BiometricAvailability, string>> = {
  noHardware: strings.BIOMETRIC_NO_HARDWARE,
  notEnrolled: strings.BIOMETRIC_NOT_ENROLLED,
};

/**
 * Opt-in fingerprint unlock for this user on this device. Turning it on requires a successful
 * fingerprint first; turning it off needs nothing more, as the app is already unlocked.
 */
export function BiometricUnlockSection() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.appLock.uid);
  const enabled = useAppSelector(selectLockEnabled);
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBiometricAvailability().then((result) => {
      if (active) setAvailability(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (value: boolean) => {
    if (!uid) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (value) {
        const outcome = await verifyBiometric(strings.BIOMETRIC_UNLOCK_ENABLE_PROMPT, strings.CANCEL);
        if (outcome !== "success") {
          setNotice(ENABLE_FAILURES[outcome]);
          return;
        }
      }
      await dispatch(setLockPreference({ uid, enabled: value })).unwrap();
    } catch {
      setError(strings.BIOMETRIC_SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // Turning it off stays possible even if the fingerprints were removed since.
  const canEnable = availability === "available";
  return (
    <Card>
      <SpaceBetweenRow>
        <SectionTitle>{strings.BIOMETRIC_UNLOCK}</SectionTitle>
        <Switch
          value={enabled}
          onValueChange={(value) => void toggle(value)}
          disabled={busy || (!enabled && !canEnable)}
          trackColor={{ false: colors.track, true: colors.primary }}
          thumbColor={colors.surface}
          accessibilityLabel={strings.BIOMETRIC_UNLOCK}
          testID="biometric-unlock-switch"
        />
      </SpaceBetweenRow>
      <MutedText>{strings.BIOMETRIC_UNLOCK_HINT}</MutedText>
      <InfoBanner message={notice ?? (availability ? (UNAVAILABLE[availability] ?? null) : null)} />
      <ErrorBanner message={error} />
    </Card>
  );
}
