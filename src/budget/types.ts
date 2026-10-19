import type { Agorot } from "./money";

/** A category's budget and spending for one month: the input to the usage calculations. */
export interface BudgetCategory {
  id: string;
  name: string;
  budget: Agorot;
  spent: Agorot;
  /** False for deactivated categories still shown because the month has data for them. */
  isActive: boolean;
}

export interface BudgetUsage {
  budget: Agorot;
  spent: Agorot;
  /** budget - spent; negative when over budget. */
  remaining: Agorot;
  /** Rounded percent of the budget spent; may exceed 100. */
  percentUsed: number;
  /** Progress bar fill between 0 and 1. */
  fill: number;
  isOver: boolean;
}

export type CategorySummary = BudgetCategory & BudgetUsage;

export interface MonthlySnapshot {
  totals: BudgetUsage;
  categories: CategorySummary[];
}

export interface MonthlyDashboard {
  snapshot: MonthlySnapshot;
  totalIncome: Agorot;
  /** income - expenses for the month. */
  net: Agorot;
  transactionCount: number;
}
