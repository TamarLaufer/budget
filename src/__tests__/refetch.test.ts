import type { PaymentMethodDto } from "../../shared/api";
import { createStore } from "../store";
import {
  categorySelectors,
  paymentMethodSelectors,
  selectBudgetsForPeriod,
  selectDashboard,
  selectTransactionsForPeriod,
} from "../store/selectors";
import { fetchMonthBudgets } from "../store/slices/budgetsSlice";
import { fetchCategories, fetchPaymentMethods } from "../store/slices/catalogSlices";
import { periodSelected } from "../store/slices/periodSlice";
import { fetchMonthTransactions } from "../store/slices/transactionsSlice";
import { respond, makeBudget, makeCategory, makeTransaction } from "../test-utils/fixtures";

const october = { year: 2026, month: 10 };
const september = { year: 2026, month: 9 };

/** A refetch delivers equal data in new objects, like a fresh JSON response. */
const fresh = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function storeAtOctober() {
  const store = createStore();
  store.dispatch(periodSelected(october));
  return store;
}

describe("refetching transactions", () => {
  function seeded() {
    const store = storeAtOctober();
    const sept = makeTransaction({ transactionDate: "2026-09-20" });
    const a = makeTransaction({ transactionDate: "2026-10-01", amountAgorot: 1_000 });
    const b = makeTransaction({ transactionDate: "2026-10-15", amountAgorot: 2_000 });
    respond(store, fetchMonthTransactions, [sept], september);
    respond(store, fetchMonthTransactions, [a, b], october);
    return { store, sept, a, b };
  }

  it("an identical response leaves the records, their collections and derived lists untouched", () => {
    const { store, a, b } = seeded();
    const before = store.getState();
    const listBefore = selectTransactionsForPeriod(before);

    respond(store, fetchMonthTransactions, fresh([a, b]), october);
    const after = store.getState();

    expect(after.transactions.entities).toBe(before.transactions.entities);
    expect(after.transactions.ids).toBe(before.transactions.ids);
    expect(selectTransactionsForPeriod(after)).toBe(listBefore);
  });

  it("a modified record is replaced; the others keep their identity", () => {
    const { store, sept, a, b } = seeded();
    const before = store.getState().transactions;

    respond(store, fetchMonthTransactions, fresh([a, { ...b, amountAgorot: 2_500, createdBy: { ...b.createdBy, displayName: "B" } }]), october);
    const after = store.getState().transactions;

    expect(after.entities[b.id]).toMatchObject({ amountAgorot: 2_500, createdBy: { displayName: "B" } });
    expect(after.entities[a.id]).toBe(before.entities[a.id]);
    expect(after.entities[sept.id]).toBe(before.entities[sept.id]);
  });

  it("re-sorts when a record's date changes", () => {
    const { store, a, b } = seeded();
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([b.id, a.id]);

    respond(store, fetchMonthTransactions, fresh([{ ...a, transactionDate: "2026-10-20" }, b]), october);
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it("adds new records and drops the month's records the server no longer returns", () => {
    const { store, sept, a, b } = seeded();
    const added = makeTransaction({ transactionDate: "2026-10-09" });

    respond(store, fetchMonthTransactions, fresh([b, added]), october);

    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([b.id, added.id]);
    expect(store.getState().transactions.entities[a.id]).toBeUndefined();
    // Other months are not touched by an October refetch.
    store.dispatch(periodSelected(september));
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([sept.id]);
  });

  it("a record moved into the month from another one is updated, not duplicated", () => {
    const { store, sept, a, b } = seeded();

    respond(store, fetchMonthTransactions, fresh([a, b, { ...sept, transactionDate: "2026-10-05" }]), october);

    expect(store.getState().transactions.ids).toHaveLength(3);
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([b.id, sept.id, a.id]);
  });
});

describe("refetching budgets", () => {
  function seeded() {
    const store = storeAtOctober();
    const sept = makeBudget({ month: 9, categoryId: "food" });
    const food = makeBudget({ categoryId: "food", amountAgorot: 100_000 });
    const rent = makeBudget({ categoryId: "rent", amountAgorot: 400_000 });
    respond(store, fetchMonthBudgets, [sept], september);
    respond(store, fetchMonthBudgets, [food, rent], october);
    return { store, sept, food, rent };
  }

  it("an identical response leaves the records and derived lists untouched", () => {
    const { store, food, rent } = seeded();
    const before = store.getState();
    const listBefore = selectBudgetsForPeriod(before);

    respond(store, fetchMonthBudgets, fresh([food, rent]), october);

    expect(store.getState().budgets.entities).toBe(before.budgets.entities);
    expect(store.getState().budgets.ids).toBe(before.budgets.ids);
    expect(selectBudgetsForPeriod(store.getState())).toBe(listBefore);
  });

  it("updates changed, adds new and drops removed budgets of that month only", () => {
    const { store, sept, food, rent } = seeded();
    const fun = makeBudget({ categoryId: "fun", amountAgorot: 50_000 });

    respond(store, fetchMonthBudgets, fresh([{ ...rent, amountAgorot: 450_000 }, fun]), october);
    const state = store.getState();

    expect(selectBudgetsForPeriod(state).map((b) => [b.id, b.amountAgorot])).toEqual([
      [rent.id, 450_000],
      [fun.id, 50_000],
    ]);
    expect(state.budgets.entities[food.id]).toBeUndefined();
    // Same order as before the change: other months first, then this month as received.
    expect(state.budgets.ids).toEqual([sept.id, rent.id, fun.id]);
  });
});

describe("refetching categories and payment methods", () => {
  it("an identical category list leaves the records untouched", () => {
    const store = storeAtOctober();
    const categories = [makeCategory({ name: "Food" }), makeCategory({ name: "Rent" })];
    respond(store, fetchCategories, categories, undefined);
    const before = store.getState().categories;

    respond(store, fetchCategories, fresh(categories), undefined);

    expect(store.getState().categories.entities).toBe(before.entities);
    expect(store.getState().categories.ids).toBe(before.ids);
  });

  it("renames, adds and removes categories, kept in creation order", () => {
    const store = storeAtOctober();
    const [food, rent, fun] = [makeCategory({ name: "Food" }), makeCategory({ name: "Rent" }), makeCategory({ name: "Fun" })];
    respond(store, fetchCategories, [food, rent], undefined);
    const foodBefore = store.getState().categories.entities[food.id];

    respond(store, fetchCategories, fresh([fun!, { ...rent!, name: "Housing" }, food!]), undefined);

    expect(categorySelectors.selectAll(store.getState()).map((c) => c.name)).toEqual(["Food", "Housing", "Fun"]);
    expect(store.getState().categories.entities[food!.id]).toBe(foodBefore);

    respond(store, fetchCategories, fresh([food!]), undefined);
    expect(categorySelectors.selectAll(store.getState()).map((c) => c.name)).toEqual(["Food"]);
  });

  it("payment methods keep the server's order, as before", () => {
    const store = storeAtOctober();
    const cash: PaymentMethodDto = { id: "cash", name: "Cash", isActive: true };
    const card: PaymentMethodDto = { id: "card", name: "Card", isActive: true };
    const bank: PaymentMethodDto = { id: "bank", name: "Bank", isActive: false };
    respond(store, fetchPaymentMethods, [cash, card], undefined);
    const before = store.getState().paymentMethods;

    respond(store, fetchPaymentMethods, fresh([cash, card]), undefined);
    expect(store.getState().paymentMethods.entities).toBe(before.entities);
    expect(store.getState().paymentMethods.ids).toBe(before.ids);

    respond(store, fetchPaymentMethods, fresh([bank, card]), undefined);
    expect(paymentMethodSelectors.selectAll(store.getState())).toEqual([bank, card]);
    expect(store.getState().paymentMethods.entities[card.id]).toBe(before.entities[card.id]);
  });
});

describe("dashboard after refetches", () => {
  function seeded() {
    const store = storeAtOctober();
    const food = makeCategory({ id: "food", name: "Food" });
    const budget = makeBudget({ categoryId: "food", amountAgorot: 100_000 });
    const expense = makeTransaction({ amountAgorot: 120_000 });
    const income = makeTransaction({ type: "INCOME", categoryId: null, amountAgorot: 1_000_000 });
    respond(store, fetchCategories, [food], undefined);
    respond(store, fetchMonthBudgets, [budget], october);
    respond(store, fetchMonthTransactions, [expense, income], october);
    return { store, food, budget, expense, income };
  }

  it("identical responses return the very same dashboard with the same numbers", () => {
    const { store, food, budget, expense, income } = seeded();
    const dashboard = selectDashboard(store.getState());

    respond(store, fetchCategories, fresh([food]), undefined);
    respond(store, fetchMonthBudgets, fresh([budget]), october);
    respond(store, fetchMonthTransactions, fresh([expense, income]), october);

    expect(selectDashboard(store.getState())).toBe(dashboard);
    expect(dashboard.snapshot.categories[0]).toMatchObject({ budget: 100_000, spent: 120_000, remaining: -20_000, percentUsed: 120, isOver: true });
    expect(dashboard.totalIncome).toBe(1_000_000);
    expect(dashboard.net).toBe(880_000);
  });

  it("changed responses are reflected in the calculations", () => {
    const { store, food, budget, expense, income } = seeded();

    respond(store, fetchMonthBudgets, fresh([{ ...budget, amountAgorot: 150_000 }]), october);
    respond(store, fetchMonthTransactions, fresh([{ ...expense, amountAgorot: 90_000 }, income]), october);
    respond(store, fetchCategories, fresh([food]), undefined);
    const { snapshot, totalIncome, net } = selectDashboard(store.getState());

    expect(snapshot.categories[0]).toMatchObject({ budget: 150_000, spent: 90_000, remaining: 60_000, percentUsed: 60, isOver: false });
    expect(snapshot.totals).toMatchObject({ budget: 150_000, spent: 90_000 });
    expect(totalIncome).toBe(1_000_000);
    expect(net).toBe(910_000);
  });
});
