import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import { getBiometricAvailability, toBiometricOutcome, verifyBiometric } from "../appLock/biometrics";
import { lockPreferenceKey, readLockPreference, writeLockPreference } from "../appLock/lockPreference";
import { RELOCK_AFTER_MS, shouldRelock } from "../appLock/relock";
import { createStore } from "../store";
import { selectLockEnabled, selectLockGate } from "../store/selectors";
import { sessionEnded } from "../store/shared";
import {
  appLocked,
  appUnlocked,
  loadLockPreference,
  lockSessionStarted,
  setLockPreference,
} from "../store/slices/appLockSlice";
import { firebaseUserChanged } from "../store/slices/authSlice";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addRecentsScreenshotDisabled } = require("../../plugins/withRecentsScreenshotDisabled");

jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    __items: items,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void items.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void items.delete(key)),
  };
});

jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  getEnrolledLevelAsync: jest.fn(async () => 3),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  cancelAuthenticate: jest.fn(async () => undefined),
}));

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;
const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

beforeEach(() => {
  items.clear();
  jest.clearAllMocks();
});

const userA = { uid: "userA", email: "a@example.com", emailVerified: true };
const userB = { uid: "userB", email: "b@example.com", emailVerified: true };

function signedInStore(user = userA, restored = true) {
  const store = createStore();
  store.dispatch(lockSessionStarted({ uid: user.uid, restored }));
  store.dispatch(firebaseUserChanged(user));
  return store;
}

describe("app lock state", () => {
  it("stays 'checking' after a restored session until the preference is read", async () => {
    const store = signedInStore();
    expect(selectLockGate(store.getState())).toBe("checking");

    items.set(lockPreferenceKey("userA"), "1");
    await store.dispatch(loadLockPreference("userA"));
    expect(selectLockGate(store.getState())).toBe("locked");
    expect(store.getState().appLock.hasUnlocked).toBe(false);
  });

  it("unlocks a restored session at once when the user has not enabled the lock", async () => {
    const store = signedInStore();
    await store.dispatch(loadLockPreference("userA"));
    expect(selectLockGate(store.getState())).toBe("unlocked");
    expect(selectLockEnabled(store.getState())).toBe(false);
  });

  it("treats a fresh password sign-in as unlocked even when the lock is enabled", async () => {
    items.set(lockPreferenceKey("userA"), "1");
    const store = signedInStore(userA, false);
    expect(selectLockGate(store.getState())).toBe("unlocked");
    await store.dispatch(loadLockPreference("userA"));
    expect(selectLockGate(store.getState())).toBe("unlocked");
    expect(selectLockEnabled(store.getState())).toBe(true);
  });

  it("fails closed when the preference cannot be read", async () => {
    const store = signedInStore();
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keystore"));
    await store.dispatch(loadLockPreference("userA"));
    expect(selectLockGate(store.getState())).toBe("locked");
  });

  it("relocks only when enabled, and unlocks only for the same user", async () => {
    items.set(lockPreferenceKey("userA"), "1");
    const store = signedInStore();
    await store.dispatch(loadLockPreference("userA"));

    store.dispatch(appUnlocked({ uid: "userB" }));
    expect(selectLockGate(store.getState())).toBe("locked");
    store.dispatch(appUnlocked({ uid: "userA" }));
    expect(selectLockGate(store.getState())).toBe("unlocked");
    expect(store.getState().appLock.hasUnlocked).toBe(true);

    store.dispatch(appLocked());
    expect(selectLockGate(store.getState())).toBe("locked");

    await store.dispatch(setLockPreference({ uid: "userA", enabled: false }));
    store.dispatch(appUnlocked({ uid: "userA" }));
    store.dispatch(appLocked());
    expect(selectLockGate(store.getState())).toBe("unlocked");
  });

  it("never applies one user's lock state to another", async () => {
    items.set(lockPreferenceKey("userA"), "1");
    const store = signedInStore();
    const pendingRead = store.dispatch(loadLockPreference("userA"));

    // Account switch before user A's preference arrived.
    store.dispatch(sessionEnded());
    expect(store.getState().appLock).toEqual({ uid: null, status: "checking", enabled: false, hasUnlocked: false });
    store.dispatch(lockSessionStarted({ uid: "userB", restored: true }));
    store.dispatch(firebaseUserChanged(userB));
    await pendingRead;

    expect(selectLockGate(store.getState())).toBe("checking");
    await store.dispatch(setLockPreference({ uid: "userA", enabled: true }));
    expect(store.getState().appLock.enabled).toBe(false);

    await store.dispatch(loadLockPreference("userB"));
    expect(selectLockGate(store.getState())).toBe("unlocked");
  });

  it("reports 'checking' when the lock state belongs to someone other than the Firebase user", () => {
    const store = createStore();
    store.dispatch(lockSessionStarted({ uid: "userA", restored: false }));
    store.dispatch(firebaseUserChanged(userB));
    expect(selectLockGate(store.getState())).toBe("checking");
    expect(selectLockEnabled(store.getState())).toBe(false);
  });
});

