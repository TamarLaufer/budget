import { api } from "../api/endpoints";
import { createStore } from "../store";
import { selectDashboard, selectLoad, selectTransactionsForPeriod } from "../store/selectors";
import { dataInvalidated, FRESH_FOR_MS, householdChanged } from "../store/shared";
import { deleteBudget, fetchMonthBudgets, upsertBudget } from "../store/slices/budgetsSlice";
import { createCategory, fetchCategories, fetchPaymentMethods } from "../store/slices/catalogSlices";
import { periodSelected } from "../store/slices/periodSlice";
import {
  createTransaction,
  deleteTransaction,
  fetchMonthTransactions,
  updateTransaction,
} from "../store/slices/transactionsSlice";
import { makeBudget, makeCategory, makeTransaction } from "../test-utils/fixtures";

jest.mock("../api/endpoints", () => ({
  api: {
    transactions: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
    budgets: { list: jest.fn(), upsert: jest.fn(), remove: jest.fn() },
    categories: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
    paymentMethods: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const mockApi = api as unknown as {
  transactions: Record<"list" | "create" | "update" | "remove", jest.Mock>;
  budgets: Record<"list" | "upsert" | "remove", jest.Mock>;
  categories: Record<"list" | "create" | "update", jest.Mock>;
  paymentMethods: Record<"list" | "create" | "update", jest.Mock>;
};

const october = { year: 2026, month: 10 };
const september = { year: 2026, month: 9 };

/** A request whose response the test sends when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let now = 1_000_000;

beforeEach(() => {
  jest.resetAllMocks();
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  for (const group of Object.values(mockApi)) {
    for (const fn of Object.values(group)) fn.mockResolvedValue([]);
  }
});

function storeAtOctober() {
  const store = createStore();
  store.dispatch(periodSelected(october));
  return store;
}

describe("freshness", () => {
  it("fetches missing data, then reuses it instead of fetching again", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchMonthTransactions(october));
    const state = store.getState();

    await store.dispatch(fetchMonthTransactions(october));

    expect(mockApi.transactions.list).toHaveBeenCalledTimes(1);
    expect(store.getState()).toBe(state); // nothing dispatched, nothing re-rendered
  });

  it("fetches again once the data is older than the freshness limit", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchCategories());

    now += FRESH_FOR_MS - 1;
    await store.dispatch(fetchCategories());
    expect(mockApi.categories.list).toHaveBeenCalledTimes(1);

    now += 1;
    await store.dispatch(fetchCategories());
    expect(mockApi.categories.list).toHaveBeenCalledTimes(2);
  });

  it("measures age from when the request was sent, not when it answered", async () => {
    const store = storeAtOctober();
    const response = deferred<never[]>();
    mockApi.categories.list.mockReturnValueOnce(response.promise);

    const request = store.dispatch(fetchCategories());
    now += 60_000;
    response.resolve([]);
    await request;

    expect(store.getState().categories.load.fetchedAt).toBe(1_000_000);
  });

  it("refetches fresh data after the app returns to the foreground", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchMonthBudgets(october));

    store.dispatch(dataInvalidated());
    expect(selectLoad(store.getState(), "budgets").stale).toBe(true);
    await store.dispatch(fetchMonthBudgets(october));

    expect(mockApi.budgets.list).toHaveBeenCalledTimes(2);
    expect(selectLoad(store.getState(), "budgets").stale).toBe(false);
  });

  it("marks only loaded data stale", () => {
    const store = storeAtOctober();
    store.dispatch(dataInvalidated());
    expect(store.getState().categories.load.stale).toBe(false);
  });

  it("a forced refresh fetches even fresh data", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchPaymentMethods());
    await store.dispatch(fetchPaymentMethods({ force: true }));
    expect(mockApi.paymentMethods.list).toHaveBeenCalledTimes(2);
  });

  it("retries a first load that failed on the next request", async () => {
    const store = storeAtOctober();
    mockApi.categories.list.mockRejectedValueOnce(new Error("offline"));
    await store.dispatch(fetchCategories());
    expect(store.getState().categories.load).toMatchObject({ status: "failed", loaded: false });

    await store.dispatch(fetchCategories());
    expect(mockApi.categories.list).toHaveBeenCalledTimes(2);
    expect(store.getState().categories.load).toMatchObject({ status: "succeeded", loaded: true });
  });

  it("does not send the client-side force option to the server", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchMonthTransactions({ ...october, force: true }));
    await store.dispatch(fetchMonthBudgets({ ...october, force: true }));
    expect(mockApi.transactions.list).toHaveBeenCalledWith(october);
    expect(mockApi.budgets.list).toHaveBeenCalledWith(october);
  });
});

describe("month switching", () => {
  it("fetches a new month once and reuses months already loaded", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchMonthTransactions(october));

    store.dispatch(periodSelected(september));
    await store.dispatch(fetchMonthTransactions(september));
    store.dispatch(periodSelected(october));
    await store.dispatch(fetchMonthTransactions(october));
    store.dispatch(periodSelected(september));
    await store.dispatch(fetchMonthTransactions(september));

    expect(mockApi.transactions.list.mock.calls).toEqual([[october], [september]]);
  });

  it("each month keeps its own freshness", async () => {
    const store = storeAtOctober();
    await store.dispatch(fetchMonthBudgets(october));
    now += FRESH_FOR_MS;
    await store.dispatch(fetchMonthBudgets(september));
    await store.dispatch(fetchMonthBudgets(september));
    await store.dispatch(fetchMonthBudgets(october));

    expect(mockApi.budgets.list.mock.calls).toEqual([[october], [september], [october]]);
  });
});

describe("request deduplication", () => {
  it("sends one request when the same data is requested again while in flight", async () => {
    const store = storeAtOctober();
    const response = deferred<ReturnType<typeof makeTransaction>[]>();
    mockApi.transactions.list.mockReturnValueOnce(response.promise);
    const tx = makeTransaction();

    const first = store.dispatch(fetchMonthTransactions(october));
    const second = store.dispatch(fetchMonthTransactions(october));
    const forced = store.dispatch(fetchMonthTransactions({ ...october, force: true }));
    response.resolve([tx]);
    await Promise.all([first, second, forced]);

    expect(mockApi.transactions.list).toHaveBeenCalledTimes(1);
    expect(selectTransactionsForPeriod(store.getState())).toEqual([tx]);
  });

  it("different months are separate requests", async () => {
    const store = storeAtOctober();
    mockApi.transactions.list.mockReturnValue(new Promise(() => {}));
    void store.dispatch(fetchMonthTransactions(october));
    void store.dispatch(fetchMonthTransactions(september));
    expect(mockApi.transactions.list).toHaveBeenCalledTimes(2);
  });
});

describe("fetches racing with changes made in the app", () => {
  it("a fetch in flight does not undo a transaction created meanwhile", async () => {
    const store = storeAtOctober();
    const existing = makeTransaction({ transactionDate: "2026-10-01" });
    const created = makeTransaction({ transactionDate: "2026-10-02", amountAgorot: 5_000 });
    const response = deferred<ReturnType<typeof makeTransaction>[]>();
    mockApi.transactions.list.mockReturnValueOnce(response.promise);
    mockApi.transactions.create.mockResolvedValueOnce(created);

    const fetching = store.dispatch(fetchMonthTransactions(october));
    await store.dispatch(createTransaction({} as never));
    response.resolve([existing]); // answered before the create reached the server
    await fetching;

    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toContain(created.id);
    // The response is dropped and the month fetched again on next use.
    expect(selectLoad(store.getState(), "transactions")).toMatchObject({ status: "idle", stale: true });
    mockApi.transactions.list.mockResolvedValueOnce([created, existing]);
    await store.dispatch(fetchMonthTransactions(october));
    expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual([created.id, existing.id]);
  });

  it("a fetch in flight does not bring back a transaction deleted meanwhile", async () => {
    const store = storeAtOctober();
    const tx = makeTransaction();
    await store.dispatch(fetchMonthTransactions(october)); // empty month
    store.dispatch({ type: createTransaction.fulfilled.type, payload: tx, meta: { arg: {}, requestId: "c" } });

    const response = deferred<ReturnType<typeof makeTransaction>[]>();
    mockApi.transactions.list.mockReturnValueOnce(response.promise);
    const fetching = store.dispatch(fetchMonthTransactions({ ...october, force: true }));
    mockApi.transactions.remove.mockResolvedValueOnce(undefined);
    await store.dispatch(deleteTransaction(tx.id));
    response.resolve([tx]);
    await fetching;

    expect(store.getState().transactions.entities[tx.id]).toBeUndefined();
  });

  it("a fetch in flight does not revert an edit made meanwhile", async () => {
    const store = storeAtOctober();
    const tx = makeTransaction({ amountAgorot: 1_000 });
    mockApi.transactions.list.mockResolvedValueOnce([tx]);
    await store.dispatch(fetchMonthTransactions(october));

    const response = deferred<ReturnType<typeof makeTransaction>[]>();
    mockApi.transactions.list.mockReturnValueOnce(response.promise);
    const fetching = store.dispatch(fetchMonthTransactions({ ...october, force: true }));
    mockApi.transactions.update.mockResolvedValueOnce({ ...tx, amountAgorot: 9_000 });
    await store.dispatch(updateTransaction({ id: tx.id, changes: {} }));
    response.resolve([tx]);
    await fetching;

    expect(store.getState().transactions.entities[tx.id]?.amountAgorot).toBe(9_000);
  });

  it("budgets and categories are protected the same way", async () => {
    const store = storeAtOctober();
    const budgetsResponse = deferred<ReturnType<typeof makeBudget>[]>();
    const categoriesResponse = deferred<ReturnType<typeof makeCategory>[]>();
    mockApi.budgets.list.mockReturnValueOnce(budgetsResponse.promise);
    mockApi.categories.list.mockReturnValueOnce(categoriesResponse.promise);
    const budget = makeBudget({ amountAgorot: 70_000 });
    const category = makeCategory({ name: "New" });
    mockApi.budgets.upsert.mockResolvedValueOnce(budget);
    mockApi.categories.create.mockResolvedValueOnce(category);

    const fetching = [store.dispatch(fetchMonthBudgets(october)), store.dispatch(fetchCategories())];
    await store.dispatch(upsertBudget({} as never));
    await store.dispatch(createCategory("New"));
    budgetsResponse.resolve([]);
    categoriesResponse.resolve([]);
    await Promise.all(fetching);

    expect(store.getState().budgets.entities[budget.id]).toEqual(budget);
    expect(store.getState().categories.entities[category.id]).toEqual(category);
  });

  it("a change that finished before the fetch was sent does not drop its response", async () => {
    const store = storeAtOctober();
    const budget = makeBudget();
    mockApi.budgets.upsert.mockResolvedValueOnce(budget);
    mockApi.budgets.remove.mockResolvedValueOnce(undefined);
    await store.dispatch(upsertBudget({} as never));
    await store.dispatch(deleteBudget(budget.id));

    mockApi.budgets.list.mockResolvedValueOnce([budget]);
    await store.dispatch(fetchMonthBudgets(october));

    expect(store.getState().budgets.entities[budget.id]).toEqual(budget);
    expect(selectLoad(store.getState(), "budgets")).toMatchObject({ status: "succeeded", stale: false });
  });
});

describe("changes made in the app", () => {
  it("show up immediately without refetching", async () => {
    const store = storeAtOctober();
    const food = makeCategory({ id: "food" });
    mockApi.categories.list.mockResolvedValueOnce([food]);
    mockApi.budgets.list.mockResolvedValueOnce([makeBudget({ categoryId: "food", amountAgorot: 100_000 })]);
    await store.dispatch(fetchCategories());
    await store.dispatch(fetchMonthBudgets(october));
    await store.dispatch(fetchMonthTransactions(october));

    mockApi.transactions.create.mockResolvedValueOnce(makeTransaction({ categoryId: "food", amountAgorot: 30_000 }));
    await store.dispatch(createTransaction({} as never));

    expect(selectDashboard(store.getState()).snapshot.totals).toMatchObject({ budget: 100_000, spent: 30_000 });
    // Still fresh: no list request follows the change.
    await store.dispatch(fetchMonthTransactions(october));
    expect(mockApi.transactions.list).toHaveBeenCalledTimes(1);
  });
});

describe("household isolation", () => {
  it("a response that arrives after switching household is ignored, and the new household loads fresh", async () => {
    const store = storeAtOctober();
    const oldResponse = deferred<ReturnType<typeof makeTransaction>[]>();
    mockApi.transactions.list.mockReturnValueOnce(oldResponse.promise);

    const fetching = store.dispatch(fetchMonthTransactions(october));
    store.dispatch(householdChanged());
    oldResponse.resolve([makeTransaction()]);
    await fetching;

    expect(store.getState().transactions.ids).toEqual([]);
    expect(selectLoad(store.getState(), "transactions").loaded).toBe(false);
    await store.dispatch(fetchMonthTransactions(october));
    expect(mockApi.transactions.list).toHaveBeenCalledTimes(2);
  });
});
