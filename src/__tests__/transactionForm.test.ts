import type { TransactionDto } from "../../shared/api";
import { emptyFormValues, formValuesFromTransaction, validateTransactionForm } from "../budget/transactionForm";

const base = { ...emptyFormValues("2026-10-15"), amount: "87.90", categoryId: "food" };

describe("validateTransactionForm", () => {
  it("builds an API request with integer agorot", () => {
    const result = validateTransactionForm({ ...base, description: "  Groceries  " });
    expect(result).toEqual({
      ok: true,
      request: {
        type: "EXPENSE",
        amountAgorot: 8790,
        categoryId: "food",
        transactionDate: "2026-10-15",
        description: "Groceries",
        paymentMethodId: null,
        incomeSource: null,
      },
    });
  });

  it("requires a category for expenses but not for income", () => {
    expect(validateTransactionForm({ ...base, categoryId: null })).toEqual({
      ok: false,
      errors: { categoryId: "CATEGORY_REQUIRED" },
    });
    const income = validateTransactionForm({ ...base, type: "INCOME", categoryId: null, incomeSource: "Salary" });
    expect(income.ok && income.request).toMatchObject({ type: "INCOME", categoryId: null, incomeSource: "Salary" });
  });

  it.each([
    ["", "AMOUNT_INVALID"],
    ["abc", "AMOUNT_INVALID"],
    ["-10", "AMOUNT_INVALID"],
    ["1.234", "AMOUNT_INVALID"],
    ["0", "AMOUNT_ZERO"],
    ["0.00", "AMOUNT_ZERO"],
  ])("rejects amount %p with %s", (amount, key) => {
    expect(validateTransactionForm({ ...base, amount })).toEqual({ ok: false, errors: { amount: key } });
  });

  it("rejects an overly long description and a malformed date", () => {
    const result = validateTransactionForm({ ...base, description: "x".repeat(301), transactionDate: "15/10/2026" });
    expect(result).toEqual({ ok: false, errors: { description: "TOO_LONG", transactionDate: "DATE_INVALID" } });
  });

  it("drops an income source left over when switching to expense", () => {
    const result = validateTransactionForm({ ...base, incomeSource: "Salary" });
    expect(result.ok && result.request.incomeSource).toBeNull();
  });

  it("pre-fills the edit form from a transaction", () => {
    const t = {
      type: "EXPENSE",
      amountAgorot: 125_050,
      categoryId: "food",
      transactionDate: "2026-10-02",
      description: null,
      paymentMethodId: "visa",
      incomeSource: null,
    } as TransactionDto;
    expect(formValuesFromTransaction(t)).toEqual({
      type: "EXPENSE",
      amount: "1250.50",
      categoryId: "food",
      transactionDate: "2026-10-02",
      description: "",
      paymentMethodId: "visa",
      incomeSource: "",
    });
  });
});
