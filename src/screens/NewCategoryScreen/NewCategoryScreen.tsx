import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { messageFromUnknown } from "../../api/errorMessage";
import { Button } from "../../components/ui/Button";
import { ErrorBanner, InfoBanner } from "../../components/ui/Feedback";
import { Card, ScrollScreen } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectCanManage } from "../../store/selectors";
import { createCategory } from "../../store/slices/catalogSlices";
import { strings } from "../../strings/he";

/** Opened from the Add action on the Categories tab. */
export function NewCategoryScreen() {
  const canManage = useAppSelector(selectCanManage);

  return (
    <ScrollScreen avoidKeyboard>
      <Stack.Screen options={{ title: strings.NEW_CATEGORY }} />
      {canManage ? <NewCategoryForm /> : <InfoBanner message={strings.MANAGERS_ONLY} />}
    </ScrollScreen>
  );
}

function NewCategoryForm() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The attempt whose failure may still be shown; dismissing moves on, so a late response can't.
  const attempt = useRef(0);

  const dismissError = useCallback(() => {
    attempt.current += 1;
    setError(null);
  }, []);

  // Clear the form when leaving the screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setName("");
        dismissError();
      };
    }, [dismissError]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") dismissError();
    });
    return () => subscription.remove();
  }, [dismissError]);

  const changeName = (value: string) => {
    setName(value);
    dismissError();
  };

  const submit = async () => {
    if (busy) return;
    dismissError();
    const current = attempt.current;
    const submitted = name;
    setBusy(true);
    try {
      await dispatch(createCategory(submitted.trim())).unwrap();
      // Still the latest attempt (not edited, not left): done, back to the list. Otherwise keep
      // anything typed while the request was in flight.
      if (attempt.current === current) router.back();
    } catch (e) {
      if (attempt.current === current) setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <TextField
        label={strings.NEW_CATEGORY}
        placeholder={strings.CATEGORY_NAME}
        value={name}
        onChangeText={changeName}
        maxLength={60}
        autoFocus
      />
      <ErrorBanner message={error} />
      <Button label={strings.ADD} onPress={() => void submit()} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}
