import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Provider } from "react-redux";

import { api } from "../api/endpoints";
import { unregisterDevice } from "../notifications/pushNotifications";
import { useBudgetAlertNotifications } from "../notifications/useBudgetAlertNotifications";
import { BudgetAlertsSection } from "../screens/SettingsScreen/SettingsScreen";
import { createStore } from "../store";
import { loadMe } from "../store/slices/authSlice";
import { strings } from "../strings/he";
import { fulfilled, meWithHousehold } from "../test-utils/fixtures";

/** Device permission as after a reinstall: off, until the test grants it. */
const permission = { granted: false, canAskAgain: true };

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ ...permission })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ ...permission })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: "android", data: "fcm-1" })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ type: "expo", data: "ExponentPushToken[fcm-1]" })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: () => null,
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock("expo-linking", () => ({ openSettings: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-router", () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock("../auth/session", () => ({ signOut: jest.fn() }));
jest.mock("../api/endpoints", () => ({
  api: {
    notifications: {
      registerDevice: jest.fn(() => Promise.resolve()),
      unregisterDevice: jest.fn(() => Promise.resolve()),
    },
  },
}));

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const registerApi = api.notifications.registerDevice as jest.Mock;

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
/** The user comes back to the app, e.g. from system settings. */
const returnToApp = () => act(async () => appStateListeners.forEach((listener) => listener("active")));

beforeEach(async () => {
  await unregisterDevice(); // registration state is module-wide
  Object.assign(permission, { granted: false, canAskAgain: true });
  jest.clearAllMocks();
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListeners.push(listener);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) };
  });
});

function storeWithAlerts(enabled = true) {
  const store = createStore();
  store.dispatch(fulfilled(loadMe, { ...meWithHousehold, notifications: { budgetAlertsEnabled: enabled } }, undefined));
  return store;
}

describe("startup with the preference on but permission off", () => {
  function renderRootHook() {
    const store = storeWithAlerts();
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    return renderHook(() => useBudgetAlertNotifications(true), { wrapper });
  }

  it("checks without prompting and registers once permission is granted in system settings", async () => {
    await renderRootHook();
    await waitFor(() => expect(notifications.getPermissionsAsync).toHaveBeenCalled());
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerApi).not.toHaveBeenCalled();

    // Coming back without granting: still nothing, and still no prompt.
    await returnToApp();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerApi).not.toHaveBeenCalled();

    permission.granted = true;
    await returnToApp();
    await waitFor(() => expect(registerApi).toHaveBeenCalledWith({ token: "ExponentPushToken[fcm-1]", platform: expect.any(String) }));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("budget alerts setting", () => {
  async function renderSection(enabled = true) {
    const store = storeWithAlerts(enabled);
    await render(
      <Provider store={store}>
        <BudgetAlertsSection />
      </Provider>,
    );
    await waitFor(() => expect(notifications.getPermissionsAsync).toHaveBeenCalled());
    return store;
  }

  it("keeps the saved preference and shows that this device needs permission", async () => {
    const store = await renderSection();
    expect(await screen.findByText(strings.BUDGET_ALERTS_NEEDS_PERMISSION)).toBeTruthy();
    expect(screen.getByTestId("budget-alerts-switch").props.value).toBe(true);
    expect(store.getState().auth.me?.notifications.budgetAlertsEnabled).toBe(true);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("shows no warning when permission is granted or the preference is off", async () => {
    permission.granted = true;
    await renderSection();
    await waitFor(() => expect(screen.queryByTestId("budget-alerts-enable-permission")).toBeNull());

    permission.granted = false;
    await renderSection(false);
    expect(screen.queryByText(strings.BUDGET_ALERTS_NEEDS_PERMISSION)).toBeNull();
  });

  it("Enable asks for permission when the system still can, then registers this install", async () => {
    await renderSection();
    notifications.requestPermissionsAsync.mockImplementationOnce(() => {
      permission.granted = true;
      return Promise.resolve({ ...permission } as Notifications.NotificationPermissionsStatus);
    });
    await fireEvent.press(await screen.findByTestId("budget-alerts-enable-permission"));

    await waitFor(() => expect(registerApi).toHaveBeenCalledTimes(1));
    expect(Linking.openSettings).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(strings.BUDGET_ALERTS_NEEDS_PERMISSION)).toBeNull());
  });

  it("Enable opens system settings when the system no longer shows the prompt", async () => {
    permission.canAskAgain = false;
    await renderSection();
    await fireEvent.press(await screen.findByTestId("budget-alerts-enable-permission"));

    await waitFor(() => expect(Linking.openSettings).toHaveBeenCalledTimes(1));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    // Granted there: the warning goes away on return.
    permission.granted = true;
    await returnToApp();
    await waitFor(() => expect(screen.queryByText(strings.BUDGET_ALERTS_NEEDS_PERMISSION)).toBeNull());
  });
});
