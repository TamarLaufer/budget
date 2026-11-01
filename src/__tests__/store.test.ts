import { createStore, rootReducer } from "../store";
import {
  selectAppPhase,
  selectBudgetsForPeriod,
  selectCanManage,
  selectDashboard,
  combineLoads,
  selectLoad,
  selectSnapshotCategoriesInDisplayOrder,
  selectTransactionsForPeriod,
} from "../store/selectors";
import { householdChanged, sessionEnded } from "../store/shared";
import { firebaseUserChanged, loadMe } from "../store/slices/authSlice";
import { fetchMonthBudgets, upsertBudget } from "../store/slices/budgetsSlice";
import { fetchCategories } from "../store/slices/catalogSlices";
import { createHousehold, leaveHousehold } from "../store/slices/householdSlice";
import { periodSelected, periodShifted } from "../store/slices/periodSlice";
import {
  createTransaction,
  deleteTransaction,
  fetchMonthTransactions,
  updateTransaction,
} from "../store/slices/transactionsSlice";
import { fulfilled, pending, respond, makeBudget, makeCategory, makeTransaction, meWithHousehold } from "../test-utils/fixtures";

const october = { year: 2026, month: 10 };
const september = { year: 2026, month: 9 };

function storeAtOctober() {
  const store = createStore();
  store.dispatch(periodSelected(october));
  return store;
}

describe("transactions reducer", () => {
  it("adds the server's created transaction without refetching", () => {
    const store = storeAtOctober();
    const tx = makeTransaction();
    store.dispatch(fulfilled(createTransaction, tx, {}));
    expect(selectTransactionsForPeriod(store.getState())).toEqual([tx]);
  });

  it("replaces an updated transaction and removes a deleted one", () => {
    const store = storeAtOctober();
    const tx = makeTransaction({ amountAgorot: 100 });
    store.dispatch(fulfilled(createTransaction, tx, {}));
    store.dispatch(fulfilled(updateTransaction, { ...tx, amountAgorot: 999 }, { id: tx.id, changes: {} }));
    expect(selectTransactionsForPeriod(store.getState())[0]?.amountAgorot).toBe(999);

    store.dispatch(fulfilled(deleteTransaction, undefined, tx.id));
    expect(selectTransactionsForPeriod(store.getState())).toEqual([]);
  });

  it("refetching a month replaces that month only", () => {
    const store = storeAtOctober();
    const septTx = makeTransaction({ transactionDate: "2026-09-20" });
    const deletedElsewhere = makeTransaction({ transactionDate: "2026-10-05" });
    respond(store, fetchMonthTransactions, [septTx], september);
    respond(store, fetchMonthTransactions, [deletedElsewhere], october);

    const fresh = makeTransaction({ transactionDate: "2026-10-06" });
    respond(store, fetchMonthTransactions, [fresh], october);

    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([fresh.id]);
    store.dispatch(periodSelected(september));
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([septTx.id]);
  });

  it("sorts newest first", () => {
    const store = storeAtOctober();
    const a = makeTransaction({ transactionDate: "2026-10-01" });
    const b = makeTransaction({ transactionDate: "2026-10-20" });
    respond(store, fetchMonthTransactions, [a, b], october);
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([b.id, a.id]);
  });
});

