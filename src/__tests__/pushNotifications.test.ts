import * as Notifications from "expo-notifications";

import { api } from "../api/endpoints";
import {
  budgetAlertPeriod,
  registerDevice,
  requestPermission,
  unregisterDevice,
} from "../notifications/pushNotifications";
import { createStore } from "../store";
import { loadMe, updateBudgetAlerts } from "../store/slices/authSlice";
import { fulfilled, meWithHousehold } from "../test-utils/fixtures";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: "android", data: "abc" })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ type: "expo", data: "ExponentPushToken[abc]" })),
}));

jest.mock("../api/endpoints", () => ({
  api: {
    notifications: {
      registerDevice: jest.fn(() => Promise.resolve()),
      unregisterDevice: jest.fn(() => Promise.resolve()),
      updatePreferences: jest.fn(),
    },
  },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const permission = (granted: boolean, canAskAgain = true) =>
  ({ granted, canAskAgain, status: granted ? "granted" : "denied", expires: "never" }) as unknown as Notifications.NotificationPermissionsStatus;

beforeEach(async () => {
  await unregisterDevice(); // registration state is shared between tests
  jest.clearAllMocks();
});

describe("requestPermission", () => {
  it("does not prompt when already granted", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(true));
    await expect(requestPermission()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("prompts when allowed and reports the answer", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false));
    mocked.requestPermissionsAsync.mockResolvedValue(permission(false));
    await expect(requestPermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("does not prompt again after a permanent denial", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(requestPermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("device registration", () => {
  it("registers the Expo push token and unregisters it on sign-out", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(true));
    await registerDevice("user-a");
    expect(api.notifications.registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ token: "ExponentPushToken[abc]" }),
    );

    await unregisterDevice();
    expect(api.notifications.unregisterDevice).toHaveBeenCalledWith("ExponentPushToken[abc]");
    await unregisterDevice(); // nothing left to remove
    expect(api.notifications.unregisterDevice).toHaveBeenCalledTimes(1);
  });

  it("does nothing without permission", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false));
    await registerDevice("user-a");
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.notifications.registerDevice).not.toHaveBeenCalled();
  });

  it("propagates token errors so Settings can report them", async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(true));
    mocked.getExpoPushTokenAsync.mockRejectedValueOnce(new Error("no FCM"));
    await expect(registerDevice("user-a")).rejects.toThrow("no FCM");
  });
});

describe("budgetAlertPeriod", () => {
  it("reads the month of a budget alert", () => {
    expect(budgetAlertPeriod({ type: "budget-alert", year: 2026, month: 10, categoryId: "c" })).toEqual({
      year: 2026,
      month: 10,
    });
  });

  it.each([null, undefined, {}, { type: "other", year: 2026, month: 10 }, { type: "budget-alert", year: 2026, month: 13 }])(
    "ignores %p",
    (data) => {
      expect(budgetAlertPeriod(data)).toBeNull();
    },
  );
});

describe("budget alerts preference in the store", () => {
  it("mirrors the saved preference into the profile", () => {
    const store = createStore();
    store.dispatch(fulfilled(loadMe, meWithHousehold, undefined));
    store.dispatch(fulfilled(updateBudgetAlerts, { budgetAlertsEnabled: true }, true));
    expect(store.getState().auth.me?.notifications.budgetAlertsEnabled).toBe(true);
  });
});
