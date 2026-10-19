import { router } from "expo-router";
import { useState } from "react";

import { errorMessage } from "../../api/errorMessage";
import { formatAgorot } from "../../budget/money";
import { periodToDate } from "../../budget/period";
import { BudgetSummary } from "../../components/BudgetSummary/BudgetSummary";
import { CategoryCard } from "../../components/CategoryCard/CategoryCard";
import Header from "../../components/Header/Header";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorBanner, ErrorView, LoadingView } from "../../components/ui/Feedback";
import { ScrollScreen } from "../../components/ui/Layout";
import { usePeriodData } from "../../hooks/usePeriodData";
import { useSelectedCategory } from "../../hooks/useSelectedCategory";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectCanManage, selectDashboard } from "../../store/selectors";
import { periodShifted } from "../../store/slices/periodSlice";
import { strings } from "../../strings/he";
import { colors } from "../../theme";
import {
  IncomeLabel,
  IncomeRow,
  IncomeValue,
  SectionTitle,
  SectionTitleContainer,
  ShowAllPress,
  ShowAllText,
} from "./MonthlySnapshotScreen.styles";

/** Monthly dashboard: every number is derived from the month's real transactions and budgets. */
const MonthlySnapshotScreen = () => {
  const dispatch = useAppDispatch();
  const { period, load, refresh, refreshing } = usePeriodData();
  const dashboard = useAppSelector(selectDashboard);
  const canManage = useAppSelector(selectCanManage);
  const { snapshot } = dashboard;

  const { categorySetState, selectedCategoryId, clearSelectedId } = useSelectedCategory();
  const [showOverBudgetOnly, setShowOverBudgetOnly] = useState(false);

  if (!load.loaded && load.status === "failed") {
    return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  }
  if (!load.loaded) return <LoadingView />;

  const selectedCategory = snapshot.categories.find((c) => c.id === selectedCategoryId);

  const toggleCategories = () => {
    if (!showOverBudgetOnly && selectedCategory && !selectedCategory.isOver) {
      clearSelectedId();
    }
    setShowOverBudgetOnly((prev) => !prev);
  };

  const categoriesToDisplay = showOverBudgetOnly
    ? snapshot.categories.filter((category) => category.isOver)
    : snapshot.categories;

  const selectCategory = (categoryId: string) => {
    if (selectedCategoryId === categoryId) clearSelectedId();
    else categorySetState(categoryId);
  };

  return (
    <ScrollScreen withTopInset refreshing={refreshing} onRefresh={refresh}>
      <Header
        month={periodToDate(period)}
        onPrevious={() => dispatch(periodShifted(-1))}
        onNext={() => dispatch(periodShifted(1))}
      />

      {/* Stale data stays visible when a background refresh fails. */}
      <ErrorBanner message={load.status === "failed" ? errorMessage(load.error) : null} onRetry={refresh} />

      <BudgetSummary totals={snapshot.totals} />

      <IncomeRow>
        <IncomeLabel>{strings.INCOME}</IncomeLabel>
        <IncomeValue $color={colors.success}>{formatAgorot(dashboard.totalIncome)}</IncomeValue>
        <IncomeLabel>{strings.NET}</IncomeLabel>
        <IncomeValue $color={dashboard.net < 0 ? colors.danger : colors.success}>{formatAgorot(dashboard.net)}</IncomeValue>
      </IncomeRow>

      <Button label={strings.ADD_TRANSACTION} onPress={() => router.push("/transaction/new")} testID="add-transaction" />

      <SectionTitleContainer>
        <SectionTitle accessibilityRole="header">{strings.CATEGORIES}</SectionTitle>
      </SectionTitleContainer>

      {snapshot.categories.length === 0 ? (
        <EmptyState title={strings.NO_CATEGORIES} hint={strings.NO_CATEGORIES_HINT} />
      ) : (
        <>
          <ShowAllPress onPress={toggleCategories} accessibilityRole="button">
            <ShowAllText>{showOverBudgetOnly ? strings.SHOW_ALL : strings.SHOW_OVER_BUDGET_ONLY}</ShowAllText>
          </ShowAllPress>
          {categoriesToDisplay.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onPress={() => selectCategory(category.id)}
              isSelected={selectedCategoryId === category.id}
            />
          ))}
        </>
      )}

      {canManage ? (
        <Button label={strings.EDIT_BUDGETS} variant="secondary" onPress={() => router.push("/budgets")} />
      ) : null}
    </ScrollScreen>
  );
};

export default MonthlySnapshotScreen;
