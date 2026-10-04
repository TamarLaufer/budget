import { useMonthlyBudgetSummary } from "../hooks/useMonthlyBudgetSummary";
import { format } from "../strings/format";
import { strings } from "../strings/he";
import { shekelsToAgorot, type Agorot } from "./money";
import type {
  BudgetCategory,
  BudgetUsage,
  CategorySummary,
  MonthlySnapshot,
} from "./types";

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

export function buildMonthlySnapshot(
  categories: BudgetCategory[],
): MonthlySnapshot {
  let totalBudget: Agorot = 0;
  let totalSpent: Agorot = 0;

  for (const category of categories) {
    totalBudget += category.budget;
    totalSpent += category.spent;
  }

  return {
    totals: calculateUsage(totalBudget, totalSpent),
    categories: categories.map((category) => ({
      ...category,
      ...calculateUsage(category.budget, category.spent),
    })),
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
    month: MONTHS_BY_INDEX[date.getMonth()],
    year: date.getFullYear(),
  });
}

