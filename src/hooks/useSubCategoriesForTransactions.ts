import { useCallback, useEffect } from "react";
import { shallowEqual } from "react-redux";

import type { TransactionDto } from "../../shared/api";
import { useAppDispatch, useAppSelector, type RootState } from "../store";
import { selectSubCategoryLoad } from "../store/selectors";
import type { RequestStatus } from "../store/shared";
import { fetchSubCategories } from "../store/slices/catalogSlices";

/** Categories of `transactions` whose subcategory is not cached and whose load has `status`. */
function categoriesMissingSubCategories(
  state: RootState,
  transactions: readonly TransactionDto[],
  status: RequestStatus,
): string[] {
  const ids = new Set<string>();
  for (const t of transactions) {
    if (t.categoryId && t.subCategoryId && !state.subCategories.entities[t.subCategoryId]) ids.add(t.categoryId);
  }
  return [...ids].filter((id) => selectSubCategoryLoad(state, id).status === status).sort();
}

/**
 * Loads the subcategory names that `transactions` need (pass a short, memoized list), fetching
 * only the categories whose name is missing. A category is requested once: after a request it is
 * loading, loaded or failed, none of which triggers another. Failures are not retried
 * automatically; call `retryFailed` from an explicit refresh. Unlike the form and category
 * screens, which refetch their category's list on focus, this never refetches names it has.
 */
export function useSubCategoriesForTransactions(transactions: readonly TransactionDto[]) {
  const dispatch = useAppDispatch();
  // shallowEqual keeps the same array while its ids are unchanged, so the effect does not re-run.
  const toLoad = useAppSelector((s) => categoriesMissingSubCategories(s, transactions, "idle"), shallowEqual);
  const failed = useAppSelector((s) => categoriesMissingSubCategories(s, transactions, "failed"), shallowEqual);

  useEffect(() => {
    for (const categoryId of toLoad) void dispatch(fetchSubCategories(categoryId));
  }, [dispatch, toLoad]);

  const retryFailed = useCallback(() => {
    for (const categoryId of failed) void dispatch(fetchSubCategories(categoryId));
  }, [dispatch, failed]);

  return { retryFailed };
}
