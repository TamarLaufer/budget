import type { TransactionDto } from "../../shared/api";
import { filterTransactions, noFilters } from "../budget/filters";
import { fromDateOnly, isDateInPeriod, periodKey, shiftPeriod, toDateOnly } from "../budget/period";

describe("period helpers", () => {
  it("shifts across year boundaries", () => {
    expect(shiftPeriod({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftPeriod({ year: 2026, month: 10 }, -13)).toEqual({ year: 2025, month: 9 });
  });

  it("matches dates to their month only", () => {
    const october = { year: 2026, month: 10 };
    expect(periodKey(october)).toBe("2026-10");
    expect(isDateInPeriod("2026-10-01", october)).toBe(true);
    expect(isDateInPeriod("2026-10-31", october)).toBe(true);
    expect(isDateInPeriod("2026-09-30", october)).toBe(false);
    expect(isDateInPeriod("2026-11-01", october)).toBe(false);
    expect(isDateInPeriod("2025-10-15", october)).toBe(false);
  });

  it("converts local dates without time-zone shifts", () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateOnly(fromDateOnly("2026-10-31"))).toBe("2026-10-31");
  });
});

const tx = (overrides: Partial<TransactionDto>): TransactionDto => ({
  id: Math.random().toString(36),
  type: "EXPENSE",
  amountAgorot: 100,
  categoryId: "food",
  description: null,
  transactionDate: "2026-10-01",
  paymentMethodId: null,
  incomeSource: null,
  createdBy: { id: "u1", email: "a@example.com", displayName: null },
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

describe("filterTransactions", () => {
  const names = new Map([
    ["food", "מזון"],
    ["fun", "בילויים"],
  ]);
  const all = [
    tx({ id: "1", description: "Supermarket" }),
    tx({ id: "2", categoryId: "fun", description: "Cinema" }),
    tx({ id: "3", type: "INCOME", categoryId: null, incomeSource: "Salary" }),
  ];

  it("returns everything without filters", () => {
    expect(filterTransactions(all, noFilters, names)).toHaveLength(3);
  });

  it("filters by type and category", () => {
    expect(filterTransactions(all, { ...noFilters, type: "INCOME" }, names).map((t) => t.id)).toEqual(["3"]);
    expect(filterTransactions(all, { ...noFilters, categoryId: "fun" }, names).map((t) => t.id)).toEqual(["2"]);
  });

  it("searches description, income source and category name case-insensitively", () => {
    expect(filterTransactions(all, { ...noFilters, query: "super" }, names).map((t) => t.id)).toEqual(["1"]);
    expect(filterTransactions(all, { ...noFilters, query: "SALARY" }, names).map((t) => t.id)).toEqual(["3"]);
    expect(filterTransactions(all, { ...noFilters, query: "בילוי" }, names).map((t) => t.id)).toEqual(["2"]);
  });
});
