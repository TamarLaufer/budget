import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import { errorMessage } from "../api/errorMessage";
import { AppLockGate } from "../appLock/AppLockGate";
import { isFirebaseConfigured } from "../auth/firebase";
import { signOut, startSession } from "../auth/session";
import { Button } from "../components/ui/Button";
import { ErrorView, LoadingView } from "../components/ui/Feedback";
import { configureForegroundNotifications } from "../notifications/pushNotifications";
import { useBudgetAlertNotifications } from "../notifications/useBudgetAlertNotifications";
import { store, useAppDispatch, useAppSelector } from "../store";
import { selectAppPhase, selectLockGate, type AppPhase } from "../store/selectors";
import { loadMe } from "../store/slices/authSlice";
import { strings } from "../strings/he";
import { colors } from "../theme";

configureForegroundNotifications();

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {isFirebaseConfigured ? <SessionGate /> : <ErrorView message={strings.FIREBASE_NOT_CONFIGURED} />}
      </SafeAreaProvider>
    </Provider>
  );
}

/**
 * Chooses which routes exist for the current session. Protected groups make it impossible to
 * reach app screens while signed out or without a household (the backend enforces the same
 * rules independently). Everything a signed-in user sees goes through the app lock.
 */
function SessionGate() {
  const dispatch = useAppDispatch();
  const phase = useAppSelector(selectAppPhase);
  const unlocked = useAppSelector(selectLockGate) === "unlocked";

  useEffect(() => startSession(dispatch), [dispatch]);
  // A notification tapped while locked is handled once the app is unlocked.
  useBudgetAlertNotifications(phase === "ready" && unlocked);

  if (phase === "initializing") return <LoadingView />;
  if (phase === "signedOut") return <AppStack phase={phase} />;
  return (
    <AppLockGate>
      {phase === "loadingProfile" ? <LoadingView /> : phase === "profileError" ? <ProfileError /> : <AppStack phase={phase} />}
    </AppLockGate>
  );
}

function ProfileError() {
  const dispatch = useAppDispatch();
  const meError = useAppSelector((s) => s.auth.meError);
  // E.g. the server is unreachable: offer a retry, and a way out to another account.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ErrorView message={`${strings.PROFILE_LOAD_FAILED}\n${errorMessage(meError)}`} onRetry={() => void dispatch(loadMe())} />
      <Button label={strings.SIGN_OUT} variant="link" onPress={() => void signOut()} />
    </View>
  );
}

function AppStack({ phase }: { phase: AppPhase }) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={phase === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === "onboarding"}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={phase === "ready"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/new" options={{ headerShown: true, presentation: "modal" }} />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="budgets" options={{ headerShown: true }} />
        <Stack.Screen name="practice" options={{ headerShown: true }} />
      </Stack.Protected>
    </Stack>
  );
}
