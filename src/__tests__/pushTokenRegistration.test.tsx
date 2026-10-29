import { act, renderHook } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import type { ReactNode } from "react";
import { Provider } from "react-redux";

import { api } from "../api/endpoints";
import { registerDevice, unregisterDevice } from "../notifications/pushNotifications";
import { useBudgetAlertNotifications } from "../notifications/useBudgetAlertNotifications";
import { createStore } from "../store";
import { loadMe } from "../store/slices/authSlice";
import { fulfilled, meWithHousehold } from "../test-utils/fixtures";

/**
 * Mimics expo-notifications on Android: every native token fetch also emits a push token event
 * (PushTokenModule calls onNewToken after resolving), and getExpoPushTokenAsync fetches the native
 * token unless one is passed in. Listening and re-fetching on each event used to loop forever.
 */
jest.mock("expo-notifications", () => {
  type MockListener = (token: { type: string; data: string }) => void;
  const listeners = new Set<MockListener>();
  const native = { token: "fcm-1" };
  const emit = (data: string) => {
    for (const listener of [...listeners]) listener({ type: "android", data });
  };
  const getDevicePushTokenAsync = jest.fn(() => {
    const data = native.token;
    // The event arrives separately from the resolved promise.
    setTimeout(() => emit(data), 0);
    return Promise.resolve({ type: "android", data });
  });
  return {
    __native: native,
    __emit: emit,
    __listenerCount: () => listeners.size,
    AndroidImportance: { HIGH: 4 },
    setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
    getDevicePushTokenAsync,
    getExpoPushTokenAsync: jest.fn(async (options?: { devicePushToken?: { data: string } }) => {
      const device = options?.devicePushToken ?? (await getDevicePushTokenAsync());
      return { type: "expo", data: `ExponentPushToken[${device.data}]` };
    }),
    addPushTokenListener: jest.fn((listener: MockListener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
    useLastNotificationResponse: () => null,
    clearLastNotificationResponse: jest.fn(),
  };
});

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));

jest.mock("../api/endpoints", () => ({
  api: {
    notifications: {
      registerDevice: jest.fn(() => Promise.resolve()),
      unregisterDevice: jest.fn(() => Promise.resolve()),
    },
  },
}));

const mock = Notifications as unknown as typeof Notifications & {
  __native: { token: string };
  __emit: (data: string) => void;
  __listenerCount: () => number;
};
const registerApi = api.notifications.registerDevice as jest.Mock;
const unregisterApi = api.notifications.unregisterDevice as jest.Mock;
const token = (data: string) => ({ type: "android", data }) as Notifications.DevicePushToken;

/** Lets pending timers (token events) and the promise chains they start run. */
async function settle(rounds = 20) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await unregisterDevice(); // module state is shared between tests
  await settle();
  mock.__native.token = "fcm-1";
  jest.clearAllMocks();
});

describe("useBudgetAlertNotifications registration", () => {
  function renderWithAlerts(enabled = true) {
    const store = createStore();
    store.dispatch(
      fulfilled(loadMe, { ...meWithHousehold, notifications: { budgetAlertsEnabled: enabled } }, undefined),
    );
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    return renderHook(() => useBudgetAlertNotifications(true), { wrapper });
  }

  it("registers once even though fetching the token emits a token event (no loop)", async () => {
    await renderWithAlerts();
    await act(() => settle(50));

    expect(registerApi).toHaveBeenCalledTimes(1);
    expect(registerApi).toHaveBeenCalledWith({ token: "ExponentPushToken[fcm-1]", platform: expect.any(String) });
    expect(Notifications.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated events for the same token and registers a genuinely new one", async () => {
    await renderWithAlerts();
    await act(() => settle());

    await act(async () => {
      for (let i = 0; i < 10; i += 1) mock.__emit("fcm-1");
      await settle();
    });
    expect(registerApi).toHaveBeenCalledTimes(1);

    mock.__native.token = "fcm-2";
    await act(async () => {
      mock.__emit("fcm-2");
      mock.__emit("fcm-2");
      await settle();
    });
    expect(registerApi).toHaveBeenCalledTimes(2);
    expect(registerApi).toHaveBeenLastCalledWith({ token: "ExponentPushToken[fcm-2]", platform: expect.any(String) });
    expect(Notifications.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it("does not listen or register while alerts are off, and stops listening on unmount", async () => {
    const off = await renderWithAlerts(false);
    await act(() => settle());
    expect(registerApi).not.toHaveBeenCalled();
    expect(mock.__listenerCount()).toBe(0);
    await off.unmount();

    const on = await renderWithAlerts(true);
    await act(() => settle());
    expect(mock.__listenerCount()).toBe(1);
    await on.unmount();
    expect(mock.__listenerCount()).toBe(0);
  });
});

describe("registerDevice", () => {
  it("serializes concurrent attempts and sends an unchanged token only once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    registerApi.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    await Promise.all([
      ...Array.from({ length: 5 }, () => registerDevice("user-a")),
      ...Array.from({ length: 5 }, () => registerDevice("user-a", token("fcm-1"))),
    ]);
    await settle();

    expect(maxInFlight).toBe(1);
    expect(registerApi).toHaveBeenCalledTimes(1);
  });

  it("re-registers the same device for the next account after sign-out", async () => {
    await registerDevice("user-a");
    await unregisterDevice();
    await registerDevice("user-b");

    expect(registerApi).toHaveBeenCalledTimes(2);
    expect(unregisterApi).toHaveBeenCalledTimes(1);
    expect(unregisterApi).toHaveBeenCalledWith("ExponentPushToken[fcm-1]");
  });

  it("registers for a different account even without an explicit sign-out", async () => {
    await registerDevice("user-a");
    await registerDevice("user-b");
    expect(registerApi).toHaveBeenCalledTimes(2);
  });

  it("sign-out waits for an in-flight registration and drops queued ones", async () => {
    let release!: () => void;
    registerApi.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));

    const first = registerDevice("user-a");
    const queued = registerDevice("user-a", token("fcm-2"));
    await settle();
    const signOut = unregisterDevice();
    release();
    await Promise.all([first, queued, signOut]);

    expect(registerApi).toHaveBeenCalledTimes(1); // the queued fcm-2 belonged to the old session
    expect(unregisterApi).toHaveBeenCalledWith("ExponentPushToken[fcm-1]");
  });

  it("retries after a failed request instead of treating the token as registered", async () => {
    registerApi.mockRejectedValueOnce(new Error("429"));
    await expect(registerDevice("user-a")).rejects.toThrow("429");
    await registerDevice("user-a");
    expect(registerApi).toHaveBeenCalledTimes(2);
  });
});
