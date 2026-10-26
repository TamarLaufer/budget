import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shallowEqual } from "react-redux";

import type { Period } from "../budget/period";
import { useAppDispatch, useAppSelector, type AppDispatch } from "../store";
import { combineLoads, selectLoad, selectPeriod, type Dataset } from "../store/selectors";
import { fetchMonthBudgets } from "../store/slices/budgetsSlice";
import { fetchCategories, fetchPaymentMethods } from "../store/slices/catalogSlices";
import { fetchMonthTransactions } from "../store/slices/transactionsSlice";

function fetchDataset(dispatch: AppDispatch, dataset: Dataset, period: Period, force: boolean) {
  switch (dataset) {
    case "transactions":
      return dispatch(fetchMonthTransactions({ ...period, force }));
    case "budgets":
      return dispatch(fetchMonthBudgets({ ...period, force }));
    case "categories":
      return dispatch(fetchCategories({ force }));
    case "paymentMethods":
      return dispatch(fetchPaymentMethods({ force }));
  }
}

/**
 * Loads the data sets a screen shows (pass a constant array). Data already in the store is
 * reused: when the screen gains focus or the month changes, each data set is fetched only if it
 * is missing, stale or older than the freshness limit. The fetch thunks make that decision and
 * skip requests already in flight, so changes by other household members show up without
 * refetching everything on every tab switch.
 */
export function useScreenData(datasets: readonly Dataset[]) {
  const dispatch = useAppDispatch();
  const period = useAppSelector(selectPeriod);
  const loads = useAppSelector((s) => datasets.map((dataset) => selectLoad(s, dataset)), shallowEqual);
  const load = useMemo(() => combineLoads(loads), [loads]);

  const fetchAll = useCallback(
    (force: boolean) => Promise.all(datasets.map((dataset) => fetchDataset(dispatch, dataset, period, force))),
    [datasets, dispatch, period],
  );

  // Wait one frame: dispatching inside the focus effect re-renders synchronously within the
  // tab press's commit and holds back the frame that shows the newly selected tab.
  useFocusEffect(
    useCallback(() => {
      const frame = requestAnimationFrame(() => void fetchAll(false));
      return () => cancelAnimationFrame(frame);
    }, [fetchAll]),
  );

  // While the screen is open, fetch shown data again as soon as it is marked stale (the app came
  // back to the foreground) or a response for it was dropped. First loads are left to the focus
  // effect, and failures do not trigger this, so a failing request is not retried in a loop.
  // isFocused() is read rather than subscribed to, so focus changes do not re-render the screen.
  const navigation = useNavigation();
  const needsRecheck = loads.some((l) => l.loaded && (l.status === "idle" || (l.status === "succeeded" && l.stale)));
  useEffect(() => {
    if (needsRecheck && navigation.isFocused()) void fetchAll(false);
  }, [needsRecheck, navigation, fetchAll]);

  // The spinner shows refreshes the user started; background fetches keep the content as it is.
  // A pull ends when its requests (or ones already in flight when it started) have finished.
  const [pulled, setPulled] = useState(false);
  const loading = loads.some((l) => l.status === "loading");
  if (pulled && !loading) setPulled(false);

  const refresh = useCallback(() => {
    setPulled(true);
    void fetchAll(true);
  }, [fetchAll]);

  return { period, load, refresh, refreshing: pulled && loading };
}
