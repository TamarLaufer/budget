import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { isPushSupported } from "./pushNotifications";

export interface NotificationPermission {
  granted: boolean;
  /** False once the system no longer shows the prompt; only system settings can grant it then. */
  canAskAgain: boolean;
}

/** null where push is unsupported or the read fails (the next foreground event tries again). */
async function readPermission(): Promise<NotificationPermission | null> {
  if (!isPushSupported) return null;
  try {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted, canAskAgain };
  } catch {
    return null;
  }
}

/**
 * The device's current notification permission, read on mount and whenever the app returns to
 * the foreground (e.g. from system settings). Never prompts. null until first read, and always
 * null where push is unsupported.
 */
export function useNotificationPermission(): {
  permission: NotificationPermission | null;
  recheck: () => Promise<unknown>;
} {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  const recheck = useCallback(
    () => readPermission().then((current) => current && setPermission(current)),
    [],
  );

  useEffect(() => {
    let active = true;
    const update = () => readPermission().then((current) => active && current && setPermission(current));
    void update();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void update();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return { permission, recheck };
}
