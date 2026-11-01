import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler } from "react-native";

import { cancelBiometricPrompt, verifyBiometric, type BiometricOutcome } from "../../appLock/biometrics";
import { canReauthenticateWithPassword, reauthenticateWithPassword, signOut } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { ErrorBanner, InfoBanner } from "../../components/ui/Feedback";
import { MutedText } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch, useAppSelector } from "../../store";
import { appUnlocked } from "../../store/slices/appLockSlice";
import { strings } from "../../strings/he";
import AuthLayout from "../auth/AuthScreensLayout";
import { authMessage } from "../auth/authMessage";

const OUTCOME_MESSAGES: Record<Exclude<BiometricOutcome, "success">, string> = {
  cancelled: strings.APP_LOCK_CANCELLED,
  failed: strings.APP_LOCK_FAILED,
  lockout: strings.APP_LOCK_LOCKOUT,
  unavailable: strings.APP_LOCK_UNAVAILABLE,
};

/** After these the fingerprint is not offered again automatically; the button still retries. */
const NO_AUTO_PROMPT: readonly BiometricOutcome[] = ["lockout", "unavailable"];

/**
 * Shown instead of (or over) the app while it is locked. Ways forward, none of which bypasses
 * authentication: the fingerprint, the account's Firebase password, or signing out.
 */
export function LockScreen() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.appLock.uid);
  const email = useAppSelector((s) => s.auth.firebaseUser?.email ?? null);
  const [outcome, setOutcome] = useState<BiometricOutcome | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [passwordSupported] = useState(canReauthenticateWithPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const promptingRef = useRef(false);

  const unlockWithFingerprint = useCallback(async () => {
    if (!uid || promptingRef.current) return;
    promptingRef.current = true;
    setPrompting(true);
    const result = await verifyBiometric(strings.APP_LOCK_PROMPT, strings.CANCEL);
    promptingRef.current = false;
    setPrompting(false);
    // The uid makes a late success for a previous account a no-op.
    if (result === "success") dispatch(appUnlocked({ uid }));
    else setOutcome(result);
  }, [uid, dispatch]);

  // Prompt on appear, and again on return to the app unless biometrics are known to be blocked.
  const autoPrompt = useRef(true);
  useEffect(() => {
    autoPrompt.current = !showPassword && !(outcome && NO_AUTO_PROMPT.includes(outcome));
  }, [showPassword, outcome]);
  useEffect(() => {
    if (autoPrompt.current) void unlockWithFingerprint();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && autoPrompt.current) void unlockWithFingerprint();
    });
    return () => {
      subscription.remove();
      cancelBiometricPrompt();
    };
  }, [unlockWithFingerprint]);

  // Back must never reveal the screens underneath: leave the app instead.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const submitPassword = async () => {
    setPasswordError(null);
    setCheckingPassword(true);
    try {
      const verifiedUid = await reauthenticateWithPassword(password);
      setPassword("");
      dispatch(appUnlocked({ uid: verifiedUid }));
    } catch (e) {
      setPasswordError(authMessage(e));
    } finally {
      setCheckingPassword(false);
    }
  };

  return (
    <AuthLayout title={strings.APP_LOCK_TITLE}>
      {email ? <MutedText>{email}</MutedText> : null}
      <InfoBanner message={outcome && outcome !== "success" ? OUTCOME_MESSAGES[outcome] : null} />
      <Button
        label={strings.APP_LOCK_UNLOCK}
        onPress={() => void unlockWithFingerprint()}
        loading={prompting}
        testID="app-lock-fingerprint"
      />
      {passwordSupported ? (
        showPassword ? (
          <>
            <TextField
              label={strings.PASSWORD}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              testID="app-lock-password"
            />
            <ErrorBanner message={passwordError} />
            <Button
              label={strings.APP_LOCK_PASSWORD_SUBMIT}
              variant="secondary"
              onPress={() => void submitPassword()}
              loading={checkingPassword}
              disabled={!password}
            />
          </>
        ) : (
          <Button label={strings.APP_LOCK_USE_PASSWORD} variant="secondary" onPress={() => setShowPassword(true)} />
        )
      ) : (
        <MutedText>{strings.APP_LOCK_SIGN_OUT_HINT}</MutedText>
      )}
      <Button label={strings.SIGN_OUT} variant="link" onPress={() => void signOut()} />
    </AuthLayout>
  );
}
