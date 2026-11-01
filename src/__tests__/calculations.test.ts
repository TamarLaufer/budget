import type { CategoryDto, MonthlyBudgetDto, TransactionDto } from "../../shared/api";
import {
  buildCategoryBudgets,
  buildMonthlyDashboard,
  buildMonthlySnapshot,
  calculateUsage,
  formatMonthYear,
  lastExpenseActivityByCategory,
  orderSnapshotCategories,
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
      { id: "food", name: "Food", isActive: true, budget: 300_000, spent: 240_000, hasBudget: true },
      { id: "fun", name: "Fun", isActive: true, budget: 0, spent: 95_000, hasBudget: false },
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
      { id: "a", name: "A", isActive: true, budget: 300_000, spent: 240_000, hasBudget: true },
      { id: "b", name: "B", isActive: true, budget: 80_000, spent: 95_000, hasBudget: true },
      { id: "c", name: "C", isActive: true, budget: 100_000, spent: 70_000, hasBudget: true },
    ]);
    expect(snapshot.totals).toMatchObject({ budget: 480_000, spent: 405_000, remaining: 75_000, isOver: false });
    expect(snapshot.categories.find((c) => c.id === "b")).toMatchObject({ isOver: true, remaining: -15_000 });
  });
});

describe("missing vs configured budgets", () => {
  const snapshotOf = (budgets: Pick<MonthlyBudgetDto, "categoryId" | "amountAgorot">[], transactions: Tx[]) =>
    buildMonthlySnapshot(
      buildCategoryBudgets([category("food", "Food"), category("fun", "Fun"), category("zero", "Zero")], budgets, transactions),
    );
  const byId = (snapshot: ReturnType<typeof buildMonthlySnapshot>, id: string) =>
    snapshot.categories.find((c) => c.id === id);

  it("never marks a category without a budget as over budget, whatever it spent", () => {
    const fun = byId(snapshotOf([], [expense("fun", 999_999)]), "fun");
    expect(fun).toMatchObject({ hasBudget: false, budget: 0, spent: 999_999, isOver: false, remaining: 0, fill: 0 });
  });

  it("flags a configured positive budget only once spending exceeds it", () => {
    expect(byId(snapshotOf([budget("food", 100_000)], [expense("food", 99_999)]), "food")).toMatchObject({
      hasBudget: true,
      isOver: false,
      remaining: 1,
    });
    expect(byId(snapshotOf([budget("food", 100_000)], [expense("food", 100_001)]), "food")).toMatchObject({
      hasBudget: true,
      isOver: true,
      remaining: -1,
    });
  });

  it("treats an explicit zero budget as configured: any spending is over it", () => {
    const snapshot = snapshotOf([budget("zero", 0)], [expense("zero", 500), expense("fun", 500)]);
    expect(byId(snapshot, "zero")).toMatchObject({ hasBudget: true, isOver: true, remaining: -500 });
    expect(byId(snapshot, "fun")).toMatchObject({ hasBudget: false, isOver: false });
  });

  it("counts unbudgeted spending in the month's expense totals", () => {
    const snapshot = snapshotOf([budget("food", 100_000)], [expense("food", 30_000), expense("fun", 20_000)]);
    expect(snapshot.totals).toMatchObject({ budget: 100_000, spent: 50_000, remaining: 50_000, isOver: false });
    const dashboard = buildMonthlyDashboard(
      [category("food", "Food"), category("fun", "Fun")],
      [budget("food", 100_000)],
      [expense("food", 30_000), expense("fun", 20_000), income(100_000)],
    );
    expect(dashboard.net).toBe(50_000);
  });

  it("does not report the month as over budget when no budget is configured at all", () => {
    expect(snapshotOf([], [expense("fun", 20_000)]).totals).toMatchObject({ spent: 20_000, isOver: false });
  });

  it("sorts unbudgeted categories by activity among the non-over ones, never into the over group", () => {
    const snapshot = snapshotOf(
      [budget("food", 100), budget("zero", 100_000)],
      [expense("food", 500), expense("fun", 999_999), expense("zero", 10)],
    );
    const activity = new Map([
      ["fun", Date.parse("2026-10-30T10:00:00Z")],
      ["zero", Date.parse("2026-10-01T10:00:00Z")],
    ]);
    const ordered = orderSnapshotCategories(snapshot.categories, activity);
    expect(ordered.map((c) => c.id)).toEqual(["food", "fun", "zero"]);
    expect(ordered.filter((c) => c.isOver).map((c) => c.id)).toEqual(["food"]);
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

describe("Monthly Snapshot category order", () => {
  type Summary = Parameters<typeof orderSnapshotCategories>[0][number];
  const summary = (id: string, overrides: Partial<Summary> = {}): Summary => ({
    id,
    name: id,
    isActive: true,
    isOver: false,
    remaining: 0,
    ...overrides,
  });
  const ids = (list: readonly { id: string }[]) => list.map((c) => c.id);
  const activityTx = (categoryId: string, createdAt: string, updatedAt = createdAt) => ({
    ...expense(categoryId, 100),
    createdAt,
    updatedAt,
  });

  it("puts active over-budget categories first, by overspend amount", () => {
    const ordered = orderSnapshotCategories(
      [
        summary("calm"),
        summary("small-over", { isOver: true, remaining: -100 }),
        summary("big-over", { isOver: true, remaining: -5_000 }),
      ],
      new Map([["calm", Date.parse("2026-10-30T10:00:00Z")]]),
    );
    expect(ids(ordered)).toEqual(["big-over", "small-over", "calm"]);
  });

  it("orders the rest by latest activity, categories without activity after them", () => {
    const ordered = orderSnapshotCategories(
      [summary("none"), summary("older"), summary("newer")],
      new Map([
        ["older", Date.parse("2026-10-01T10:00:00Z")],
        ["newer", Date.parse("2026-10-20T10:00:00Z")],
      ]),
    );
    expect(ids(ordered)).toEqual(["newer", "older", "none"]);
  });

  it("keeps inactive categories last even when over budget", () => {
    const ordered = orderSnapshotCategories(
      [
        summary("old-over", { isActive: false, isOver: true, remaining: -99_000 }),
        summary("old", { isActive: false }),
        summary("idle"),
        summary("over", { isOver: true, remaining: -1 }),
      ],
      new Map([["old", Date.parse("2026-10-30T10:00:00Z")]]),
    );
    expect(ids(ordered)).toEqual(["over", "idle", "old-over", "old"]);
  });

  it("breaks ties by name, then id", () => {
    const ordered = orderSnapshotCategories(
      [
        summary("c2", { name: "Same" }),
        summary("b", { name: "Bravo" }),
        summary("c1", { name: "Same" }),
        summary("o2", { name: "Zed", isOver: true, remaining: -10 }),
        summary("o1", { name: "Alpha", isOver: true, remaining: -10 }),
      ],
      new Map(),
    );
    expect(ids(ordered)).toEqual(["o1", "o2", "b", "c1", "c2"]);
  });

  it("returns a copy and leaves the input order alone", () => {
    const input = Object.freeze([summary("b"), summary("a")]);
    const ordered = orderSnapshotCategories(input, new Map());
    expect(ids(ordered)).toEqual(["a", "b"]);
    expect(ids(input)).toEqual(["b", "a"]);
  });

  it("measures activity by entry/edit time of expenses only", () => {
    const latest = lastExpenseActivityByCategory([
      activityTx("food", "2026-10-02T08:00:00.000Z", "2026-10-29T08:00:00.000Z"),
      activityTx("food", "2026-10-05T08:00:00.000Z"),
      activityTx("fun", "2026-10-10T08:00:00.000Z"),
      { ...income(500), createdAt: "2026-10-30T08:00:00.000Z", updatedAt: "2026-10-30T08:00:00.000Z" },
    ]);
    expect(latest.get("food")).toBe(Date.parse("2026-10-29T08:00:00.000Z"));
    expect(latest.get("fun")).toBe(Date.parse("2026-10-10T08:00:00.000Z"));
    expect(latest.size).toBe(2);
  });
});
