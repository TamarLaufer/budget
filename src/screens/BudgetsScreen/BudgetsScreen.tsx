import { Stack } from "expo-router";
import { errorMessage } from "../../api/errorMessage";
import { periodToDate } from "../../budget/period";
import Header from "../../components/Header/Header";
import { EmptyState, ErrorView, LoadingView } from "../../components/ui/Feedback";
import { ScrollScreen } from "../../components/ui/Layout";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectCanManage, selectActiveCategories, selectBudgetsForPeriod, type Dataset } from "../../store/selectors";
import { periodShifted } from "../../store/slices/periodSlice";
import { strings } from "../../strings/he";
import { BudgetRow } from "@/components/BudgetRow/BudgetRow";

/** What this screen shows; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["budgets", "categories"];

/** Per-category budgets for the selected month. Saving one month never changes another. */
export default function BudgetsScreen() {
  const dispatch = useAppDispatch();
  const { period, load, refresh, refreshing } = useScreenData(DATASETS);
  const categories = useAppSelector(selectActiveCategories);
  const budgets = useAppSelector(selectBudgetsForPeriod);
  const canManage = useAppSelector(selectCanManage);

  if (!load.loaded && load.status === "failed") return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  if (!load.loaded) return <LoadingView />;

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refresh} avoidKeyboard>
      <Stack.Screen options={{ title: strings.BUDGETS_TITLE }} />
      <Header
        title={strings.BUDGETS_TITLE}
        month={periodToDate(period)}
        onPrevious={() => dispatch(periodShifted(-1))}
        onNext={() => dispatch(periodShifted(1))}
      />
      {categories.length === 0 ? <EmptyState title={strings.NO_CATEGORIES} hint={strings.NO_CATEGORIES_HINT} /> : null}
      {categories.map((category) => (
        // Keyed by month too, so the inputs reset when switching months.
        <BudgetRow
          key={`${category.id}:${period.year}-${period.month}`}
          category={category}
          period={period}
          budget={budgetByCategory.get(category.id)}
          canManage={canManage}
        />
      ))}
    </ScrollScreen>
  );
}

