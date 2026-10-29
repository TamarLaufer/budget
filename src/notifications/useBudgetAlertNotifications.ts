import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "../store";
import { periodSelected } from "../store/slices/periodSlice";
import { budgetAlertPeriod, isPushSupported, registerDevice } from "./pushNotifications";

/**
 * Keeps this device registered while budget alerts are enabled, and opens the Monthly Snapshot
 * of the alert's month when a notification is tapped (also when the tap launched the app).
 * `ready` is true once the signed-in user's app screens exist.
 */
export function useBudgetAlertNotifications(ready: boolean): void {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector((s) => s.auth.me?.notifications.budgetAlertsEnabled ?? false);
  const userId = useAppSelector((s) => s.auth.me?.user.id ?? null);
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!ready || !enabled || !userId || !isPushSupported) return;
    // Failures are retried on the next start or token refresh; the setting itself stays on.
    void registerDevice(userId).catch(() => undefined);
    // The event already carries the token: passing it on avoids a fetch that would emit another event.
    const subscription = Notifications.addPushTokenListener(
      (token) => void registerDevice(userId, token).catch(() => undefined),
    );
    return () => subscription.remove();
  }, [ready, enabled, userId]);

  useEffect(() => {
    if (!ready || !response) return;
    const period = budgetAlertPeriod(response.notification.request.content.data);
    if (!period) return;
    Notifications.clearLastNotificationResponse();
    dispatch(periodSelected(period));
    router.navigate("/");
  }, [ready, response, dispatch]);
}
