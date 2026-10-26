import { TextField } from "@/components/ui/TextField";
import AuthLayout from "./AuthScreensLayout";
import { strings } from "@/strings/he";
import { useState } from "react";
import { signIn } from "@/auth/session";
import { ErrorBanner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { router } from "expo-router";
import { authMessage } from "./authMessage";

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