describe("lock preference storage", () => {
  it("keeps a separate entry per user and stores only a flag", async () => {
    await writeLockPreference("userA", true);
    expect(await readLockPreference("userA")).toBe(true);
    expect(await readLockPreference("userB")).toBe(false);
    expect([...items.entries()]).toEqual([["spendo.biometricUnlock.userA", "1"]]);

    await writeLockPreference("userA", false);
    expect(items.size).toBe(0);
  });

  it("rejects user ids that SecureStore keys cannot hold", () => {
    expect(() => lockPreferenceKey("a/b")).toThrow();
    expect(() => lockPreferenceKey("")).toThrow();
  });
});

describe("relock timing", () => {
  it("locks after the timeout or when the clock moved backwards", () => {
    expect(RELOCK_AFTER_MS).toBe(60_000);
    expect(shouldRelock(1_000, 1_000 + 59_999)).toBe(false);
    expect(shouldRelock(1_000, 1_000 + 60_000)).toBe(true);
    expect(shouldRelock(1_000, 500)).toBe(true);
  });
});

describe("biometrics", () => {
  it("maps every failure to an outcome that keeps the app locked", () => {
    expect(toBiometricOutcome("user_cancel")).toBe("cancelled");
    expect(toBiometricOutcome("system_cancel")).toBe("cancelled");
    expect(toBiometricOutcome("app_cancel")).toBe("cancelled");
    expect(toBiometricOutcome("lockout")).toBe("lockout");
    expect(toBiometricOutcome("not_enrolled")).toBe("unavailable");
    expect(toBiometricOutcome("not_available")).toBe("unavailable");
    expect(toBiometricOutcome("passcode_not_set")).toBe("unavailable");
    expect(toBiometricOutcome("authentication_failed")).toBe("failed");
    expect(toBiometricOutcome("unknown")).toBe("failed");
    expect(toBiometricOutcome(undefined)).toBe("failed");
  });

  it("asks for strong biometrics only, without the device PIN fallback", async () => {
    expect(await verifyBiometric("p", "c")).toBe("success");
    expect(auth.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true, biometricsSecurityLevel: "strong" }),
    );
  });

  it("does not prompt when only weak biometrics are enrolled", async () => {
    auth.getEnrolledLevelAsync.mockResolvedValueOnce(LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK);
    expect(await getBiometricAvailability()).toBe("notEnrolled");
    auth.isEnrolledAsync.mockResolvedValueOnce(false);
    expect(await verifyBiometric("p", "c")).toBe("unavailable");
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });

  it("treats a thrown native error as a failure", async () => {
    auth.authenticateAsync.mockRejectedValueOnce(new Error("native"));
    expect(await verifyBiometric("p", "c")).toBe("failed");
  });
});

describe("recents screenshot config plugin", () => {
  const template = `package com.example

import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }
}
`;

  it("disables the recents screenshot after super.onCreate and imports Build", () => {
    const result: string = addRecentsScreenshotDisabled(template);
    expect(result).toContain("import android.os.Build\n");
    expect(result.indexOf("setRecentsScreenshotEnabled(false)")).toBeGreaterThan(result.indexOf("super.onCreate(null)"));
    expect(result).toContain("Build.VERSION_CODES.TIRAMISU");
    expect(addRecentsScreenshotDisabled(result)).toBe(result);
  });

  it("fails the build instead of silently skipping protection", () => {
    expect(() => addRecentsScreenshotDisabled("class MainActivity")).toThrow();
  });
});
