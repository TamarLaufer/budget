import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Provider } from "react-redux";

import { createStore } from "../store";
import { selectLockEnabled } from "../store/selectors";
import { loadLockPreference, lockSessionStarted } from "../store/slices/appLockSlice";
import { firebaseUserChanged } from "../store/slices/authSlice";
import { BiometricUnlockSection } from "../screens/SettingsScreen/BiometricUnlockSection";
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

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;
const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

beforeEach(() => {
  items.clear();
  jest.clearAllMocks();
  auth.isEnrolledAsync.mockResolvedValue(true);
});

async function renderSection(enabled = false) {
  if (enabled) items.set("spendo.biometricUnlock.userA", "1");
  const store = createStore();
  store.dispatch(lockSessionStarted({ uid: "userA", restored: false }));
  store.dispatch(firebaseUserChanged({ uid: "userA", email: "a@example.com", emailVerified: true }));
  await store.dispatch(loadLockPreference("userA"));
  await render(
    <Provider store={store}>
      <BiometricUnlockSection />
    </Provider>,
  );
  await waitFor(() => expect(auth.isEnrolledAsync).toHaveBeenCalled());
  return store;
}

const toggle = (value: boolean) => fireEvent(screen.getByTestId("biometric-unlock-switch"), "valueChange", value);

describe("fingerprint unlock setting", () => {
  it("is saved only after a successful fingerprint", async () => {
    const store = await renderSection();
    await toggle(true);
    await waitFor(() => expect(selectLockEnabled(store.getState())).toBe(true));
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(items.get("spendo.biometricUnlock.userA")).toBe("1");
  });

  it.each([
    ["user_cancel", strings.BIOMETRIC_ENABLE_CANCELLED],
    ["lockout", strings.BIOMETRIC_ENABLE_LOCKOUT],
    ["authentication_failed", strings.BIOMETRIC_ENABLE_FAILED],
  ] as const)("is not saved when the fingerprint fails (%s)", async (error, message) => {
    auth.authenticateAsync.mockResolvedValueOnce({ success: false, error });
    const store = await renderSection();
    await toggle(true);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(selectLockEnabled(store.getState())).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("cannot be turned on without an enrolled fingerprint", async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    await renderSection();
    expect(await screen.findByText(strings.BIOMETRIC_NOT_ENROLLED)).toBeTruthy();
    expect(screen.getByTestId("biometric-unlock-switch").props.disabled).toBe(true);
  });

  it("turns off without a prompt and deletes the stored flag", async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    const store = await renderSection(true);
    await waitFor(() => expect(screen.getByTestId("biometric-unlock-switch").props.disabled).toBe(false));
    await toggle(false);
    await waitFor(() => expect(selectLockEnabled(store.getState())).toBe(false));
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(items.size).toBe(0);
  });

  it("shows an error when the preference cannot be saved", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keystore"));
    const store = await renderSection();
    await toggle(true);
    expect(await screen.findByText(strings.BIOMETRIC_SAVE_FAILED)).toBeTruthy();
    expect(selectLockEnabled(store.getState())).toBe(false);
  });
});
