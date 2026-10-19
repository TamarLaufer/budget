import { z } from "zod";

import { MAX_NAME_LENGTH } from "../../../shared/limits.js";
import {
  dateOnlySchema,
  idSchema,
  monthSchema,
  nameSchema,
  nonNegativeAgorotSchema,
  optionalTextSchema,
  positiveAgorotSchema,
  queryBooleanSchema,
  queryMonthSchema,
  queryYearSchema,
  yearSchema,
} from "./common.js";

// ---- Categories & payment methods ----

export const listActiveQuerySchema = z.strictObject({
  includeInactive: queryBooleanSchema.optional(),
});

export const createNamedSchema = z.strictObject({ name: nameSchema });

export const updateNamedSchema = z
  .strictObject({ name: nameSchema.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.isActive !== undefined, {
    message: "Provide name and/or isActive",
  });

// ---- Budgets ----

export const budgetListQuerySchema = z.strictObject({
  year: queryYearSchema,
  month: queryMonthSchema,
});

export const upsertBudgetSchema = z.strictObject({
  categoryId: idSchema,
  year: yearSchema,
  month: monthSchema,
  amountAgorot: nonNegativeAgorotSchema,
});

export const updateBudgetSchema = z.strictObject({ amountAgorot: nonNegativeAgorotSchema });

// ---- Transactions ----

const transactionTypeSchema = z.enum(["EXPENSE", "INCOME"]);

export const transactionListQuerySchema = z
  .strictObject({
    year: queryYearSchema.optional(),
    month: queryMonthSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema.optional(),
    q: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  })
  .refine((v) => v.month === undefined || v.year !== undefined, {
    message: "month requires year",
    path: ["month"],
  });

const transactionFields = {
  type: transactionTypeSchema,
  amountAgorot: positiveAgorotSchema,
  categoryId: idSchema.nullable().optional(),
  description: optionalTextSchema,
  transactionDate: dateOnlySchema,
  paymentMethodId: idSchema.nullable().optional(),
  incomeSource: optionalTextSchema,
};

export const createTransactionSchema = z.strictObject(transactionFields);

export const updateTransactionSchema = z
  .strictObject({
    type: transactionFields.type.optional(),
    amountAgorot: transactionFields.amountAgorot.optional(),
    categoryId: transactionFields.categoryId,
    description: transactionFields.description,
    transactionDate: transactionFields.transactionDate.optional(),
    paymentMethodId: transactionFields.paymentMethodId,
    incomeSource: transactionFields.incomeSource,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
