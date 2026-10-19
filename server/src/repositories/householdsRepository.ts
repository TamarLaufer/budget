import { getPrisma, type Db } from "../db/prisma.js";

export function create(data: { name: string; createdByUserId: string }, db: Db = getPrisma()) {
  return db.household.create({ data });
}

export function findById(householdId: string, db: Db = getPrisma()) {
  return db.household.findUnique({ where: { id: householdId } });
}

export function rename(householdId: string, name: string, db: Db = getPrisma()) {
  return db.household.update({ where: { id: householdId }, data: { name } });
}
