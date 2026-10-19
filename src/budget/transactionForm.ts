import type { CreateTransactionRequest, TransactionDto, TransactionType } from "../../shared/api";
import { MAX_DESCRIPTION_LENGTH } from "../../shared/limits";
import { agorotToInput, parseShekelInput } from "./money";

/** Raw text/selection state of the add/edit transaction form. */
export interface TransactionFormValues {
  type: TransactionType;
  amount: string;
  categoryId: string | null;
  transactionDate: string;
  description: string;
  paymentMethodId: string | null;
  incomeSource: string;
}

export type TransactionFormField = "amount" | "categoryId" | "description" | "incomeSource" | "transactionDate";

/** Error keys map to Hebrew messages in strings.FORM_ERRORS. */
export type TransactionFormErrorKey = "AMOUNT_INVALID" | "AMOUNT_ZERO" | "CATEGORY_REQUIRED" | "TOO_LONG" | "DATE_INVALID";

export type TransactionFormResult =
  | { ok: true; request: CreateTransactionRequest }
  | { ok: false; errors: Partial<Record<TransactionFormField, TransactionFormErrorKey>> };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the server's rules so most mistakes are caught before a network round-trip. */
export function validateTransactionForm(values: TransactionFormValues): TransactionFormResult {
  const errors: Partial<Record<TransactionFormField, TransactionFormErrorKey>> = {};

  const amountAgorot = parseShekelInput(values.amount);
  if (amountAgorot === null) errors.amount = "AMOUNT_INVALID";
  else if (amountAgorot === 0) errors.amount = "AMOUNT_ZERO";

  if (values.type === "EXPENSE" && !values.categoryId) errors.categoryId = "CATEGORY_REQUIRED";
  if (!DATE_ONLY.test(values.transactionDate)) errors.transactionDate = "DATE_INVALID";

  const description = values.description.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) errors.description = "TOO_LONG";
  const incomeSource = values.incomeSource.trim();
  if (incomeSource.length > MAX_DESCRIPTION_LENGTH) errors.incomeSource = "TOO_LONG";

  if (Object.keys(errors).length > 0 || amountAgorot === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      type: values.type,
      amountAgorot,
      categoryId: values.categoryId,
      transactionDate: values.transactionDate,
      description: description || null,
      paymentMethodId: values.paymentMethodId,
      incomeSource: values.type === "INCOME" ? incomeSource || null : null,
    },
  };
}

export function formValuesFromTransaction(t: TransactionDto): TransactionFormValues {
  return {
    type: t.type,
    amount: agorotToInput(t.amountAgorot),
    categoryId: t.categoryId,
    transactionDate: t.transactionDate,
    description: t.description ?? "",
    paymentMethodId: t.paymentMethodId,
    incomeSource: t.incomeSource ?? "",
  };
}

export function emptyFormValues(transactionDate: string): TransactionFormValues {
  return {
    type: "EXPENSE",
    amount: "",
    categoryId: null,
    transactionDate,
    description: "",
    paymentMethodId: null,
    incomeSource: "",
  };
}
