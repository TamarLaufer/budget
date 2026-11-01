import type { CategoryDto, MonthlyBudgetDto, TransactionDto } from "../../shared/api";
import { format } from "../strings/format";
import { strings } from "../strings/he";
import { type Agorot } from "./money";
import type {
  BudgetCategory,
  BudgetUsage,
  CategorySummary,
  MonthlyDashboard,
  MonthlySnapshot,
} from "./types";

/*
 * Pure financial calculations. All amounts are integer agorot; only percentUsed/fill are ratios
 * and they are never fed back into money values. Callers pass transactions/budgets that are
 * already limited to one month (see the period selectors).
 */

type TransactionLike = Pick<TransactionDto, "type" | "amountAgorot" | "categoryId">;

export function calculateUsage(budget: Agorot, spent: Agorot): BudgetUsage {
  const remaining = budget - spent;
  // A zero budget with any spending counts as fully used.
  const ratio = budget > 0 ? spent / budget : spent > 0 ? 1 : 0;

  return {
    budget,
    spent,
    remaining,
    percentUsed: Math.round(ratio * 100),
    fill: Math.min(Math.max(ratio, 0), 1),
    isOver: remaining < 0,
  };
}

/**
 * Usage of spending with no budget configured: nothing to compare against, so never over budget.
 * An explicit budget of 0 is still a budget and goes through calculateUsage.
 */
export function unbudgetedUsage(spent: Agorot): BudgetUsage {
  return { budget: 0, spent, remaining: 0, percentUsed: 0, fill: 0, isOver: false };
}

/** Sum of expenses per category id. Income is ignored. */
export function spentByCategory(transactions: readonly TransactionLike[]): Map<string, Agorot> {
  const totals = new Map<string, Agorot>();
  for (const t of transactions) {
    if (t.type === "EXPENSE" && t.categoryId) {
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountAgorot);
    }
  }
  return totals;
}

export function totalIncome(transactions: readonly TransactionLike[]): Agorot {
  return transactions.reduce((sum, t) => (t.type === "INCOME" ? sum + t.amountAgorot : sum), 0);
}

/**
 * Joins categories with one month's budgets and transactions. Active categories always appear;
 * inactive ones only when that month still has a budget or spending for them, so history stays
 * accurate after a category is deactivated.
 */
export function buildCategoryBudgets(
  categories: readonly Pick<CategoryDto, "id" | "name" | "isActive">[],
  budgets: readonly Pick<MonthlyBudgetDto, "categoryId" | "amountAgorot">[],
  transactions: readonly TransactionLike[],
): BudgetCategory[] {
  const spent = spentByCategory(transactions);
  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b.amountAgorot]));

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      isActive: category.isActive,
      budget: budgetByCategory.get(category.id) ?? 0,
      spent: spent.get(category.id) ?? 0,
      hasBudget: budgetByCategory.has(category.id),
    }))
    .filter((c) => c.isActive || c.budget > 0 || c.spent > 0);
}

export function buildMonthlySnapshot(categories: BudgetCategory[]): MonthlySnapshot {
  let totalBudget: Agorot = 0;
  let totalSpent: Agorot = 0;
  let anyBudget = false;

  for (const category of categories) {
    totalBudget += category.budget;
    // Spending without a budget still counts toward the month's expenses.
    totalSpent += category.spent;
    anyBudget ||= category.hasBudget;
  }

  return {
    totals: anyBudget ? calculateUsage(totalBudget, totalSpent) : unbudgetedUsage(totalSpent),
    categories: categories.map((category) => ({
      ...category,
      ...(category.hasBudget ? calculateUsage(category.budget, category.spent) : unbudgetedUsage(category.spent)),
    })),
  };
}

type ActivityLike = TransactionLike & Pick<TransactionDto, "createdAt" | "updatedAt">;

/**
 * Latest entry time (creation or last edit, in ms) of each category's expenses. Uses the record
 * timestamps, not transactionDate: a back-dated expense entered today is recent activity.
 */
export function lastExpenseActivityByCategory(transactions: readonly ActivityLike[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const t of transactions) {
    // Same inclusion rule as spentByCategory.
    if (t.type !== "EXPENSE" || !t.categoryId) continue;
    const at = Math.max(Date.parse(t.createdAt), Date.parse(t.updatedAt));
    if (Number.isNaN(at)) continue;
    if (at > (latest.get(t.categoryId) ?? -Infinity)) latest.set(t.categoryId, at);
  }
  return latest;
}

/**
 * Dashboard display order, returned as a new array: active over-budget categories by overspend
 * (largest first), then the other active categories by latest expense activity (newest first,
 * no activity last), then inactive categories ordered the same way. Ties go by name, then id.
 */
export function orderSnapshotCategories<C extends Pick<CategorySummary, "id" | "name" | "isActive" | "isOver" | "remaining">>(
  categories: readonly C[],
  lastActivity: ReadonlyMap<string, number>,
): C[] {
  const rank = (c: C) => (c.isActive ? 0 : 2) + (c.isOver ? 0 : 1);
  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  return [...categories].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (a.isOver) {
      // remaining is negative when over: the more negative, the larger the overspend.
      const byOverspend = a.remaining - b.remaining;
      if (byOverspend !== 0) return byOverspend;
    } else {
      const byActivity = (lastActivity.get(b.id) ?? -Infinity) - (lastActivity.get(a.id) ?? -Infinity);
      if (byActivity !== 0 && !Number.isNaN(byActivity)) return byActivity;
    }
    return byText(a.name, b.name) || byText(a.id, b.id);
  });
}

export function buildMonthlyDashboard(
  categories: readonly Pick<CategoryDto, "id" | "name" | "isActive">[],
  budgets: readonly Pick<MonthlyBudgetDto, "categoryId" | "amountAgorot">[],
  transactions: readonly TransactionLike[],
): MonthlyDashboard {
  const snapshot = buildMonthlySnapshot(buildCategoryBudgets(categories, budgets, transactions));
  const income = totalIncome(transactions);
  return {
    snapshot,
    totalIncome: income,
    net: income - snapshot.totals.spent,
    transactionCount: transactions.length,
  };
}

// Indexed by Date.getMonth() (0 = January).
const MONTHS_BY_INDEX: readonly string[] = [
  strings.MONTHS.JANUARY,
  strings.MONTHS.FEBRUARY,
  strings.MONTHS.MARCH,
  strings.MONTHS.APRIL,
  strings.MONTHS.MAY,
  strings.MONTHS.JUNE,
  strings.MONTHS.JULY,
  strings.MONTHS.AUGUST,
  strings.MONTHS.SEPTEMBER,
  strings.MONTHS.OCTOBER,
  strings.MONTHS.NOVEMBER,
  strings.MONTHS.DECEMBER,
];

export function formatMonthYear(date: Date): string {
  return format(strings.MONTH_YEAR, {
    month: MONTHS_BY_INDEX[date.getMonth()] ?? "",
    year: date.getFullYear(),
  });
}
