import { getPrisma, type Db } from "../db/prisma.js";
import type { InvitationStatus, Role } from "../generated/prisma/enums.js";
import { userSelect } from "./membersRepository.js";

const withInviter = { invitedBy: { select: userSelect } } as const;

export function create(
  data: { householdId: string; email: string; role: Role; invitedByUserId: string; expiresAt: Date },
  db: Db = getPrisma(),
) {
  return db.invitation.create({ data, include: withInviter });
}

const HOUSEHOLD_LIST_LIMIT = 50;

export function listForHousehold(householdId: string, db: Db = getPrisma()) {
  return db.invitation.findMany({
    where: { householdId },
    include: withInviter,
    orderBy: { createdAt: "desc" },
    take: HOUSEHOLD_LIST_LIMIT,
  });
}

export function findInHousehold(householdId: string, invitationId: string, db: Db = getPrisma()) {
  return db.invitation.findFirst({ where: { id: invitationId, householdId } });
}

/** Pending, unexpired invitations addressed to `email`. */
export function listPendingForEmail(email: string, now: Date, db: Db = getPrisma()) {
  return db.invitation.findMany({
    where: { email, status: "PENDING", expiresAt: { gt: now } },
    include: { ...withInviter, household: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** An invitation is only visible to the recipient it is addressed to. */
export function findForRecipient(invitationId: string, email: string, db: Db = getPrisma()) {
  return db.invitation.findFirst({ where: { id: invitationId, email } });
}

export function expireStalePending(householdId: string, email: string, now: Date, db: Db = getPrisma()) {
  return db.invitation.updateMany({
    where: { householdId, email, status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

/**
 * Moves a PENDING invitation to `status`. Returns false if it was no longer pending, which makes
 * concurrent accept/decline/revoke of the same invitation safe: only one can win.
 */
export async function transitionFromPending(
  invitationId: string,
  status: InvitationStatus,
  db: Db = getPrisma(),
): Promise<boolean> {
  const result = await db.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status },
  });
  return result.count === 1;
}
