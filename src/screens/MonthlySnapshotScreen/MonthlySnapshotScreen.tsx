import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildMonthlySnapshot, formatMonthYear } from "../../budget/calculations";
import type { BudgetCategory } from "../../budget/types";
import { BudgetSummary } from "../../components/BudgetSummary/BudgetSummary";
import { CategoryCard } from "../../components/CategoryCard/CategoryCard";
import { strings } from "../../strings/he";
import { Header, Month, Screen, SectionTitle, Title } from "./MonthlySnapshotScreen.styles";

interface MonthlySnapshotScreenProps {
  categories: BudgetCategory[];
  month: Date;
}

export function MonthlySnapshotScreen({
  categories,
  month,
}: MonthlySnapshotScreenProps) {
  const insets = useSafeAreaInsets();
  
  const snapshot = useMemo(
    () => buildMonthlySnapshot(categories),
    [categories],
  );

  return (
    <Screen $insets={insets}>
      <Header>
        <Title accessibilityRole="header">{strings.MY_BUDGET}</Title>
        <Month>{formatMonthYear(month)}</Month>
      </Header>

      <BudgetSummary totals={snapshot.totals} />

      <SectionTitle accessibilityRole="header">{strings.CATEGORIES}</SectionTitle>
      {snapshot.categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </Screen>
  );
}
