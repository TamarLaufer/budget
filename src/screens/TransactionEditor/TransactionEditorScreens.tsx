import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";

import type { CategoryDto, CreateTransactionRequest } from "../../../shared/api";
import { messageFromUnknown } from "../../api/errorMessage";
import { periodOf, toDateOnly, type Period } from "../../budget/period";
import { emptyFormValues, formValuesFromTransaction } from "../../budget/transactionForm";
import { TransactionForm } from "../../components/TransactionForm/TransactionForm";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorBanner } from "../../components/ui/Feedback";
import { ScrollScreen } from "../../components/ui/Layout";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  categorySelectors,
  selectActiveCategories,
  selectActivePaymentMethods,
  transactionSelectors,
  type Dataset,
} from "../../store/selectors";
import { createTransaction, deleteTransaction, updateTransaction } from "../../store/slices/transactionsSlice";
import { strings } from "../../strings/he";

/** The form's choices; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["categories", "paymentMethods"];

/** Today if the selected month is the current one, otherwise the 1st of the selected month. */
function defaultDate(period: Period): string {
  const today = new Date();
  const current = periodOf(today);
  if (current.year === period.year && current.month === period.month) return toDateOnly(today);
  return toDateOnly(new Date(period.year, period.month - 1, 1));
}

export function NewTransactionScreen() {
  useScreenData(DATASETS);
  const dispatch = useAppDispatch();
  const period = useAppSelector((s) => s.period);
  const categories = useAppSelector(selectActiveCategories);
  const paymentMethods = useAppSelector(selectActivePaymentMethods);
  const [error, setError] = useState<string | null>(null);
  const initialValues = useMemo(() => emptyFormValues(defaultDate(period)), [period]);

  const submit = async (request: CreateTransactionRequest) => {
    setError(null);
    try {
      // The server's response is added to Redux, so the dashboard updates without a refetch.
      await dispatch(createTransaction(request)).unwrap();
      router.back();
    } catch (e) {
      // Keep the form filled in: the user's entry is never silently dropped.
      setError(messageFromUnknown(e));
      throw e;
    }
  };

  return (
    <ScrollScreen avoidKeyboard>
      <Stack.Screen options={{ title: strings.ADD_TRANSACTION }} />
      <TransactionForm
        initialValues={initialValues}
        categories={categories}
        paymentMethods={paymentMethods}
        submitLabel={strings.SAVE}
        onSubmit={submit}
        submitError={error}
      />
    </ScrollScreen>
  );
}

export function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useScreenData(DATASETS);
  const dispatch = useAppDispatch();
  const transaction = useAppSelector((s) => transactionSelectors.selectById(s, id));
  const activeCategories = useAppSelector(selectActiveCategories);
  const allCategories = useAppSelector(categorySelectors.selectEntities);
  const paymentMethods = useAppSelector(selectActivePaymentMethods);
  const userId = useAppSelector((s) => s.auth.me?.user.id);
  const role = useAppSelector((s) => s.auth.me?.membership?.role);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // An edit may keep a category that was deactivated after the transaction was recorded.
  const categories = useMemo<CategoryDto[]>(() => {
    const current = transaction?.categoryId ? allCategories[transaction.categoryId] : undefined;
    return current && !current.isActive ? [...activeCategories, current] : activeCategories;
  }, [transaction?.categoryId, allCategories, activeCategories]);

  if (!transaction) {
    return (
      <ScrollScreen>
        <Stack.Screen options={{ title: strings.EDIT_TRANSACTION }} />
        <EmptyState title={strings.TRANSACTION_NOT_FOUND} />
      </ScrollScreen>
    );
  }

  const canModify = transaction.createdBy.id === userId || role === "OWNER" || role === "ADMIN";

  const submit = async (request: CreateTransactionRequest) => {
    setError(null);
    try {
      await dispatch(updateTransaction({ id: transaction.id, changes: request })).unwrap();
      router.back();
    } catch (e) {
      setError(messageFromUnknown(e));
      throw e;
    }
  };

  const confirmDelete = () => {
    Alert.alert(strings.DELETE_TRANSACTION_CONFIRM, undefined, [
      { text: strings.CANCEL, style: "cancel" },
      {
        text: strings.DELETE,
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await dispatch(deleteTransaction(transaction.id)).unwrap();
            router.back();
          } catch (e) {
            setError(messageFromUnknown(e));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: strings.EDIT_TRANSACTION }} />
      {canModify ? null : <ErrorBanner message={strings.API_ERRORS.INSUFFICIENT_ROLE ?? null} />}
      <TransactionForm
        initialValues={formValuesFromTransaction(transaction)}
        categories={categories}
        paymentMethods={paymentMethods}
        submitLabel={strings.SAVE}
        onSubmit={submit}
        submitError={error}
      />
      {canModify ? (
        <Button label={strings.DELETE} variant="danger" onPress={confirmDelete} loading={deleting} />
      ) : null}
    </ScrollScreen>
  );
}
