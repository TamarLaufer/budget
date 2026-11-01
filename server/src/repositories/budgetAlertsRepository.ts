import { getPrisma, type Db } from "../db/prisma.js";

export interface BudgetAlertKey {
  householdId: string;
  categoryId: string;
  year: number;
  month: number;
}

/**
 * Records that `threshold` was reached. Returns true only for the single caller whose insert
 * created the row; concurrent or repeated callers get false (ON CONFLICT DO NOTHING).
 */
export async function claim(key: BudgetAlertKey, threshold: number, db: Db = getPrisma()): Promise<boolean> {
  const { count } = await db.budgetAlert.createMany({ data: [{ ...key, threshold }], skipDuplicates: true });
  return count === 1;
}
