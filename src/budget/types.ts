import type { Agorot } from "./money";

export interface BudgetCategory {
  id: string;
  name: string;
  budget: Agorot;
  spent: Agorot;
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
