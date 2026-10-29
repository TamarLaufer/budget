import { z } from "zod";

/** Expo push tokens look like "ExponentPushToken[xxxxxxxx]" (older SDKs: "ExpoPushToken[...]"). */
export const expoPushTokenSchema = z
  .string()
  .max(200)
  .regex(/^Expo(nent)?PushToken\[[^\]\s]+\]$/, "Must be an Expo push token");

export const registerDeviceSchema = z.strictObject({
  token: expoPushTokenSchema,
  platform: z.enum(["android", "ios"]),
});

export const unregisterDeviceSchema = z.strictObject({ token: expoPushTokenSchema });

export const updateNotificationPreferencesSchema = z.strictObject({ budgetAlertsEnabled: z.boolean() });
