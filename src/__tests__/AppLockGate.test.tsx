import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";
import { AppState, Platform, Text, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import { AppLockGate } from "../appLock/AppLockGate";
import { lockPreferenceKey } from "../appLock/lockPreference";
import { useRecentsProtection } from "../appLock/useRecentsProtection";
import { canReauthenticateWithPassword, reauthenticateWithPassword, signOut } from "../auth/session";
import { createStore } from "../store";
import { selectLockGate } from "../store/selectors";
import { sessionEnded } from "../store/shared";
import { loadLockPreference, lockSessionStarted } from "../store/slices/appLockSlice";
import { firebaseUserChanged } from "../store/slices/authSlice";
import { strings } from "../strings/he";

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

jest.mock("expo-screen-capture", () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));

jest.mock("../auth/session", () => ({
  canReauthenticateWithPassword: jest.fn(() => true),
  reauthenticateWithPassword: jest.fn(async () => "userA"),
  signOut: jest.fn(async () => undefined),
  authErrorKey: (e: { code?: string }) => (e?.code === "auth/invalid-credential" ? "INVALID_CREDENTIALS" : "UNKNOWN"),
}));

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const reauthenticate = reauthenticateWithPassword as jest.Mock;

const FINANCIAL = "יתרה: 1,234 ₪";
const userA = { uid: "userA", email: "a@example.com", emailVerified: true };
const userB = { uid: "userB", email: "b@example.com", emailVerified: true };

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
let now = 1_000_000;

beforeEach(() => {
  items.clear();
  jest.clearAllMocks();
  authenticate.mockResolvedValue({ success: true });
  (canReauthenticateWithPassword as jest.Mock).mockReturnValue(true);
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    const typed = listener as (state: AppStateStatus) => void;
    appStateListeners.push(typed);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== typed)) };
  });
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => jest.restoreAllMocks());

async function setAppState(state: AppStateStatus) {
  await act(async () => {
    for (const listener of [...appStateListeners]) listener(state);
  });
}

async function startSession(user = userA, { restored = true, enabled = true } = {}) {
  if (enabled) items.set(lockPreferenceKey(user.uid), "1");
  const store = createStore();
  store.dispatch(lockSessionStarted({ uid: user.uid, restored }));
  store.dispatch(firebaseUserChanged(user));
  return store;
}

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderGate(store: ReturnType<typeof createStore>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
    </Provider>
  );
  await render(
    <AppLockGate>
      <Text>{FINANCIAL}</Text>
    </AppLockGate>,
    { wrapper: Wrapper },
  );
}

/** Brings a restored, locked session to "unlocked" through the fingerprint prompt. */
async function unlockedSession() {
  const store = await startSession();
  await store.dispatch(loadLockPreference("userA"));
  await renderGate(store);
  await screen.findByText(FINANCIAL);
  authenticate.mockClear();
  return store;
}

describe("cold start", () => {
  it("renders nothing protected while the lock preference is unknown", async () => {
    const store = await startSession();
    await renderGate(store);
    expect(screen.queryByText(FINANCIAL)).toBeNull();
    expect(screen.getByText(strings.LOADING)).toBeTruthy();
  });

  it("shows only the lock screen until the fingerprint succeeds", async () => {
    let finish: (r: { success: boolean }) => void = () => undefined;
    authenticate.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const store = await startSession();
    await store.dispatch(loadLockPreference("userA"));
    await renderGate(store);

    expect(screen.getByText(strings.APP_LOCK_TITLE)).toBeTruthy();
    expect(screen.queryByText(FINANCIAL)).toBeNull();
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));

    await act(async () => finish({ success: true }));
    expect(await screen.findByText(FINANCIAL)).toBeTruthy();
    expect(screen.queryByText(strings.APP_LOCK_TITLE)).toBeNull();
  });

  it("does not lock users who have not enabled the setting", async () => {
    const store = await startSession(userA, { enabled: false });
    await store.dispatch(loadLockPreference("userA"));
    await renderGate(store);
    expect(screen.getByText(FINANCIAL)).toBeTruthy();
    expect(authenticate).not.toHaveBeenCalled();
  });
});

