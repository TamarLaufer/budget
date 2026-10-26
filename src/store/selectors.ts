import { createSelector } from "@reduxjs/toolkit";

import type { Role } from "../../shared/api";
import { buildMonthlyDashboard } from "../budget/calculations";
import { isDateInPeriod, periodKey } from "../budget/period";
import type { RootState } from "./index";
import { idleLoad, type LoadState } from "./shared";
import { budgetsAdapter } from "./slices/budgetsSlice";
import { categoriesAdapter, paymentMethodsAdapter } from "./slices/catalogSlices";
import { transactionsAdapter } from "./slices/transactionsSlice";

/*
 * Derived values (spending, remaining, percentages, totals) are computed here from the stored
 * records and never written back into the store.
 */

export const transactionSelectors = transactionsAdapter.getSelectors((s: RootState) => s.transactions);
export const categorySelectors = categoriesAdapter.getSelectors((s: RootState) => s.categories);
export const budgetSelectors = budgetsAdapter.getSelectors((s: RootState) => s.budgets);
export const paymentMethodSelectors = paymentMethodsAdapter.getSelectors((s: RootState) => s.paymentMethods);

export const selectPeriod = (s: RootState) => s.period;

export const selectTransactionsForPeriod = createSelector(
  [transactionSelectors.selectAll, selectPeriod],
  (transactions, period) => transactions.filter((t) => isDateInPeriod(t.transactionDate, period)),
);

export const selectBudgetsForPeriod = createSelector(
  [budgetSelectors.selectAll, selectPeriod],
  (budgets, period) => budgets.filter((b) => b.year === period.year && b.month === period.month),
);

export const selectActiveCategories = createSelector([categorySelectors.selectAll], (categories) =>
  categories.filter((c) => c.isActive),
);

export const selectActivePaymentMethods = createSelector([paymentMethodSelectors.selectAll], (methods) =>
  methods.filter((m) => m.isActive),
);

export const selectDashboard = createSelector(
  [categorySelectors.selectAll, selectBudgetsForPeriod, selectTransactionsForPeriod],
  buildMonthlyDashboard,
);

/** The data sets screens load; transactions and budgets are per month. */
export type Dataset = "transactions" | "budgets" | "categories" | "paymentMethods";

/** Load state of one data set, for the selected month where it applies. */
export function selectLoad(s: RootState, dataset: Dataset): LoadState {
  switch (dataset) {
    case "transactions":
      return s.transactions.months[periodKey(s.period)] ?? idleLoad;
    case "budgets":
      return s.budgets.months[periodKey(s.period)] ?? idleLoad;
    case "categories":
      return s.categories.load;
    case "paymentMethods":
      return s.paymentMethods.load;
  }
}

export type CombinedLoad = Pick<LoadState, "status" | "error" | "loaded">;

/** Combined load state of the data sets a screen shows. */
export function combineLoads(loads: readonly LoadState[]): CombinedLoad {
  const loaded = loads.every((l) => l.loaded);
  const failed = loads.find((l) => l.status === "failed");
  if (failed) return { status: "failed", error: failed.error, loaded };
  if (loads.every((l) => l.status === "succeeded")) return { status: "succeeded", error: null, loaded };
  return { status: "loading", error: null, loaded };
}

export const selectMembership = (s: RootState) => s.auth.me?.membership ?? null;
export const selectRole = (s: RootState): Role | null => s.auth.me?.membership?.role ?? null;
export const selectCanManage = (s: RootState) => {
  const role = selectRole(s);
  return role === "OWNER" || role === "ADMIN";
};

export type AppPhase = "initializing" | "signedOut" | "loadingProfile" | "profileError" | "onboarding" | "ready";

/** Which part of the app the user may see; drives the route guards. */
export const selectAppPhase = (s: RootState): AppPhase => {
  const { status, me, meStatus } = s.auth;
  if (status === "initializing") return "initializing";
  if (status === "signedOut") return "signedOut";
  if (!me) return meStatus === "failed" ? "profileError" : "loadingProfile";
  return me.membership ? "ready" : "onboarding";
};
