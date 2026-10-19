import { getPrisma, type Db } from "../db/prisma.js";

export function list(householdId: string, includeInactive: boolean, db: Db = getPrisma()) {
  return db.paymentMethod.findMany({
    where: { householdId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { createdAt: "asc" },
  });
}

export function findInHousehold(householdId: string, paymentMethodId: string, db: Db = getPrisma()) {
  return db.paymentMethod.findFirst({ where: { id: paymentMethodId, householdId } });
}

export function create(householdId: string, name: string, db: Db = getPrisma()) {
  return db.paymentMethod.create({ data: { householdId, name } });
}

export function update(
  paymentMethodId: string,
  data: { name?: string; isActive?: boolean },
  db: Db = getPrisma(),
) {
  return db.paymentMethod.update({ where: { id: paymentMethodId }, data });
}
