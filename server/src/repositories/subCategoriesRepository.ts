import { getPrisma, type Db } from "../db/prisma.js";

export function findInHousehold(
  householdId: string,
  subCategoryId: string,
  db: Db = getPrisma(),
) {
  return db.subCategory.findFirst({
    where: {
      id: subCategoryId,
      category: {
        householdId,
      },
    },
  });
}

export function list(
  householdId: string,
  categoryId: string,
  includeInactive: boolean,
  db: Db = getPrisma(),
) {
  return db.subCategory.findMany({
    where: {
      categoryId,
      category: { householdId },
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function create(
  householdId: string,
  categoryId: string,
  name: string,
  db: Db = getPrisma(),
) {
  return db.subCategory.create({
    data: {
      name,
      category: {
        connect: { id: categoryId, householdId },
      },
    },
  });
}

/** Callers must first confirm the subcategory belongs to their household (findInHousehold). */
export function update(
  subCategoryId: string,
  data: { name?: string; isActive?: boolean },
  db: Db = getPrisma(),
) {
  return db.subCategory.update({ where: { id: subCategoryId }, data });
}
