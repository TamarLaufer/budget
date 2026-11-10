import { useMemo, useState } from "react";
import type { CategoryDto, CreateTransactionRequest, PaymentMethodDto, TransactionType } from "../../../shared/api";
import {
  validateTransactionForm,
  type TransactionFormField,
  type TransactionFormErrorKey,
  type TransactionFormValues,
} from "../../budget/transactionForm";
import { strings } from "../../strings/he";
import { DateField } from "../DateField/DateField";
import { Button } from "../ui/Button";
import { ChipGroup, type ChipOption } from "../ui/ChipGroup/ChipGroup";
import { ErrorBanner } from "../ui/Feedback";
import { Card } from "../ui/Layout";
import { TextField } from "../ui/TextField";
import { ButtonContainer, Field, FieldError, FieldLabel } from "./TransactionForm.styles";
import { TransactionSubCategoryField } from "./TransactionSubCategoryField";
import { useCategoryUsage } from "../../hooks/useCategoryUsage";

const NONE = "__none__";

const typeOptions: ChipOption<TransactionType>[] = [
  { value: "EXPENSE", label: strings.TYPE_EXPENSE },
  { value: "INCOME", label: strings.TYPE_INCOME },
];

interface TransactionFormProps {
  initialValues: TransactionFormValues;
  /** Active categories plus, when editing, the transaction's current (possibly inactive) one. */
  categories: CategoryDto[];
  paymentMethods: PaymentMethodDto[];
  submitLabel: string;
  /** Must reject on failure; the form then keeps every value so nothing the user typed is lost. */
  onSubmit: (request: CreateTransactionRequest) => Promise<void>;
  submitError: string | null;
  categoryUsageKey?: string; 
}

export function TransactionForm({
  initialValues,
  categories,
  paymentMethods,
  submitLabel,
  onSubmit,
  submitError,
  categoryUsageKey,
}: TransactionFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<TransactionFormField, TransactionFormErrorKey>>>({});
  const [submitting, setSubmitting] = useState(false);
  const { categoryUsage, recordCategorySelection } = useCategoryUsage(categoryUsageKey);
  

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const categoryOptions = useMemo<ChipOption<string>[]>(
    () => [
      ...(values.type === "INCOME" ? [{ value: NONE, label: strings.NO_CATEGORY }] : []),
      ...[...categories]
        .sort((a, b) => (categoryUsage[b.id] ?? 0) - (categoryUsage[a.id] ?? 0))
        .map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (${strings.INACTIVE})` })),
    ],
    [categories, values.type, categoryUsage],
  );

  const paymentOptions = useMemo<ChipOption<string>[]>(
    () => [{ value: NONE, label: strings.NONE }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))],
    [paymentMethods],
  );

  const errorText = (field: TransactionFormField) => {
    const key = errors[field];
    return key ? strings.FORM_ERRORS[key] : null;
  };

  const submit = async () => {
    const result = validateTransactionForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.request);
    } catch {
      // The parent shows `submitError`; values stay in place for a retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <ChipGroup options={typeOptions} selected={values.type} onSelect={(type) => set("type", type)} />

      <TextField
        label={strings.AMOUNT}
        value={values.amount}
        onChangeText={(text) => set("amount", text)}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={errorText("amount")}
        testID="amount-input"
      />

      <Field>
        <FieldLabel>{strings.CATEGORY}</FieldLabel>
        <ChipGroup
          options={categoryOptions}
          selected={values.categoryId ?? (values.type === "INCOME" ? NONE : null)}
          onSelect={(id) => {
            const categoryId = id === NONE ? null : id;

            if (categoryId && categoryId !== values.categoryId) {
              recordCategorySelection(categoryId);
            }

            setValues((prev) => ({
              ...prev,
              categoryId,
              subCategoryId:
                prev.categoryId === categoryId ? prev.subCategoryId : null,
            }));

            setErrors((prev) => ({ ...prev, categoryId: undefined }));
          }}
        />
        {errorText("categoryId") ? <FieldError>{errorText("categoryId")}</FieldError> : null}
      </Field>
      <TransactionSubCategoryField
        categoryId={values.categoryId}
        value={values.subCategoryId}
        retainedSubCategoryId={
          values.categoryId === initialValues.categoryId
            ? initialValues.subCategoryId
            : null
        }
        onChange={(subCategoryId) => set("subCategoryId", subCategoryId)}
      />
      <DateField label={strings.DATE} value={values.transactionDate} onChange={(date) => set("transactionDate", date)} />

      <TextField
        label={strings.DESCRIPTION}
        value={values.description}
        onChangeText={(text) => set("description", text)}
        error={errorText("description")}
      />

      {values.type === "INCOME" ? (
        <TextField
          label={strings.INCOME_SOURCE}
          value={values.incomeSource}
          onChangeText={(text) => set("incomeSource", text)}
          error={errorText("incomeSource")}
        />
      ) : null}

      {paymentMethods.length > 0 ? (
        <Field>
          <FieldLabel>{strings.PAYMENT_METHOD}</FieldLabel>
          <ChipGroup
            options={paymentOptions}
            selected={values.paymentMethodId ?? NONE}
            onSelect={(id) => set("paymentMethodId", id === NONE ? null : id)}
          />
        </Field>
      ) : null}

      <ErrorBanner message={submitError} />
      <ButtonContainer>
        <Button label={submitting ? strings.SAVING : submitLabel} onPress={submit} loading={submitting} testID="submit-transaction" />
      </ButtonContainer>
    </Card>
  );
}
