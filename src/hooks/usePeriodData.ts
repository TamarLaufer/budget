import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "../store";
import { selectPeriod, selectPeriodLoad } from "../store/selectors";
import { fetchMonthBudgets } from "../store/slices/budgetsSlice";
import { fetchCategories, fetchPaymentMethods } from "../store/slices/catalogSlices";
import { fetchMonthTransactions } from "../store/slices/transactionsSlice";

/**
 * Loads everything the selected month needs: its transactions and budgets plus the household's
 * categories and payment methods. Refetches whenever the screen gains focus or the month
 * changes, so changes made by other household members show up without restarting the app.
 */
export function usePeriodData() {
  const dispatch = useAppDispatch();
  const period = useAppSelector(selectPeriod);
  const load = useAppSelector(selectPeriodLoad);

  const refresh = useCallback(() => {
    void dispatch(fetchMonthTransactions(period));
    void dispatch(fetchMonthBudgets(period));
    void dispatch(fetchCategories());
    void dispatch(fetchPaymentMethods());
  }, [dispatch, period]);

  useFocusEffect(refresh);

  return {
    period,
    load,
    refresh,
    /** Data is on screen and being refetched in the background. */
    refreshing: load.status === "loading" && load.loaded,
  };
}
