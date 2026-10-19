import type { CategoryDto, MonthlyBudgetDto, TransactionDto } from "../../shared/api";
import {
  buildCategoryBudgets,
  buildMonthlyDashboard,
  buildMonthlySnapshot,
  calculateUsage,
  formatMonthYear,
  spentByCategory,
  totalIncome,
} from "../budget/calculations";

type Tx = Pick<TransactionDto, "type" | "amountAgorot" | "categoryId">;
const expense = (categoryId: string, amountAgorot: number): Tx => ({ type: "EXPENSE", amountAgorot, categoryId });
const income = (amountAgorot: number): Tx => ({ type: "INCOME", amountAgorot, categoryId: null });

const category = (id: string, name: string, isActive = true): Pick<CategoryDto, "id" | "name" | "isActive"> => ({
  id,
  name,
  isActive,
});
const budget = (categoryId: string, amountAgorot: number): Pick<MonthlyBudgetDto, "categoryId" | "amountAgorot"> => ({
  categoryId,
  amountAgorot,
});

describe("calculateUsage", () => {
  it("matches the over-budget example from the spec", () => {
    expect(calculateUsage(100_000, 120_000)).toEqual({
      budget: 100_000,
      spent: 120_000,
      remaining: -20_000,
      percentUsed: 120,
      fill: 1,
      isOver: true,
    });
  });

  it("handles a partially used budget", () => {
    expect(calculateUsage(300_000, 240_000)).toMatchObject({ remaining: 60_000, percentUsed: 80, fill: 0.8, isOver: false });
  });

  it("clamps fill to 0..1 while percentUsed may exceed 100", () => {
    const usage = calculateUsage(1000, 5000);
    expect(usage.fill).toBe(1);
    expect(usage.percentUsed).toBe(500);
  });

  it("treats spending against a zero budget as fully used", () => {
    expect(calculateUsage(0, 500)).toMatchObject({ percentUsed: 100, fill: 1, isOver: true, remaining: -500 });
    expect(calculateUsage(0, 0)).toMatchObject({ percentUsed: 0, fill: 0, isOver: false });
  });

  it("is exactly at budget without being over", () => {
    expect(calculateUsage(1000, 1000)).toMatchObject({ remaining: 0, isOver: false, fill: 1, percentUsed: 100 });
  });
});

describe("spentByCategory / totalIncome", () => {
  it("sums expenses per category, ignoring income", () => {
    const totals = spentByCategory([expense("food", 1000), expense("food", 250), expense("fun", 99), income(50_000)]);
    expect(Object.fromEntries(totals)).toEqual({ food: 1250, fun: 99 });
  });

  it("keeps exact integer agorot (no floating-point drift)", () => {
    // 0.1 + 0.2 style amounts: 10 + 20 agorot is exactly 30.
    const totals = spentByCategory([expense("a", 10), expense("a", 20), ...Array.from({ length: 1000 }, () => expense("a", 1))]);
    expect(totals.get("a")).toBe(1030);
  });

  it("sums income only", () => {
    expect(totalIncome([income(1000), income(2500), expense("food", 999)])).toBe(3500);
  });
});

describe("buildCategoryBudgets", () => {
  it("joins categories with budgets and real spending", () => {
    const result = buildCategoryBudgets(
      [category("food", "Food"), category("fun", "Fun")],
      [budget("food", 300_000)],
      [expense("food", 240_000), expense("fun", 95_000)],
    );
    expect(result).toEqual([
      { id: "food", name: "Food", isActive: true, budget: 300_000, spent: 240_000 },
      { id: "fun", name: "Fun", isActive: true, budget: 0, spent: 95_000 },
    ]);
  });

  it("shows inactive categories only when the month has data for them", () => {
    const categories = [category("old", "Old", false), category("gone", "Gone", false), category("food", "Food")];
    const result = buildCategoryBudgets(categories, [], [expense("old", 100)]);
    expect(result.map((c) => c.id)).toEqual(["old", "food"]);
  });
});

describe("buildMonthlySnapshot", () => {
  it("computes overall usage from totals, not by averaging categories", () => {
    const snapshot = buildMonthlySnapshot([
      { id: "a", name: "A", isActive: true, budget: 300_000, spent: 240_000 },
      { id: "b", name: "B", isActive: true, budget: 80_000, spent: 95_000 },
      { id: "c", name: "C", isActive: true, budget: 100_000, spent: 70_000 },
    ]);
    expect(snapshot.totals).toMatchObject({ budget: 480_000, spent: 405_000, remaining: 75_000, isOver: false });
    expect(snapshot.categories.find((c) => c.id === "b")).toMatchObject({ isOver: true, remaining: -15_000 });
  });
});

describe("buildMonthlyDashboard", () => {
  it("reports income, expenses and net for the month", () => {
    const dashboard = buildMonthlyDashboard(
      [category("food", "Food")],
      [budget("food", 100_000)],
      [expense("food", 30_000), income(500_000)],
    );
    expect(dashboard.totalIncome).toBe(500_000);
    expect(dashboard.snapshot.totals.spent).toBe(30_000);
    expect(dashboard.net).toBe(470_000);
    expect(dashboard.transactionCount).toBe(2);
  });

  it("is empty for a month without data", () => {
    const dashboard = buildMonthlyDashboard([], [], []);
    expect(dashboard.snapshot.totals).toMatchObject({ budget: 0, spent: 0, remaining: 0 });
    expect(dashboard.net).toBe(0);
  });
});

describe("formatMonthYear", () => {
  it("formats in Hebrew", () => {
    expect(formatMonthYear(new Date(2026, 9, 1))).toBe("אוקטובר 2026");
  });
});
