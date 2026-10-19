import { getPrisma, type Db } from "../db/prisma.js";
import type { Role } from "../generated/prisma/enums.js";

export const userSelect = { id: true, email: true, displayName: true } as const;

export function findByUserId(userId: string, db: Db = getPrisma()) {
  return db.householdMember.findUnique({ where: { userId } });
}

export function findByUserIdWithHousehold(userId: string, db: Db = getPrisma()) {
  return db.householdMember.findUnique({ where: { userId }, include: { household: true } });
}

export function listByHousehold(householdId: string, db: Db = getPrisma()) {
  return db.householdMember.findMany({
    where: { householdId },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "asc" },
  });
}

export function findInHousehold(householdId: string, memberId: string, db: Db = getPrisma()) {
  return db.householdMember.findFirst({
    where: { id: memberId, householdId },
    include: { user: { select: userSelect } },
  });
}

export function existsInHouseholdByEmail(householdId: string, email: string, db: Db = getPrisma()) {
  return db.householdMember
    .count({ where: { householdId, user: { email } } })
    .then((count) => count > 0);
}

export function create(
  data: { householdId: string; userId: string; role: Role },
  db: Db = getPrisma(),
) {
  return db.householdMember.create({ data, include: { household: true } });
}

export function updateRole(memberId: string, role: Role, db: Db = getPrisma()) {
  return db.householdMember.update({
    where: { id: memberId },
    data: { role },
    include: { user: { select: userSelect } },
  });
}

export function remove(memberId: string, db: Db = getPrisma()) {
  return db.householdMember.delete({ where: { id: memberId } });
}
