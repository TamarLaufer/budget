import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

/**
 * Fingerprint verification for the app lock. The OS performs the match: the app only learns
 * whether it succeeded and never sees or stores biometric data.
 *
 * Only Class 3 ("strong") biometrics are accepted, and the device PIN/pattern is deliberately not
 * offered as a fallback: other household members may know it. The in-app fallback is the
 * Firebase password (see LockScreen).
 */

export const isBiometricPlatform = Platform.OS === "android" || Platform.OS === "ios";

export type BiometricAvailability = "available" | "noHardware" | "notEnrolled";

/** What the UI needs to know about a verification attempt. */
export type BiometricOutcome =
  /** The enrolled owner was verified. */
  | "success"
  /** The prompt was dismissed (by the user, the system or the app); trying again is fine. */
  | "cancelled"
  /** Too many failed attempts: the OS refuses biometrics for a while. */
  | "lockout"
  /** No usable strong biometric on this device (e.g. fingerprints were removed). */
  | "unavailable"
  /** Any other failure. */
  | "failed";

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isBiometricPlatform) return "noHardware";
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return "noHardware";
    if (!(await LocalAuthentication.isEnrolledAsync())) return "notEnrolled";
    // Face unlock on many Android phones is only Class 2; it would be rejected by the prompt.
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ? "available" : "notEnrolled";
  } catch {
    return "noHardware";
  }
}

export function toBiometricOutcome(error: LocalAuthentication.LocalAuthenticationError | undefined): BiometricOutcome {
  switch (error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
    case "user_fallback":
      return "cancelled";
    case "lockout":
      return "lockout";
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
      return "unavailable";
    default:
      return "failed";
  }
}

let promptActive = false;

/**
 * True while the system prompt is showing. Some devices report the app as backgrounded during
 * the prompt; the background lock ignores those transitions.
 */
export const isBiometricPromptActive = () => promptActive;

export async function verifyBiometric(promptMessage: string, cancelLabel: string): Promise<BiometricOutcome> {
  if ((await getBiometricAvailability()) !== "available") return "unavailable";
  promptActive = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,
      biometricsSecurityLevel: "strong",
    });
    return result.success ? "success" : toBiometricOutcome(result.error);
  } catch {
    return "failed";
  } finally {
    promptActive = false;
  }
}

/** Dismisses an open prompt, e.g. when the lock screen goes away. Android only; no-op elsewhere. */
export function cancelBiometricPrompt(): void {
  if (Platform.OS === "android" && promptActive) void LocalAuthentication.cancelAuthenticate().catch(() => undefined);
}
