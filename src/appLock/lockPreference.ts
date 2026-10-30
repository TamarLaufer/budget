import * as SecureStore from "expo-secure-store";

/**
 * The "unlock with fingerprint" preference, stored per Firebase user on this device only.
 *
 * SecureStore entries are encrypted with an Android Keystore key, excluded from Auto Backup and
 * deleted on uninstall, so the preference never follows the account to another device. Only a
 * flag is stored: no biometric data, password or token.
 */

const ENABLED = "1";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** SecureStore keys allow only these characters; Firebase UIDs always match. */
const SAFE_KEY_PART = /^[A-Za-z0-9._-]+$/;

export function lockPreferenceKey(uid: string): string {
  if (!SAFE_KEY_PART.test(uid)) throw new Error("Unsupported user id for the app lock preference");
  return `spendo.biometricUnlock.${uid}`;
}

/** Rejects when the value cannot be read; callers must then treat the lock as enabled. */
export async function readLockPreference(uid: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(lockPreferenceKey(uid), OPTIONS)) === ENABLED;
}

export async function writeLockPreference(uid: string, enabled: boolean): Promise<void> {
  const key = lockPreferenceKey(uid);
  if (enabled) await SecureStore.setItemAsync(key, ENABLED, OPTIONS);
  else await SecureStore.deleteItemAsync(key, OPTIONS);
}