describe("dashboard selector", () => {
  function seeded() {
    const store = storeAtOctober();
    const food = makeCategory({ id: "food", name: "Food" });
    respond(store, fetchCategories, [food], undefined);
    respond(store, fetchMonthBudgets, [makeBudget({ categoryId: "food", year: 2026, month: 9, amountAgorot: 50_000 })], september);
    respond(store, fetchMonthBudgets, [makeBudget({ categoryId: "food", amountAgorot: 100_000 })], october);
    respond(store, fetchMonthTransactions, [makeTransaction({ transactionDate: "2026-09-15", amountAgorot: 70_000 })], september);
    respond(store, fetchMonthTransactions,
        [
          makeTransaction({ amountAgorot: 120_000 }),
          makeTransaction({ type: "INCOME", categoryId: null, amountAgorot: 1_000_000 }),
        ],
        october);
    return store;
  }

  it("derives category spending from the selected month's transactions", () => {
    const store = seeded();
    const { snapshot, totalIncome, net } = selectDashboard(store.getState());
    expect(snapshot.categories[0]).toMatchObject({ budget: 100_000, spent: 120_000, remaining: -20_000, percentUsed: 120, fill: 1, isOver: true });
    expect(totalIncome).toBe(1_000_000);
    expect(net).toBe(880_000);
  });

  it("September transactions and budgets do not affect October", () => {
    const store = seeded();
    store.dispatch(periodShifted(-1));
    const sept = selectDashboard(store.getState()).snapshot.categories[0];
    expect(sept).toMatchObject({ budget: 50_000, spent: 70_000, isOver: true });

    store.dispatch(periodShifted(1));
    expect(selectDashboard(store.getState()).snapshot.categories[0]).toMatchObject({ budget: 100_000, spent: 120_000 });
  });

  it("changing October's budget leaves September's untouched", () => {
    const store = seeded();
    const octBudget = selectBudgetsForPeriod(store.getState())[0]!;
    store.dispatch(fulfilled(upsertBudget, { ...octBudget, amountAgorot: 200_000 }, {}));

    expect(selectDashboard(store.getState()).snapshot.totals.budget).toBe(200_000);
    store.dispatch(periodSelected(september));
    expect(selectDashboard(store.getState()).snapshot.totals.budget).toBe(50_000);
  });

  it("dashboard updates immediately after adding an expense", () => {
    const store = seeded();
    store.dispatch(fulfilled(createTransaction, makeTransaction({ amountAgorot: 5_000 }), {}));
    expect(selectDashboard(store.getState()).snapshot.totals.spent).toBe(125_000);
  });

  it("is memoized: same input state returns the same object", () => {
    const state = seeded().getState();
    expect(selectDashboard(state)).toBe(selectDashboard(state));
  });
});

