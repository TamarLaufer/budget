import { getPrisma, type Db } from "../db/prisma.js";

/**
 * Registers a device for `userId`. A token is unique: if another account registered it before
 * (same phone, different sign-in), it moves to this user so the previous account stops receiving.
 */
export function upsert(data: { userId: string; expoPushToken: string; platform: string }, db: Db = getPrisma()) {
  const { userId, expoPushToken, platform } = data;
  return db.pushDevice.upsert({
    where: { expoPushToken },
    create: data,
    update: { userId, platform },
  });
}

/** Removes the token only if it belongs to `userId`. */
export function removeForUser(userId: string, expoPushToken: string, db: Db = getPrisma()) {
  return db.pushDevice.deleteMany({ where: { userId, expoPushToken } });
}

export function removeTokens(expoPushTokens: string[], db: Db = getPrisma()) {
  return db.pushDevice.deleteMany({ where: { expoPushToken: { in: expoPushTokens } } });
}

/**
 * Devices of the household's *current* members who opted in to budget alerts. Membership is
 * checked at send time, so a user who left the household receives nothing more from it.
 */
export function listBudgetAlertRecipients(householdId: string, db: Db = getPrisma()) {
  return db.pushDevice.findMany({
    where: { user: { budgetAlertsEnabled: true, membership: { is: { householdId } } } },
    select: { expoPushToken: true },
  });
}
