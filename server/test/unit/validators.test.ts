import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_AGOROT } from "../../../shared/limits.js";
import { createInvitationSchema } from "../../src/validators/householdValidators.js";
import {
  createTransactionSchema,
  transactionListQuerySchema,
  updateTransactionSchema,
  upsertBudgetSchema,
} from "../../src/validators/resourceValidators.js";

const validExpense = {
  type: "EXPENSE",
  amountAgorot: 8790,
  categoryId: "0b7c1f5e-4a51-4d2e-9a6b-1c1f0d2e3a4b",
  transactionDate: "2026-10-15",
};

describe("createTransactionSchema", () => {
  it("accepts a valid expense", () => {
    expect(createTransactionSchema.parse(validExpense)).toMatchObject(validExpense);
  });

  it.each([
    ["a float amount", { amountAgorot: 87.9 }],
    ["zero", { amountAgorot: 0 }],
    ["a negative amount", { amountAgorot: -100 }],
    ["an amount above the limit", { amountAgorot: MAX_AMOUNT_AGOROT + 1 }],
    ["a string amount", { amountAgorot: "8790" }],
    ["an impossible date", { transactionDate: "2026-02-30" }],
    ["an unknown type", { type: "TRANSFER" }],
    ["a malformed category id", { categoryId: "food" }],
  ])("rejects %s", (_label, override) => {
    expect(createTransactionSchema.safeParse({ ...validExpense, ...override }).success).toBe(false);
  });

  it("rejects unknown keys such as householdId (no client-supplied scoping)", () => {
    const result = createTransactionSchema.safeParse({
      ...validExpense,
      householdId: "0b7c1f5e-4a51-4d2e-9a6b-1c1f0d2e3a4b",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes blank descriptions to null", () => {
    expect(createTransactionSchema.parse({ ...validExpense, description: "   " }).description).toBeNull();
  });
});

describe("updateTransactionSchema", () => {
  it("requires at least one field", () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(false);
    expect(updateTransactionSchema.safeParse({ amountAgorot: 100 }).success).toBe(true);
  });
});

describe("transactionListQuerySchema", () => {
  it("coerces query-string numbers", () => {
    expect(transactionListQuerySchema.parse({ year: "2026", month: "10" })).toEqual({ year: 2026, month: 10 });
  });

  it("rejects month without year, out-of-range months and unknown keys", () => {
    expect(transactionListQuerySchema.safeParse({ month: "10" }).success).toBe(false);
    expect(transactionListQuerySchema.safeParse({ year: "2026", month: "13" }).success).toBe(false);
    expect(transactionListQuerySchema.safeParse({ householdId: "x" }).success).toBe(false);
  });
});

describe("upsertBudgetSchema", () => {
  it("allows a zero budget but not a negative or fractional one", () => {
    const base = { categoryId: validExpense.categoryId, year: 2026, month: 10 };
    expect(upsertBudgetSchema.safeParse({ ...base, amountAgorot: 0 }).success).toBe(true);
    expect(upsertBudgetSchema.safeParse({ ...base, amountAgorot: -1 }).success).toBe(false);
    expect(upsertBudgetSchema.safeParse({ ...base, amountAgorot: 10.5 }).success).toBe(false);
  });
});

describe("createInvitationSchema", () => {
  it("normalizes the email", () => {
    expect(createInvitationSchema.parse({ email: "  Partner@Example.COM ", role: "MEMBER" }).email).toBe(
      "partner@example.com",
    );
  });

  it("never allows inviting an OWNER", () => {
    expect(createInvitationSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success).toBe(false);
  });
});
