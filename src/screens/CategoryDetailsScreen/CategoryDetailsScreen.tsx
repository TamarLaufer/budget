import { Stack, useLocalSearchParams } from "expo-router";

import { errorMessage } from "../../api/errorMessage";
import {
  EmptyState,
  ErrorBanner,
  ErrorView,
  InfoBanner,
  LoadingView,
} from "../../components/ui/Feedback";
import { ScrollScreen, SectionTitle } from "../../components/ui/Layout";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppSelector } from "../../store";
import {
  categorySelectors,
  selectBudgetsForPeriod,
  selectCanManage,
  type Dataset,
} from "../../store/selectors";
import { strings } from "../../strings/he";
import { CategorySettingsCard } from "./CategorySettingsCard";
import { SubCategoriesCard } from "./SubCategoriesCard";
import { BudgetRow } from "@/components/BudgetRow/BudgetRow";
import { Text, View } from "react-native";

const DATASETS: readonly Dataset[] = ["categories", "budgets"];

export function CategoryDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id =
    typeof params.id === "string" && params.id.trim() !== ""
      ? params.id
      : null;

  const { period, load, refresh, refreshing } = useScreenData(DATASETS);

  const category = useAppSelector((s) =>
    id ? categorySelectors.selectById(s, id) : undefined,
  );
  const budgets = useAppSelector(selectBudgetsForPeriod);
  const canManage = useAppSelector(selectCanManage);

  if (!load.loaded && load.status === "failed") {
    return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  }

  if (!load.loaded) return <LoadingView />;

  if (!category) {
    return (
      <ScrollScreen>
        <Stack.Screen options={{ title: strings.CATEGORY_DETAILS }} />
        <EmptyState title={strings.CATEGORY_NOT_FOUND} />
      </ScrollScreen>
    );
  }

  const budget = budgets.find((item) => item.categoryId === category.id);

  return (
    <ScrollScreen
      avoidKeyboard
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Stack.Screen options={{ title: category.name }} />

      <ErrorBanner
        message={load.status === "failed" ? errorMessage(load.error) : null}
        onRetry={refresh}
      />

      {canManage ? null : <InfoBanner message={strings.MANAGERS_ONLY} />}

      <CategorySettingsCard category={category} canManage={canManage} />
      <View style={{paddingLeft: 8, marginTop: 10}}>
        <Text style={{fontSize: 18, fontWeight: 700 }}>{strings.BUDGET}</Text>
      </View>
      <BudgetRow
        key={`${category.id}:${period.year}-${period.month}`}
        category={category}
        period={period}
        budget={budget}
        canManage={canManage}
      />
      <View style={{paddingLeft: 8, marginTop: 10}}>
        <Text style={{fontSize: 18, fontWeight: 700 }}>{strings.SUBCATEGORIES}</Text>
      </View>
      <SubCategoriesCard
        categoryId={category.id}
        canManage={canManage}
      />
    </ScrollScreen>
  );
}