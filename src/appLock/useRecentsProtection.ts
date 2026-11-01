import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Platform } from "react-native";

const KEY = "spendo-app-lock";

/** Android 13: the first version with Activity.setRecentsScreenshotEnabled. */
const RECENTS_API_LEVEL = 33;

/**
 * Keeps financial content out of Android's recent-apps preview while fingerprint unlock is on.
 *
 * - Android 13+: handled natively for the whole app by plugins/withRecentsScreenshotDisabled
 *   (hides only the preview; screenshots keep working). Nothing to do here.
 * - Older Android: the only option is FLAG_SECURE, which also blocks screenshots and screen
 *   recording, so it is applied only while the lock is enabled for the signed-in user.
 */
export function useRecentsProtection(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== "android" || Number(Platform.Version) >= RECENTS_API_LEVEL) return;
    void ScreenCapture.preventScreenCaptureAsync(KEY).catch(() => undefined);
    return () => void ScreenCapture.allowScreenCaptureAsync(KEY).catch(() => undefined);
  }, [enabled]);
}
