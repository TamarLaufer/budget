import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { LoadingView } from "../components/ui/Feedback";
import { Title } from "../components/ui/Layout";
import { LockScreen } from "../screens/LockScreen/LockScreen";
import { useAppSelector } from "../store";
import { selectLockEnabled, selectLockGate } from "../store/selectors";
import { strings } from "../strings/he";
import { colors } from "../theme";
import { useBackgroundLock } from "./useBackgroundLock";
import { useRecentsProtection } from "./useRecentsProtection";

/**
 * Wraps everything a signed-in user can see.
 *
 * Cold start: until the user's lock preference is known, and until the first unlock, `children`
 * is not rendered at all, so no protected screen mounts, fetches or draws.
 *
 * Returning from the background: `children` stays mounted (the user keeps their place) but is
 * covered from the moment the app leaves the foreground, then replaced by the lock screen if the
 * timeout passed. While covered it is also hidden from screen readers.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const gate = useAppSelector(selectLockGate);
  const hasUnlocked = useAppSelector((s) => s.appLock.hasUnlocked);
  const enabled = useAppSelector(selectLockEnabled);
  const covered = useBackgroundLock();
  useRecentsProtection(enabled);

  if (gate === "checking") return <LoadingView />;
  if (gate === "locked" && !hasUnlocked) return <LockScreen />;

  const hidden = gate === "locked" || covered;
  return (
    <View style={styles.fill}>
      <View
        style={styles.fill}
        importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={hidden}
        testID="app-lock-content"
      >
        {children}
      </View>
      {gate === "locked" ? (
        <View style={styles.overlay}>
          <LockScreen />
        </View>
      ) : covered ? (
        <View style={[styles.overlay, styles.cover]} testID="app-lock-cover">
          <Title>{strings.APP_NAME}</Title>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background },
  cover: { alignItems: "center", justifyContent: "center" },
});
