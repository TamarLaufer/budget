import { getPrisma, type Db } from "../db/prisma.js";

export function list(householdId: string, includeInactive: boolean, db: Db = getPrisma()) {
  return db.category.findMany({
    where: { householdId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { createdAt: "asc" },
  });
}

export function findInHousehold(householdId: string, categoryId: string, db: Db = getPrisma()) {
  return db.category.findFirst({ where: { id: categoryId, householdId } });
}

export function create(householdId: string, name: string, db: Db = getPrisma()) {
  return db.category.create({ data: { householdId, name } });
}

export function createMany(householdId: string, names: readonly string[], db: Db = getPrisma()) {
  return db.category.createMany({ data: names.map((name) => ({ householdId, name })) });
}

export function update(
  categoryId: string,
  data: { name?: string; isActive?: boolean },
  db: Db = getPrisma(),
) {
  return db.category.update({ where: { id: categoryId }, data });
}
