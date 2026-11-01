import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { BudgetAlertPushData } from "../../shared/api";
import { api } from "../api/endpoints";
import type { Period } from "../budget/period";
import { strings } from "../strings/he";

/** Must match BUDGET_ALERTS_CHANNEL_ID on the server. */
export const BUDGET_ALERTS_CHANNEL_ID = "budget-alerts";

/** Push needs a native device build; the web build never registers. */
export const isPushSupported = Platform.OS === "android" || Platform.OS === "ios";

/** Show alerts that arrive while the app is open, too. */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** On Android 13+ the channel must exist before the permission prompt can appear. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(BUDGET_ALERTS_CHANNEL_ID, {
    name: strings.BUDGET_ALERTS,
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for permission only if the system still allows asking. */
export async function requestPermission(): Promise<boolean> {
  if (!isPushSupported) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function hasPermission(): Promise<boolean> {
  return isPushSupported && (await Notifications.getPermissionsAsync()).granted;
}

/** What the server currently knows about this device, so unchanged tokens are not re-sent. */
interface Registration {
  userId: string;
  /** The native FCM/APNs token, as delivered by push token events. */
  deviceToken: string;
  expoToken: string;
}

let registered: Registration | null = null;
/** Registration work runs one task at a time, so concurrent callers never race. */
let queue: Promise<void> = Promise.resolve();
/** Bumped on sign-out: tasks queued for the previous session are dropped. */
let session = 0;

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

function easProjectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
}

/**
 * Registers this device's Expo push token with the server for `userId`. Never prompts: call
 * `requestPermission` first. Calls are serialized and skip the request when this user already
 * registered the same token.
 *
 * Pass the token from `addPushTokenListener` as `devicePushToken`. Without it the native token
 * is fetched, and on Android every fetch also emits a push token event — so a listener that
 * fetched again would loop forever.
 */
export function registerDevice(userId: string, devicePushToken?: Notifications.DevicePushToken): Promise<void> {
  const taskSession = session;
  return enqueue(async () => {
    if (taskSession !== session || !(await hasPermission())) return;
    // Already registered for this user and no new token: nothing to verify.
    if (!devicePushToken && registered?.userId === userId) return;

    const deviceToken = devicePushToken ?? (await Notifications.getDevicePushTokenAsync());
    if (typeof deviceToken.data !== "string") return;
    if (registered?.userId === userId && registered.deviceToken === deviceToken.data) return;

    await ensureChannel();
    const projectId = easProjectId();
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
      devicePushToken: deviceToken,
    });
    if (taskSession !== session) return;
    await api.notifications.registerDevice({ token: expoToken, platform: Platform.OS === "ios" ? "ios" : "android" });
    registered = { userId, deviceToken: deviceToken.data, expoToken };
  });
}

/**
 * Best effort, during sign-out: the server stops sending to this device for this account.
 * Waits for a registration already in progress, and cancels any still queued.
 */
export function unregisterDevice(): Promise<void> {
  session += 1;
  return enqueue(async () => {
    const current = registered;
    registered = null;
    if (current) await api.notifications.unregisterDevice(current.expoToken);
  });
}

/** Reads the month a budget alert refers to; null for anything else. */
export function budgetAlertPeriod(data: unknown): Period | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, year, month } = data as Partial<BudgetAlertPushData>;
  if (type !== "budget-alert" || !Number.isInteger(year) || !Number.isInteger(month)) return null;
  if ((month as number) < 1 || (month as number) > 12) return null;
  return { year: year as number, month: month as number };
}
