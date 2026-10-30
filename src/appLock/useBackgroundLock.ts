import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useAppDispatch, useAppSelector } from "../store";
import { selectLockEnabled } from "../store/selectors";
import { appLocked } from "../store/slices/appLockSlice";
import { isBiometricPromptActive } from "./biometrics";
import { shouldRelock } from "./relock";

/**
 * While fingerprint unlock is on, covers the app as soon as it leaves the foreground and locks it
 * when it comes back after RELOCK_AFTER_MS. Returns whether the cover should be shown.
 *
 * The cover goes up on the way out, so on return the last drawn frame is the cover, never the
 * data; it comes down only after the relock decision has been dispatched.
 */
export function useBackgroundLock(): boolean {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectLockEnabled);
  const uid = useAppSelector((s) => s.appLock.uid);
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    // A new user or a changed setting starts from scratch: nothing carries over between sessions.
    backgroundedAt.current = null;
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (isBiometricPromptActive()) return;
      if (state === "background" || state === "inactive") {
        backgroundedAt.current ??= Date.now();
        setCovered(true);
      } else if (state === "active") {
        // Lock before uncovering, so no frame shows content between the two.
        if (backgroundedAt.current !== null && shouldRelock(backgroundedAt.current, Date.now())) dispatch(appLocked());
        backgroundedAt.current = null;
        setCovered(false);
      }
    });
    return () => subscription.remove();
  }, [enabled, uid, dispatch]);

  return enabled && covered;
}
