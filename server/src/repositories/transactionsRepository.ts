import { getPrisma, type Db } from "../db/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { TransactionType } from "../generated/prisma/enums.js";
import { userSelect } from "./membersRepository.js";

const withCreator = { createdBy: { select: userSelect } } as const;

/** Upper bound on list size so a single request cannot pull an unbounded result set. */
export const TRANSACTION_LIST_LIMIT = 1000;

export interface TransactionFilter {
  dateRange?: { gte: Date; lt: Date };
  categoryId?: string;
  type?: TransactionType;
  search?: string;
}

export function list(householdId: string, filter: TransactionFilter, db: Db = getPrisma()) {
  const where: Prisma.TransactionWhereInput = {
    householdId,
    ...(filter.dateRange ? { transactionDate: filter.dateRange } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.search
      ? {
          OR: [
            { description: { contains: filter.search, mode: "insensitive" } },
            { incomeSource: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.transaction.findMany({
    where,
    include: withCreator,
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: TRANSACTION_LIST_LIMIT,
  });
}

export function findInHousehold(householdId: string, transactionId: string, db: Db = getPrisma()) {
  return db.transaction.findFirst({ where: { id: transactionId, householdId }, include: withCreator });
}

export interface TransactionData {
  type: TransactionType;
  amountAgorot: number;
  categoryId: string | null;
  description: string | null;
  transactionDate: Date;
  paymentMethodId: string | null;
  incomeSource: string | null;
}

export function create(
  householdId: string,
  createdByUserId: string,
  data: TransactionData,
  db: Db = getPrisma(),
) {
  return db.transaction.create({
    data: { ...data, householdId, createdByUserId },
    include: withCreator,
  });
}

export function update(transactionId: string, data: TransactionData, db: Db = getPrisma()) {
  return db.transaction.update({ where: { id: transactionId }, data, include: withCreator });
}

export function remove(transactionId: string, db: Db = getPrisma()) {
  return db.transaction.delete({ where: { id: transactionId } });
}

/** Total expenses of one category within a date range, in agorot. Income never counts. */
export async function sumExpenses(
  householdId: string,
  categoryId: string,
  dateRange: { gte: Date; lt: Date },
  db: Db = getPrisma(),
): Promise<number> {
  const result = await db.transaction.aggregate({
    where: { householdId, categoryId, type: "EXPENSE", transactionDate: dateRange },
    _sum: { amountAgorot: true },
  });
  return result._sum.amountAgorot ?? 0;
}
