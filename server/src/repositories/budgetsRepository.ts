import { getPrisma, type Db } from "../db/prisma.js";

export function listForMonth(householdId: string, year: number, month: number, db: Db = getPrisma()) {
  return db.monthlyBudget.findMany({
    where: { householdId, year, month },
    orderBy: { createdAt: "asc" },
  });
}

export function findInHousehold(householdId: string, budgetId: string, db: Db = getPrisma()) {
  return db.monthlyBudget.findFirst({ where: { id: budgetId, householdId } });
}

/** Creates or replaces the budget of one category for one month. Other months are untouched. */
export function upsert(
  data: { householdId: string; categoryId: string; year: number; month: number; amountAgorot: number },
  db: Db = getPrisma(),
) {
  const { householdId, categoryId, year, month, amountAgorot } = data;
  return db.monthlyBudget.upsert({
    where: { householdId_categoryId_year_month: { householdId, categoryId, year, month } },
    create: data,
    update: { amountAgorot },
  });
}

export function updateAmount(budgetId: string, amountAgorot: number, db: Db = getPrisma()) {
  return db.monthlyBudget.update({ where: { id: budgetId }, data: { amountAgorot } });
}

export function remove(budgetId: string, db: Db = getPrisma()) {
  return db.monthlyBudget.delete({ where: { id: budgetId } });
}

export function findForCategoryMonth(
  householdId: string,
  categoryId: string,
  year: number,
  month: number,
  db: Db = getPrisma(),
) {
  return db.monthlyBudget.findUnique({
    where: { householdId_categoryId_year_month: { householdId, categoryId, year, month } },
  });
}
