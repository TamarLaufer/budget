import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { CategoryDto, UpdateCategoryRequest } from "../../../shared/api";
import { messageFromUnknown } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { Card, MutedText, Row } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch } from "../../store";
import { updateCategory } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";
import { CategoryName } from "./CategoryDetailsScreen.styles";

/** The category's name and status; managers can rename it and (de)activate it. */
export function CategorySettingsCard({ category, canManage }: { category: CategoryDto; canManage: boolean }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The attempt whose result may still be shown; dismissing moves on, so a late response can't.
  const attempt = useRef(0);

  const dismissError = useCallback(() => {
    attempt.current += 1;
    setError(null);
  }, []);

  // Leaving the screen abandons the edit.
  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissError();
        setEditing(false);
      };
    }, [dismissError]),
  );

  const save = async (changes: UpdateCategoryRequest) => {
    if (busy) return;
    dismissError();
    const current = attempt.current;
    setBusy(true);
    try {
      // The response replaces the category in Redux, so the list shows the change too.
      await dispatch(updateCategory({ id: category.id, changes })).unwrap();
      if (attempt.current === current) setEditing(false);
    } catch (e) {
      // The typed name stays in the field so it can be fixed and retried.
      if (attempt.current === current) setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    setName(category.name);
    dismissError();
    setEditing(true);
  };

  const cancelEditing = () => {
    setName(category.name);
    setEditing(false);
    dismissError();
  };

  return (
    <Card>
      {editing ? (
        <TextField
          label={strings.CATEGORY_NAME}
          value={name}
          onChangeText={(value) => {
            setName(value);
            dismissError();
          }}
          maxLength={60}
          autoFocus
        />
      ) : (
        <>
          <CategoryName>{category.name}</CategoryName>
          <MutedText>{category.isActive ? strings.CATEGORY_IS_ACTIVE : strings.CATEGORY_IS_INACTIVE}</MutedText>
        </>
      )}
      <ErrorBanner message={error} />

      {canManage ? (
        <Row>
          {editing ? (
            <>
              <Button
                label={strings.SAVE}
                compact
                loading={busy}
                disabled={!name.trim()}
                onPress={() => void save({ name: name.trim() })}
              />
              <Button label={strings.CANCEL} compact variant="secondary" onPress={cancelEditing} />
            </>
          ) : (
            <>
              <Button label={strings.RENAME} compact variant="secondary" disabled={busy} onPress={startEditing} />
              <Button
                label={category.isActive ? strings.DEACTIVATE : strings.ACTIVATE}
                compact
                variant={category.isActive ? "danger" : "secondary"}
                loading={busy}
                onPress={() => void save({ isActive: !category.isActive })}
              />
            </>
          )}
        </Row>
      ) : null}
    </Card>
  );
}
