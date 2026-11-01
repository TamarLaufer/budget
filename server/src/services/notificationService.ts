import type { NotificationPreferencesDto } from "../../../shared/api.js";
import * as pushDevicesRepository from "../repositories/pushDevicesRepository.js";
import * as usersRepository from "../repositories/usersRepository.js";
import type { AuthContext } from "../types/auth.js";

/** Devices belong to users, not households: who receives an alert is decided at send time. */
export async function registerDevice(
  auth: AuthContext,
  input: { token: string; platform: "android" | "ios" },
): Promise<void> {
  await pushDevicesRepository.upsert({ userId: auth.user.id, expoPushToken: input.token, platform: input.platform });
}

/** Called on sign-out. Removing an unknown token or another user's token is a silent no-op. */
export async function unregisterDevice(auth: AuthContext, token: string): Promise<void> {
  await pushDevicesRepository.removeForUser(auth.user.id, token);
}

export async function updatePreferences(
  auth: AuthContext,
  input: NotificationPreferencesDto,
): Promise<NotificationPreferencesDto> {
  const user = await usersRepository.updateBudgetAlertsEnabled(auth.user.id, input.budgetAlertsEnabled);
  return { budgetAlertsEnabled: user.budgetAlertsEnabled };
}
