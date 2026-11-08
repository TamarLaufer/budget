import { Stack, useLocalSearchParams } from "expo-router";

import { errorMessage } from "../../api/errorMessage";
import { EmptyState, ErrorView, InfoBanner, LoadingView } from "../../components/ui/Feedback";
import { ScrollScreen, SectionTitle } from "../../components/ui/Layout";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppSelector } from "../../store";
import { categorySelectors, selectCanManage, type Dataset } from "../../store/selectors";
import { strings } from "../../strings/he";
import { CategorySettingsCard } from "./CategorySettingsCard";
import { SubCategoriesCard } from "./SubCategoriesCard";

/** Needed to resolve the category from its id (e.g. when opened from a deep link). */
const DATASETS: readonly Dataset[] = ["categories"];

/**
 * Details of one category, opened from the Categories tab with only its id in the route. The
 * category itself is read from Redux, so changes made here are already in the list on return.
 */
export function CategoryDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // At runtime a param can be missing or repeated (?id=a&id=b); accept only a single non-empty id.
  const id = typeof params.id === "string" && params.id.trim() !== "" ? params.id : null;

  const { load, refresh } = useScreenData(DATASETS);
  const category = useAppSelector((s) => (id ? categorySelectors.selectById(s, id) : undefined));
  const canManage = useAppSelector(selectCanManage);

  const title = <Stack.Screen options={{ title: category?.name ?? strings.CATEGORY_DETAILS }} />;

  if (!category) {
    // "Not found" only once the categories have actually loaded without it.
    if (id && load.status === "failed") return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
    if (id && load.status !== "succeeded") return <LoadingView />;
    return (
      <ScrollScreen>
        {title}
        <EmptyState title={strings.CATEGORY_NOT_FOUND} />
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen avoidKeyboard>
      {title}
      {canManage ? null : <InfoBanner message={strings.MANAGERS_ONLY} />}
      <CategorySettingsCard category={category} canManage={canManage} />

      <SectionTitle>{strings.SUBCATEGORIES}</SectionTitle>
      <SubCategoriesCard categoryId={category.id} canManage={canManage} />
    </ScrollScreen>
  );
}
