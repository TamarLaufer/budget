import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { authErrorKey, register, signIn } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { Card, MutedText, ScrollScreen, Title } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { strings } from "../../strings/he";
import { colors } from "../../theme";

const authMessage = (error: unknown) => strings.AUTH_ERRORS[authErrorKey(error)] ?? strings.AUTH_ERRORS.UNKNOWN ?? "";

function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollScreen withTopInset>
        <Title>{strings.APP_NAME}</Title>
        <MutedText style={{ textAlign: "center" }}>{title}</MutedText>
        <Card>{children}</Card>
      </ScrollScreen>
    </KeyboardAvoidingView>
  );
}

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // On success the session listener updates Redux and the route guards switch screens.
      await signIn(email, password);
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={strings.SIGN_IN_TITLE}>
      <TextField
        label={strings.EMAIL}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={strings.PASSWORD}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <ErrorBanner message={error} />
      <Button label={strings.SIGN_IN} onPress={submit} loading={busy} disabled={!email || !password} />
      <Button label={strings.NO_ACCOUNT} variant="link" onPress={() => router.replace("/register")} />
    </AuthLayout>
  );
}

export function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password !== confirm) {
      setError(strings.PASSWORDS_DONT_MATCH);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register(email, password);
    } catch (e) {
      setError(authMessage(e));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={strings.REGISTER_TITLE}>
      <TextField
        label={strings.EMAIL}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField label={strings.PASSWORD} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <TextField label={strings.CONFIRM_PASSWORD} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      <ErrorBanner message={error} />
      <Button label={strings.REGISTER} onPress={submit} loading={busy} disabled={!email || !password || !confirm} />
      <Button label={strings.HAVE_ACCOUNT} variant="link" onPress={() => router.replace("/sign-in")} />
    </AuthLayout>
  );
}
