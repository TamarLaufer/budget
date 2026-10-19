import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildMonthlySnapshot } from "../../budget/calculations";
import type { BudgetCategory } from "../../budget/types";
import { BudgetSummary } from "../../components/BudgetSummary/BudgetSummary";
import { CategoryCard } from "../../components/CategoryCard/CategoryCard";
import { strings } from "../../strings/he";
import {
  Screen,
  SectionTitle,
  ShowAllPress,
  SectionTitleContainer,
} from "./MonthlySnapshotScreen.styles";
import { useSelectedCategory } from "../../hooks/useSelectedCategory";
import { Text, View } from "react-native";
import { formatAgorot } from "../../budget/money";
import Header from "../../components/Header/Header";
import RangeMergePracticeScreen from "../../components/src/screens/RangeMergePracticeScreen/RangeMergePracticeScreen";
import TogglePracticeScreen from "../../components/src/screens/TogglePracticeScreen/TogglePracticeScreen";

interface MonthlySnapshotScreenProps {
  categories: BudgetCategory[];
  month: Date;
}

const MonthlySnapshotScreen = ({
  categories,
  month,
}: MonthlySnapshotScreenProps) => {
  const monthlySummary = useMemo(
    () => buildMonthlySnapshot(categories),
    [categories],
  );
  const { categorySetState, selectedCategoryId, clearSelectedId } =
    useSelectedCategory(categories);
  const [toggleOverBudget, setToggleOverBudget] = useState(false);
  const [searchValue, setSearchValue] = useState<string>("");

  const findCategory = monthlySummary.categories.find(
    (cat) => cat.id === selectedCategoryId,
  );

  const showOnlyOverBudget = monthlySummary.categories.filter(
    (category) => category.isOver,
  );

  const toggleCategories = () => {
    if (!toggleOverBudget && findCategory && !findCategory.isOver) {
      clearSelectedId();
    }
    setToggleOverBudget((prev) => !prev);
  };

  const categoriesToDisplay = toggleOverBudget
    ? showOnlyOverBudget
    : monthlySummary.categories;

  const insets = useSafeAreaInsets();

  const selectCategoryPress = (category: BudgetCategory) => {
    if (selectedCategoryId === category.id) {
      clearSelectedId();
    } else {
      categorySetState(category.id);
    }
  };

  const filteredCategory = categoriesToDisplay.filter((cat) =>
    cat.name.toLowerCase().includes(searchValue.toLowerCase()),
  );

  return (
    <Screen $insets={insets}>
      <Header month={month} />
        <RangeMergePracticeScreen />
        <TogglePracticeScreen/>
      <ShowAllPress onPress={toggleCategories}>
        <Text>{toggleOverBudget ? "Show all" : "Show over budget only"}</Text>
      </ShowAllPress>

      <BudgetSummary totals={monthlySummary.totals} />

      <SectionTitleContainer>
        <SectionTitle accessibilityRole="header">
          {strings.CATEGORIES}
        </SectionTitle>
      </SectionTitleContainer>
      {categoriesToDisplay.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          onPress={() => selectCategoryPress(category)}
          isSelected={selectedCategoryId === category.id}
        />
      ))}
      {findCategory ? (
        <>
          <Text>{findCategory.name}</Text>
          <Text>{formatAgorot(findCategory.remaining)}</Text>
        </>
      ) : (
        <Text>No category selected</Text>
      )}
    </Screen>
  );
};

export default MonthlySnapshotScreen;
