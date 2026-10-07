import { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildMonthlySnapshot } from "../../budget/calculations";
import type { BudgetCategory } from "../../budget/types";
import { BudgetSummary } from "../../components/BudgetSummary/BudgetSummary";
import { CategoryCard } from "../../components/CategoryCard/CategoryCard";
import { strings } from "../../strings/he";
import { Screen, SectionTitle, ShowAllPress } from "./MonthlySnapshotScreen.styles";
import { useSelectedCategory } from "../../hooks/useSelectedCategory";
import { Text } from "react-native";
import { formatAgorot } from "../../budget/money";
import Header from "../../components/Header/Header";

interface MonthlySnapshotScreenProps {
  categories: BudgetCategory[];
  month: Date;
}

const MonthlySnapshotScreen = ({categories, month}: MonthlySnapshotScreenProps) => {
  const monthlySummary = useMemo(
    () => buildMonthlySnapshot(categories),
    [categories],
  );
  const {categorySetState, selectedCategoryId, clearSelectedId} = useSelectedCategory(categories)
  const [toggleOverBudget, setToggleOverBudget] = useState(false)
  const findCategory = monthlySummary.categories.find((cat)=> cat.id === selectedCategoryId)

  const showOnlyOverBudget = monthlySummary.categories.filter((category)=> category.isOver)

  const toggleCategories = ()=>{
    setToggleOverBudget((prev) => !prev)
  }

  const categoriesToDisplay = toggleOverBudget ? showOnlyOverBudget : monthlySummary.categories

  const renderCount = useRef(0);
  renderCount.current += 1;
  
  useEffect(()=>{
    console.log("render:", renderCount.current);
    console.log(findCategory?.remaining);
  },[selectedCategoryId])

  
  const insets = useSafeAreaInsets();
  

  const selectCategoryPress = (category: BudgetCategory)=>{
    selectedCategoryId === category.id ? clearSelectedId() : categorySetState(category.id)
  }

  
  return (
    <Screen $insets={insets}>
      <Header month={month}/>

      <ShowAllPress onPress={toggleCategories}>
        <Text>
          {toggleOverBudget ? "Show all" : "Show over budget only"}
        </Text>
      </ShowAllPress>

      <BudgetSummary totals={monthlySummary.totals} />

      <SectionTitle accessibilityRole="header">{strings.CATEGORIES}</SectionTitle>

      {categoriesToDisplay.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onPress={()=>selectCategoryPress(category)}
            isSelected={selectedCategoryId === category.id}
          />
      ))}
      {findCategory && !toggleOverBudget? (
        <>
        <Text>{findCategory.name}</Text>
        <Text>{formatAgorot(findCategory.remaining)}</Text>
        </>
      ): (<Text>No category selected</Text>)}
    </Screen>
  );
}

export default MonthlySnapshotScreen