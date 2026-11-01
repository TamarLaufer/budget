import { useState } from "react";

import type { CategoryDto } from "../../../shared/api";
import { errorMessage, messageFromUnknown } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorBanner, ErrorView, InfoBanner, LoadingView } from "../../components/ui/Feedback";
import { BodyText, Card, Row, ScrollScreen, SectionTitle, SpaceBetweenRow, Title } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppDispatch, useAppSelector } from "../../store";
import { categorySelectors, selectCanManage, type Dataset } from "../../store/selectors";
import { createCategory, updateCategory } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";

/** What this screen shows; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["categories"];

export default function CategoriesScreen() {
  const { load, refresh, refreshing } = useScreenData(DATASETS);
  const categories = useAppSelector(categorySelectors.selectAll);
  const canManage = useAppSelector(selectCanManage);

  if (!load.loaded && load.status === "failed") return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  if (!load.loaded) return <LoadingView />;

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  return (
    <ScrollScreen withTopInset refreshing={refreshing} onRefresh={refresh}>
      <Title>{strings.TAB_CATEGORIES}</Title>
      {canManage ? <NewCategoryCard /> : <InfoBanner message={strings.MANAGERS_ONLY} />}

      <SectionTitle>{strings.ACTIVE_CATEGORIES}</SectionTitle>
      {active.length === 0 ? <EmptyState title={strings.NO_CATEGORIES} /> : null}
      {active.map((c) => (
        <CategoryItem key={c.id} category={c} canManage={canManage} />
      ))}

      {inactive.length > 0 ? <SectionTitle>{strings.INACTIVE_CATEGORIES}</SectionTitle> : null}
      {inactive.map((c) => (
        <CategoryItem key={c.id} category={c} canManage={canManage} />
      ))}
    </ScrollScreen>
  );
}

function NewCategoryCard() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(createCategory(name.trim())).unwrap();
      setName("");
    } catch (e) {
      setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <TextField label={strings.NEW_CATEGORY} placeholder={strings.CATEGORY_NAME} value={name} onChangeText={setName} maxLength={60} />
      <ErrorBanner message={error} />
      <Button label={strings.ADD} onPress={submit} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}

function CategoryItem({ category, canManage }: { category: CategoryDto; canManage: boolean }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (changes: { name?: string; isActive?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(updateCategory({ id: category.id, changes })).unwrap();
      setEditing(false);
    } catch (e) {
      setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {editing ? (
        <TextField value={name} onChangeText={setName} maxLength={60} autoFocus accessibilityLabel={strings.CATEGORY_NAME} />
      ) : (
        <SpaceBetweenRow>
          <BodyText>{category.name}</BodyText>
        </SpaceBetweenRow>
      )}
      <ErrorBanner message={error} />
      {canManage ? (
        <Row>
          {editing ? (
            <>
              <Button label={strings.SAVE} compact loading={busy} disabled={!name.trim()} onPress={() => save({ name: name.trim() })} />
              <Button
                label={strings.CANCEL}
                compact
                variant="secondary"
                onPress={() => {
                  setName(category.name);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <>
              <Button label={strings.RENAME} compact variant="secondary" onPress={() => setEditing(true)} />
              <Button
                label={category.isActive ? strings.DEACTIVATE : strings.ACTIVATE}
                compact
                variant={category.isActive ? "danger" : "secondary"}
                loading={busy}
                onPress={() => save({ isActive: !category.isActive })}
              />
            </>
          )}
        </Row>
      ) : null}
    </Card>
  );
}
