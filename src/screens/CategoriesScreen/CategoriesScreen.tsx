import { router } from "expo-router";

import { errorMessage } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import {
  EmptyState,
  ErrorView,
  InfoBanner,
  LoadingView,
} from "../../components/ui/Feedback";
import { ScrollScreen, SectionTitle, Title } from "../../components/ui/Layout";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppSelector } from "../../store";
import {
  categorySelectors,
  selectCanManage,
  type Dataset,
} from "../../store/selectors";
import { strings } from "../../strings/he";
import { HeaderRow, RowList } from "./CategoriesScreen.styles";
import { CategoryItem } from "./CategoryItem";

/** What this screen shows; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["categories"];

/**
 * The categories list: compact rows grouped by active/inactive. Managing a category happens on
 * its details screen (category/[id]); creating one on the new-category screen (category/new).
 */
export default function CategoriesScreen() {
  const { load, refresh, refreshing } = useScreenData(DATASETS);
  const categories = useAppSelector(categorySelectors.selectAll);
  const canManage = useAppSelector(selectCanManage);

  if (!load.loaded && load.status === "failed")
    return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  if (!load.loaded) return <LoadingView />;

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  return (
    <ScrollScreen
      withTopInset
      refreshing={refreshing}
      onRefresh={refresh}
      avoidKeyboard
    >
      <HeaderRow>
        <Title>{strings.TAB_CATEGORIES}</Title>
        {canManage ? (
          <Button
            label={strings.ADD}
            compact
            onPress={() => router.push("/category/new")}
            testID="add-category"
          />
        ) : null}
      </HeaderRow>
      {canManage ? null : <InfoBanner message={strings.MANAGERS_ONLY} />}

      <SectionTitle>{strings.ACTIVE_CATEGORIES}</SectionTitle>
      {active.length === 0 ? (
        <EmptyState title={strings.NO_CATEGORIES} />
      ) : null}
      <RowList>
        {active.map((c) => (
          <CategoryItem key={c.id} category={c} />
        ))}
      </RowList>

      {inactive.length > 0 ? (
        <SectionTitle>{strings.INACTIVE_CATEGORIES}</SectionTitle>
      ) : null}
      <RowList>
        {inactive.map((c) => (
          <CategoryItem key={c.id} category={c} />
        ))}
      </RowList>
    </ScrollScreen>
  );
}
