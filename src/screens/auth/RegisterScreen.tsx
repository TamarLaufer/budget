import { router } from "expo-router";
import { useState } from "react";
import { register } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { TextField } from "../../components/ui/TextField";
import { strings } from "../../strings/he";
import AuthLayout from "./AuthScreensLayout";
import { authMessage } from "./authMessage";

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
