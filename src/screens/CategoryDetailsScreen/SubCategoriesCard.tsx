import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SubCategoryDto } from "../../../shared/api";
import { messageFromUnknown } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { Card, MutedText } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectSubCategoriesByCategory, selectSubCategoryLoad } from "../../store/selectors";
import { createSubCategory, fetchSubCategories } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";
import { AddRow, AddField, Chip, ChipLabel, ChipsContainer, GroupLabel } from "./CategoryDetailsScreen.styles";
import { SubCategoryEditor } from "./SubCategoryEditor";

/**
 * The category's subcategories as chips, inactive ones in their own labelled group. Managers can
 * add one, and tap a chip to rename or (de)activate it.
 */
export function SubCategoriesCard({ categoryId, canManage }: { categoryId: string; canManage: boolean }) {
  const dispatch = useAppDispatch();
  const subCategories = useAppSelector((s) => selectSubCategoriesByCategory(s, categoryId));
  const load = useAppSelector((s) => selectSubCategoryLoad(s, categoryId));

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // At most one chip is edited at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The attempt whose result may still be shown; dismissing moves on, so a late response can't.
  const attempt = useRef(0);

  const dismissError = useCallback(() => {
    attempt.current += 1;
    setError(null);
  }, []);

  const fetchList = useCallback(() => void dispatch(fetchSubCategories(categoryId)), [dispatch, categoryId]);

  // Only the opened category's subcategories are requested, each time the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      fetchList();
      return () => {
        setName("");
        dismissError();
        setEditingId(null);
      };
    }, [fetchList, dismissError]),
  );

  // A fetch dropped because a rename or (de)activation succeeded meanwhile is sent again.
  const needsRefetch = load.status === "idle" && load.stale;
  useEffect(() => {
    if (needsRefetch) fetchList();
  }, [needsRefetch, fetchList]);

  const active = subCategories.filter((s) => s.isActive);
  const inactive = subCategories.filter((s) => !s.isActive);
  // Undefined once it is gone (e.g. the household changed), which closes the editor.
  const editing = subCategories.find((s) => s.id === editingId);

  const renderChip = (subCategory: SubCategoryDto) => {
    const isEditing = subCategory.id === editingId;
    return (
      <Chip
        key={subCategory.id}
        $inactive={!subCategory.isActive}
        $selected={isEditing}
        disabled={!canManage}
        onPress={() => setEditingId(isEditing ? null : subCategory.id)}
        accessibilityRole={canManage ? "button" : undefined}
        accessibilityState={canManage ? { selected: isEditing } : undefined}
        accessibilityLabel={
          subCategory.isActive ? subCategory.name : `${subCategory.name}, ${strings.CATEGORY_IS_INACTIVE}`
        }
      >
        <ChipLabel $inactive={!subCategory.isActive}>{subCategory.name}</ChipLabel>
      </Chip>
    );
  };

  const add = async () => {
    if (busy) return;
    const submitted = name;
    dismissError();
    const current = attempt.current;
    setBusy(true);
    try {
      // The created subcategory is added to Redux, so its chip appears right away.
      await dispatch(createSubCategory({ categoryId, name: submitted.trim() })).unwrap();
      // Keep anything typed while the request was in flight.
      if (attempt.current === current) setName((latest) => (latest === submitted ? "" : latest));
    } catch (e) {
      // The typed name stays in the field so it can be fixed and retried.
      if (attempt.current === current) setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {active.length > 0 ? <ChipsContainer>{active.map(renderChip)}</ChipsContainer> : null}

      {load.status === "failed" ? (
        <ErrorBanner message={strings.SUBCATEGORIES_LOAD_FAILED} onRetry={fetchList} />
      ) : !load.loaded ? (
        <MutedText>{strings.SUBCATEGORIES_LOADING}</MutedText>
      ) : subCategories.length === 0 ? (
        <MutedText>{strings.SUBCATEGORIES_EMPTY}</MutedText>
      ) : null}

      {inactive.length > 0 ? (
        <>
          <GroupLabel>{strings.INACTIVE_SUBCATEGORIES}</GroupLabel>
          <ChipsContainer>{inactive.map(renderChip)}</ChipsContainer>
        </>
      ) : null}

      {canManage && editing ? (
        <SubCategoryEditor key={editing.id} subCategory={editing} onClose={() => setEditingId(null)} />
      ) : null}

      {canManage ? (
        <>
          <AddRow>
            <AddField>
              <TextField
                label={strings.SUBCATEGORY_NAME}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  dismissError();
                }}
                maxLength={60}
              />
            </AddField>
            <Button label={strings.ADD} loading={busy} disabled={!name.trim()} onPress={() => void add()} />
          </AddRow>
          <ErrorBanner message={error} />
        </>
      ) : null}
    </Card>
  );
}