describe("snapshot category order selector", () => {
  function seeded() {
    const store = storeAtOctober();
    respond(store, fetchCategories,
        [
          makeCategory({ id: "food", name: "Food" }),
          makeCategory({ id: "fun", name: "Fun" }),
          makeCategory({ id: "old", name: "Old", isActive: false }),
        ],
        undefined);
    respond(store, fetchMonthBudgets,
        [
          makeBudget({ categoryId: "food", amountAgorot: 100_000 }),
          makeBudget({ categoryId: "fun", amountAgorot: 100_000 }),
          makeBudget({ categoryId: "old", amountAgorot: 1 }),
        ],
        october);
    respond(store, fetchMonthTransactions,
        [
          makeTransaction({ categoryId: "food", transactionDate: "2026-10-20", createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T09:00:00.000Z" }),
          makeTransaction({ categoryId: "fun", transactionDate: "2026-10-05", createdAt: "2026-10-05T09:00:00.000Z", updatedAt: "2026-10-05T09:00:00.000Z" }),
          makeTransaction({ categoryId: "old", amountAgorot: 50_000, createdAt: "2026-10-29T09:00:00.000Z", updatedAt: "2026-10-29T09:00:00.000Z" }),
        ],
        october);
    return store;
  }
  const order = (store: ReturnType<typeof createStore>) =>
    selectSnapshotCategoriesInDisplayOrder(store.getState()).map((c) => c.id);

  it("orders active categories by recent activity and keeps over-budget inactive ones last", () => {
    expect(order(seeded())).toEqual(["food", "fun", "old"]);
  });

  it("counts a back-dated expense entered now as recent, and reorders after create, edit and delete", () => {
    const store = seeded();
    const backDated = makeTransaction({
      categoryId: "fun",
      transactionDate: "2026-10-01",
      createdAt: "2026-10-30T12:00:00.000Z",
      updatedAt: "2026-10-30T12:00:00.000Z",
    });
    store.dispatch(fulfilled(createTransaction, backDated, {}));
    expect(order(store)).toEqual(["fun", "food", "old"]);

    const edited = { ...backDated, categoryId: "food", amountAgorot: 200_000, updatedAt: "2026-10-30T13:00:00.000Z" };
    store.dispatch(fulfilled(updateTransaction, edited, { id: backDated.id, changes: {} }));
    // food is now over budget, so it leads regardless of activity.
    expect(order(store)).toEqual(["food", "fun", "old"]);
    expect(selectDashboard(store.getState()).snapshot.categories.find((c) => c.id === "food")?.isOver).toBe(true);

    store.dispatch(fulfilled(deleteTransaction, undefined, backDated.id));
    expect(order(store)).toEqual(["food", "fun", "old"]);
    expect(selectDashboard(store.getState()).snapshot.categories.find((c) => c.id === "food")?.isOver).toBe(false);
  });

  it("falls back to the previous activity once the newest expense is deleted", () => {
    const store = seeded();
    const latest = makeTransaction({ categoryId: "fun", createdAt: "2026-10-30T12:00:00.000Z", updatedAt: "2026-10-30T12:00:00.000Z" });
    store.dispatch(fulfilled(createTransaction, latest, {}));
    expect(order(store)).toEqual(["fun", "food", "old"]);

    store.dispatch(fulfilled(deleteTransaction, undefined, latest.id));
    expect(order(store)).toEqual(["food", "fun", "old"]);
  });

  it("keeps a category without a budget out of the over-budget group and the over-only filter", () => {
    const store = seeded();
    respond(store, fetchCategories,
        [
          makeCategory({ id: "food", name: "Food" }),
          makeCategory({ id: "fun", name: "Fun" }),
          makeCategory({ id: "old", name: "Old", isActive: false }),
          makeCategory({ id: "misc", name: "Misc" }),
        ],
        undefined);
    store.dispatch(fulfilled(createTransaction,
        makeTransaction({ categoryId: "misc", amountAgorot: 900_000, createdAt: "2026-10-30T12:00:00.000Z", updatedAt: "2026-10-30T12:00:00.000Z" }),
        {}));

    const ordered = selectSnapshotCategoriesInDisplayOrder(store.getState());
    expect(ordered.find((c) => c.id === "misc")).toMatchObject({ hasBudget: false, isOver: false, spent: 900_000 });
    // Newest activity among the categories that are not over budget.
    expect(ordered.map((c) => c.id)).toEqual(["misc", "food", "fun", "old"]);
    // What the "over budget only" toggle shows: only the inactive category over its configured budget.
    expect(ordered.filter((c) => c.isOver).map((c) => c.id)).toEqual(["old"]);
    // food 1,000 + fun 1,000 + old 50,000 + unbudgeted misc 900,000.
    expect(selectDashboard(store.getState()).snapshot.totals.spent).toBe(952_000);
  });

  it("is memoized and does not reorder the dashboard's own array", () => {
    const state = seeded().getState();
    const ordered = selectSnapshotCategoriesInDisplayOrder(state);
    expect(selectSnapshotCategoriesInDisplayOrder(state)).toBe(ordered);
    expect(ordered).not.toBe(selectDashboard(state).snapshot.categories);
  });
});

/** What the dashboard's load state was before screens chose their own data sets. */
const periodLoad = (state: ReturnType<ReturnType<typeof createStore>["getState"]>) =>
  combineLoads((["transactions", "budgets", "categories"] as const).map((d) => selectLoad(state, d)));

describe("load state", () => {
  it("is loaded only when transactions, budgets and categories are all in", () => {
    const store = storeAtOctober();
    expect(periodLoad(store.getState()).loaded).toBe(false);
    respond(store, fetchMonthTransactions, [], october);
    respond(store, fetchMonthBudgets, [], october);
    expect(periodLoad(store.getState()).loaded).toBe(false);
    respond(store, fetchCategories, [], undefined);
    expect(periodLoad(store.getState())).toEqual({ status: "succeeded", error: null, loaded: true });
  });

  it("keeps data marked as loaded while a refetch fails", () => {
    const store = storeAtOctober();
    respond(store, fetchMonthTransactions, [], october);
    respond(store, fetchMonthBudgets, [], october);
    respond(store, fetchCategories, [], undefined);
    store.dispatch(pending(fetchMonthTransactions, october, "x"));
    store.dispatch({
      type: fetchMonthTransactions.rejected.type,
      payload: { status: 0, code: "NETWORK_ERROR", message: "offline" },
      meta: { arg: october, requestId: "x", requestStatus: "rejected", rejectedWithValue: true, aborted: false, condition: false },
      error: {},
    });
    expect(periodLoad(store.getState())).toMatchObject({ status: "failed", loaded: true, error: { code: "NETWORK_ERROR" } });
  });
});

describe("session and household state", () => {
  it("walks through the app phases", () => {
    const store = createStore();
    expect(selectAppPhase(store.getState())).toBe("initializing");
    store.dispatch(firebaseUserChanged(null));
    expect(selectAppPhase(store.getState())).toBe("signedOut");
    store.dispatch(firebaseUserChanged({ uid: "u", email: "a@example.com", emailVerified: true }));
    expect(selectAppPhase(store.getState())).toBe("loadingProfile");
    store.dispatch(fulfilled(loadMe, { ...meWithHousehold, membership: null }, undefined));
    expect(selectAppPhase(store.getState())).toBe("onboarding");
    store.dispatch(fulfilled(createHousehold, meWithHousehold.membership, { name: "Home" }));
    expect(selectAppPhase(store.getState())).toBe("ready");
    expect(selectCanManage(store.getState())).toBe(true);
    store.dispatch(fulfilled(leaveHousehold, undefined, "member-id"));
    expect(selectAppPhase(store.getState())).toBe("onboarding");
  });

  it("reports a profile error when /me fails", () => {
    const store = createStore();
    store.dispatch(firebaseUserChanged({ uid: "u", email: null, emailVerified: false }));
    store.dispatch({ type: loadMe.rejected.type, payload: { status: 0, code: "NETWORK_ERROR", message: "" }, meta: { arg: undefined } });
    expect(selectAppPhase(store.getState())).toBe("profileError");
  });

  it("MEMBER cannot manage", () => {
    const store = createStore();
    store.dispatch(fulfilled(loadMe, { ...meWithHousehold, membership: { ...meWithHousehold.membership!, role: "MEMBER" } }, undefined));
    expect(selectCanManage(store.getState())).toBe(false);
  });

  it("sign-out clears every slice so the next account sees nothing from the previous one", () => {
    const store = storeAtOctober();
    store.dispatch(firebaseUserChanged({ uid: "u", email: "a@example.com", emailVerified: true }));
    store.dispatch(fulfilled(loadMe, meWithHousehold, undefined));
    store.dispatch(fulfilled(createTransaction, makeTransaction(), {}));
    respond(store, fetchCategories, [makeCategory()], undefined);

    store.dispatch(sessionEnded());
    const state = store.getState();
    expect(state.auth).toMatchObject({ status: "signedOut", me: null, firebaseUser: null });
    expect(state.transactions.ids).toEqual([]);
    expect(state.categories.ids).toEqual([]);
  });

  it("changing household clears household data but keeps the session", () => {
    const state0 = rootReducer(undefined, fulfilled(loadMe, meWithHousehold, undefined));
    const state1 = rootReducer(state0, fulfilled(createTransaction, makeTransaction(), {}));
    const state2 = rootReducer(state1, householdChanged());
    expect(state2.transactions.ids).toEqual([]);
    expect(state2.auth.me).toEqual(meWithHousehold);
  });
});
