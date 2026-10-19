import { getPrisma, type Db } from "../db/prisma.js";

export async function findOrCreateByFirebaseUid(input: { firebaseUid: string; email: string }) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { firebaseUid: input.firebaseUid } });
  if (existing) {
    // Keep the email in sync with Firebase (e.g. after the user changes it there).
    if (existing.email !== input.email) {
      return prisma.user.update({ where: { id: existing.id }, data: { email: input.email } });
    }
    return existing;
  }
  // upsert (not create) so two concurrent first requests cannot both insert.
  return prisma.user.upsert({
    where: { firebaseUid: input.firebaseUid },
    create: { firebaseUid: input.firebaseUid, email: input.email },
    update: {},
  });
}

export function updateDisplayName(userId: string, displayName: string | null, db: Db = getPrisma()) {
  return db.user.update({ where: { id: userId }, data: { displayName } });
}
