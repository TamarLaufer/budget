import { z } from "zod";

import {
  MAX_AMOUNT_AGOROT,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
} from "../../../shared/limits.js";
import { isValidDateOnly } from "../utils/dates.js";

/*
 * All request schemas are `strict`: unknown keys (for example a `householdId` or `userId`
 * smuggled into a body or query string) are rejected with 400 instead of silently ignored.
 */

export const idSchema = z.uuid({ message: "Must be a valid id" });

export const idParamsSchema = z.strictObject({ id: idSchema });

export const nameSchema = z.string().trim().min(1, "Required").max(MAX_NAME_LENGTH);

/** Integer agorot. Rejects floats, so "87.9 shekels" can never sneak in as 87.9. */
export const positiveAgorotSchema = z
  .number()
  .int("Amount must be a whole number of agorot")
  .positive("Amount must be greater than zero")
  .max(MAX_AMOUNT_AGOROT, "Amount is too large");

export const nonNegativeAgorotSchema = z
  .number()
  .int("Amount must be a whole number of agorot")
  .min(0, "Amount cannot be negative")
  .max(MAX_AMOUNT_AGOROT, "Amount is too large");

export const yearSchema = z.number().int().min(MIN_YEAR).max(MAX_YEAR);
export const monthSchema = z.number().int().min(1).max(12);

/** Query-string variants: values arrive as strings. */
export const queryYearSchema = z.coerce.number().pipe(yearSchema);
export const queryMonthSchema = z.coerce.number().pipe(monthSchema);
export const queryBooleanSchema = z.enum(["true", "false"]).transform((v) => v === "true");

export const dateOnlySchema = z
  .string()
  .refine(isValidDateOnly, { message: "Must be a valid date in YYYY-MM-DD format" });

export const optionalTextSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Must be a valid email address" }));
