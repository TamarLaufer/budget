import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

import type { SubCategoryDto } from "../../../shared/api";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  selectSubCategoriesByCategory,
  selectSubCategoryLoad,
} from "../../store/selectors";
import { fetchSubCategories } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";
import { ChipGroup, type ChipOption } from "../ui/ChipGroup/ChipGroup";
import { ErrorBanner } from "../ui/Feedback";
import { MutedText } from "../ui/Layout";
import { Field, FieldLabel } from "./TransactionForm.styles";

const NONE = "__none__";
const EMPTY_SUBCATEGORIES: SubCategoryDto[] = [];

interface TransactionSubCategoryFieldProps {
  categoryId: string | null;
  value: string | null;
  /** The original selection may be retained in an edit even when inactive. */
  retainedSubCategoryId: string | null;
  onChange: (id: string | null) => void;
}

export function TransactionSubCategoryField({
  categoryId,
  value,
  retainedSubCategoryId,
  onChange,
}: TransactionSubCategoryFieldProps) {
  const dispatch = useAppDispatch();

  const subCategories = useAppSelector((state) =>
    categoryId
      ? selectSubCategoriesByCategory(state, categoryId)
      : EMPTY_SUBCATEGORIES,
  );

  const load = useAppSelector((state) =>
    categoryId ? selectSubCategoryLoad(state, categoryId) : null,
  );

  const fetchList = useCallback(() => {
    if (categoryId) {
      void dispatch(fetchSubCategories(categoryId));
    }
  }, [dispatch, categoryId]);

  useFocusEffect(
    useCallback(() => {
      fetchList();
    }, [fetchList]),
  );

  // Match the existing catalog behavior after a concurrent update.
  const needsRefetch = load?.status === "idle" && load.stale;

  useEffect(() => {
    if (needsRefetch) fetchList();
  }, [needsRefetch, fetchList]);

  if (!categoryId) return null;

  const options: ChipOption<string>[] = [
    { value: NONE, label: strings.NONE },
    ...subCategories
      .filter(
        (subCategory) =>
          subCategory.isActive ||
          (subCategory.id === retainedSubCategoryId &&
            subCategory.id === value),
      )
      .map((subCategory) => ({
        value: subCategory.id,
        label: subCategory.isActive
          ? subCategory.name
          : `${subCategory.name} (${strings.INACTIVE})`,
      })),
  ];

  return (
    <Field>
      <FieldLabel>{strings.SUBCATEGORY_NAME}</FieldLabel>

      <ChipGroup
        options={options}
        selected={value ?? NONE}
        onSelect={(id) => onChange(id === NONE ? null : id)}
      />

      {load?.status === "failed" ? (
        <ErrorBanner
          message={strings.SUBCATEGORIES_LOAD_FAILED}
          onRetry={fetchList}
        />
      ) : !load?.loaded ? (
        <MutedText>{strings.SUBCATEGORIES_LOADING}</MutedText>
      ) : null}
    </Field>
  );
}