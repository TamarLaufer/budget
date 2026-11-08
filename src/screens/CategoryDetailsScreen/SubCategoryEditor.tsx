import { useCallback, useEffect, useRef, useState } from "react";

import type { SubCategoryDto, UpdateSubCategoryRequest } from "../../../shared/api";
import { messageFromUnknown } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch } from "../../store";
import { updateSubCategory } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";
import { EditorBox, EditorButtons } from "./SubCategoryEditor.styles";

/**
 * Rename and (de)activate one subcategory, opened by tapping its chip (managers only). The draft
 * name is local; the saved subcategory goes to Redux, which moves its chip right away.
 * The parent renders it with key={subCategory.id}, so each chip starts with a fresh draft.
 */
export function SubCategoryEditor({ subCategory, onClose }: { subCategory: SubCategoryDto; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(subCategory.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The attempt whose result may still be shown; dismissing moves on, so a late response can't.
  const attempt = useRef(0);

  const dismissError = useCallback(() => {
    attempt.current += 1;
    setError(null);
  }, []);

  // Cancel, tapping another chip and leaving the screen all unmount the editor. A response that
  // arrives afterwards still updates Redux, but must not close the editor or show an error.
  useEffect(() => () => void (attempt.current += 1), []);

  const save = async (changes: UpdateSubCategoryRequest) => {
    if (busy) return;
    dismissError();
    const current = attempt.current;
    setBusy(true);
    try {
      await dispatch(updateSubCategory({ id: subCategory.id, changes })).unwrap();
      if (attempt.current === current) onClose();
    } catch (e) {
      // The draft stays in the field so it can be fixed and retried.
      if (attempt.current === current) setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  const trimmed = name.trim();

  return (
    <EditorBox accessibilityLabel={strings.EDIT_SUBCATEGORY}>
      <TextField
        label={strings.SUBCATEGORY_NAME}
        value={name}
        onChangeText={(value) => {
          setName(value);
          dismissError();
        }}
        maxLength={60}
        autoFocus
      />
      <ErrorBanner message={error} />
      <EditorButtons>
        <Button
          label={strings.SAVE}
          compact
          loading={busy}
          disabled={!trimmed || trimmed === subCategory.name}
          onPress={() => void save({ name: trimmed })}
        />
        <Button label={strings.CANCEL} compact variant="secondary" onPress={onClose} />
        <Button
          label={subCategory.isActive ? strings.DEACTIVATE : strings.ACTIVATE}
          compact
          variant={subCategory.isActive ? "danger" : "secondary"}
          disabled={busy}
          onPress={() => void save({ isActive: !subCategory.isActive })}
        />
      </EditorButtons>
    </EditorBox>
  );
}