describe("returning from the background", () => {
  it("covers content as soon as the app leaves the foreground", async () => {
    await unlockedSession();
    await setAppState("background");
    expect(screen.getByTestId("app-lock-cover")).toBeTruthy();
    expect(screen.getByTestId("app-lock-content", { includeHiddenElements: true }).props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("uncovers without asking again within 60 seconds", async () => {
    await unlockedSession();
    await setAppState("background");
    now += 59_000;
    await setAppState("active");
    expect(screen.queryByTestId("app-lock-cover")).toBeNull();
    expect(screen.queryByText(strings.APP_LOCK_TITLE)).toBeNull();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("locks after 60 seconds and keeps the screens mounted but hidden underneath", async () => {
    const store = await unlockedSession();
    authenticate.mockResolvedValue({ success: false, error: "user_cancel" });
    await setAppState("background");
    now += 60_000;
    await setAppState("active");

    expect(selectLockGate(store.getState())).toBe("locked");
    expect(screen.getByText(strings.APP_LOCK_TITLE)).toBeTruthy();
    expect(screen.getByTestId("app-lock-content", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(await screen.findByText(strings.APP_LOCK_CANCELLED)).toBeTruthy();
  });

  it("does not cover anything when the lock is off", async () => {
    const store = await startSession(userA, { enabled: false });
    await store.dispatch(loadLockPreference("userA"));
    await renderGate(store);
    await setAppState("background");
    expect(screen.queryByTestId("app-lock-cover")).toBeNull();
  });
});

describe("sessions", () => {
  it("does not carry an unlock over to the next account", async () => {
    const store = await unlockedSession();
    await act(async () => {
      store.dispatch(sessionEnded());
      store.dispatch(lockSessionStarted({ uid: "userB", restored: true }));
      store.dispatch(firebaseUserChanged(userB));
    });
    expect(screen.queryByText(FINANCIAL)).toBeNull();

    items.set(lockPreferenceKey("userB"), "1");
    authenticate.mockResolvedValue({ success: false, error: "user_cancel" });
    await act(async () => void (await store.dispatch(loadLockPreference("userB"))));
    expect(screen.getByText(strings.APP_LOCK_TITLE)).toBeTruthy();
    expect(screen.getByText("b@example.com")).toBeTruthy();
    expect(screen.queryByText(FINANCIAL)).toBeNull();
  });
});

describe("lock screen", () => {
  async function lockedScreen(firstResult: object) {
    authenticate.mockResolvedValue(firstResult);
    const store = await startSession();
    await store.dispatch(loadLockPreference("userA"));
    await renderGate(store);
    await waitFor(() => expect(authenticate).toHaveBeenCalled());
    return store;
  }

  it("stays locked after cancelling and lets the user try again", async () => {
    await lockedScreen({ success: false, error: "user_cancel" });
    expect(await screen.findByText(strings.APP_LOCK_CANCELLED)).toBeTruthy();
    expect(screen.queryByText(FINANCIAL)).toBeNull();

    authenticate.mockResolvedValue({ success: true });
    await fireEvent.press(screen.getByTestId("app-lock-fingerprint"));
    expect(await screen.findByText(FINANCIAL)).toBeTruthy();
  });

  it("stops prompting automatically after a lockout", async () => {
    await lockedScreen({ success: false, error: "lockout" });
    expect(await screen.findByText(strings.APP_LOCK_LOCKOUT)).toBeTruthy();
    authenticate.mockClear();
    await setAppState("active");
    expect(authenticate).not.toHaveBeenCalled();
    expect(screen.queryByText(FINANCIAL)).toBeNull();
  });

  it("unlocks with the correct Firebase password and stays locked with a wrong one", async () => {
    await lockedScreen({ success: false, error: "lockout" });
    await fireEvent.press(screen.getByText(strings.APP_LOCK_USE_PASSWORD));

    reauthenticate.mockRejectedValueOnce(Object.assign(new Error("bad"), { code: "auth/invalid-credential" }));
    await fireEvent.changeText(screen.getByTestId("app-lock-password"), "wrong");
    await fireEvent.press(screen.getByText(strings.APP_LOCK_PASSWORD_SUBMIT));
    expect(await screen.findByText(strings.AUTH_ERRORS.INVALID_CREDENTIALS ?? "")).toBeTruthy();
    expect(screen.queryByText(FINANCIAL)).toBeNull();

    await fireEvent.changeText(screen.getByTestId("app-lock-password"), "right");
    await fireEvent.press(screen.getByText(strings.APP_LOCK_PASSWORD_SUBMIT));
    expect(await screen.findByText(FINANCIAL)).toBeTruthy();
    expect(reauthenticate).toHaveBeenLastCalledWith("right");
  });

  it("does not unlock when the password check reports a different user", async () => {
    await lockedScreen({ success: false, error: "user_cancel" });
    await fireEvent.press(screen.getByText(strings.APP_LOCK_USE_PASSWORD));
    reauthenticate.mockResolvedValueOnce("userB");
    await fireEvent.changeText(screen.getByTestId("app-lock-password"), "x");
    await fireEvent.press(screen.getByText(strings.APP_LOCK_PASSWORD_SUBMIT));
    await waitFor(() => expect(reauthenticate).toHaveBeenCalled());
    expect(screen.queryByText(FINANCIAL)).toBeNull();
  });

  it("offers sign-out instead of a password for accounts without one", async () => {
    (canReauthenticateWithPassword as jest.Mock).mockReturnValue(false);
    await lockedScreen({ success: false, error: "user_cancel" });
    expect(screen.queryByText(strings.APP_LOCK_USE_PASSWORD)).toBeNull();
    expect(screen.getByText(strings.APP_LOCK_SIGN_OUT_HINT)).toBeTruthy();
    await fireEvent.press(screen.getByText(strings.SIGN_OUT));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("recent-apps protection", () => {
  it("uses FLAG_SECURE only on Android before 13, and only while the lock is on", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    Object.defineProperty(Platform, "Version", { get: () => 31, configurable: true });
    const { rerender, unmount } = await renderHook(({ enabled }: { enabled: boolean }) => useRecentsProtection(enabled), {
      initialProps: { enabled: false },
    });
    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith("spendo-app-lock");
    await rerender({ enabled: false });
    expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith("spendo-app-lock");
    await unmount();
  });

  it("leaves screenshots alone on Android 13+, where the native plugin hides the preview", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    Object.defineProperty(Platform, "Version", { get: () => 34, configurable: true });
    await renderHook(() => useRecentsProtection(true));
    expect(ScreenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();
  });
});
