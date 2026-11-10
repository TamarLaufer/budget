import { createStore } from "../store";
import { selectRecentTransactionsForPeriod, selectTransactionsForPeriod } from "../store/selectors";
import { periodSelected } from "../store/slices/periodSlice";
import {
  compareTransactions,
  createTransaction,
  deleteTransaction,
  fetchMonthTransactions,
  transactionFiltersCleared,
  updateTransaction,
} from "../store/slices/transactionsSlice";
import { fulfilled, makeTransaction, respond } from "../test-utils/fixtures";

const october = { year: 2026, month: 10 };
const september = { year: 2026, month: 9 };

function storeAtOctober() {
  const store = createStore();
  store.dispatch(periodSelected(october));
  return store;
}

const recentIds = (store: ReturnType<typeof createStore>) =>
  selectRecentTransactionsForPeriod(store.getState()).map((t) => t.id);

const at = (id: string, transactionDate: string, createdAt: string, overrides = {}) =>
  makeTransaction({ id, transactionDate, createdAt, updatedAt: createdAt, ...overrides });

describe("transaction order", () => {
  it("sorts by date, then creation time, then id, all descending", () => {
    const sameInstant = "2026-10-10T09:00:00.000Z";
    const rows = [
      at("00000000-0000-4000-8000-00000000000a", "2026-10-10", sameInstant),
      at("00000000-0000-4000-8000-00000000000f", "2026-10-10", sameInstant),
      at("00000000-0000-4000-8000-000000000001", "2026-10-10", "2026-10-10T10:00:00.000Z"),
      at("00000000-0000-4000-8000-000000000002", "2026-10-11", "2026-10-01T00:00:00.000Z"),
    ];
    const expected = [
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-00000000000f",
      "00000000-0000-4000-8000-00000000000a",
    ];
    expect([...rows].sort(compareTransactions).map((t) => t.id)).toEqual(expected);
    // The store applies the same order whatever order the server's response came in.
    for (const input of [rows, [...rows].reverse()]) {
      const store = storeAtOctober();
      respond(store, fetchMonthTransactions, input, october);
      expect(selectTransactionsForPeriod(store.getState()).map((t) => t.id)).toEqual(expected);
    }
  });

  it("compares by code unit, matching PostgreSQL's uuid and timestamp order", () => {
    const lower = at("0aaaaaaa-0000-4000-8000-000000000000", "2026-10-10", "2026-10-10T09:00:00.000Z");
    const higher = at("a0000000-0000-4000-8000-000000000000", "2026-10-10", "2026-10-10T09:00:00.000Z");
    expect(compareTransactions(higher, lower)).toBeLessThan(0);
    expect(compareTransactions(lower, higher)).toBeGreaterThan(0);
    expect(compareTransactions(lower, lower)).toBe(0);
  });
});

describe("recent transactions selector", () => {
  it("returns the three newest of the month, income and expenses alike", () => {
    const store = storeAtOctober();
    respond(
      store,
      fetchMonthTransactions,
      [
        at("t1", "2026-10-01", "2026-10-01T09:00:00.000Z"),
        at("t2", "2026-10-02", "2026-10-02T09:00:00.000Z", { type: "INCOME", categoryId: null }),
        at("t3", "2026-10-03", "2026-10-03T09:00:00.000Z"),
        // Future-dated within the month: ordered by its date like any other.
        at("t4", "2026-10-28", "2026-10-02T09:00:00.000Z"),
      ],
      october,
    );
    expect(recentIds(store)).toEqual(["t4", "t3", "t2"]);
  });

  it("returns what there is when the month has fewer than three, and nothing when it has none", () => {
    const store = storeAtOctober();
    respond(store, fetchMonthTransactions, [], october);
    expect(recentIds(store)).toEqual([]);
    respond(store, fetchMonthTransactions, [at("t1", "2026-10-01", "2026-10-01T09:00:00.000Z"), at("t2", "2026-10-02", "2026-10-02T09:00:00.000Z")], october);
    expect(recentIds(store)).toEqual(["t2", "t1"]);
  });

  it("follows the selected month and ignores other months", () => {
    const store = storeAtOctober();
    respond(store, fetchMonthTransactions, [at("oct", "2026-10-05", "2026-10-05T09:00:00.000Z")], october);
    respond(store, fetchMonthTransactions, [at("sep", "2026-09-30", "2026-09-30T09:00:00.000Z")], september);
    expect(recentIds(store)).toEqual(["oct"]);
    store.dispatch(periodSelected(september));
    expect(recentIds(store)).toEqual(["sep"]);
  });

  it("reflects creates, edits (including a date change) and deletes without a refetch", () => {
    const store = storeAtOctober();
    const [a, b, c, d] = [
      at("a", "2026-10-01", "2026-10-01T09:00:00.000Z"),
      at("b", "2026-10-02", "2026-10-02T09:00:00.000Z"),
      at("c", "2026-10-03", "2026-10-03T09:00:00.000Z"),
      at("d", "2026-10-04", "2026-10-04T09:00:00.000Z"),
    ];
    respond(store, fetchMonthTransactions, [a, b, c], october);
    expect(recentIds(store)).toEqual(["c", "b", "a"]);

    store.dispatch(fulfilled(createTransaction, d, {}));
    expect(recentIds(store)).toEqual(["d", "c", "b"]);

    // Moving "a" to the latest date brings it to the top.
    store.dispatch(fulfilled(updateTransaction, { ...a, transactionDate: "2026-10-20" }, { id: "a", changes: {} }));
    expect(recentIds(store)).toEqual(["a", "d", "c"]);

    // Moving it to September drops it from October's list.
    store.dispatch(fulfilled(updateTransaction, { ...a, transactionDate: "2026-09-20" }, { id: "a", changes: {} }));
    expect(recentIds(store)).toEqual(["d", "c", "b"]);

    store.dispatch(fulfilled(deleteTransaction, undefined, "d"));
    expect(recentIds(store)).toEqual(["c", "b"]);
  });

  it("is memoized and leaves the store's arrays untouched", () => {
    const store = storeAtOctober();
    respond(
      store,
      fetchMonthTransactions,
      ["1", "2", "3", "4", "5"].map((n) => at(`t${n}`, `2026-10-0${n}`, `2026-10-0${n}T09:00:00.000Z`)),
      october,
    );
    const idsBefore = store.getState().transactions.ids;
    const idsCopy = [...idsBefore];
    const first = selectRecentTransactionsForPeriod(store.getState());

    expect(first).toHaveLength(3);
    expect(selectRecentTransactionsForPeriod(store.getState())).toBe(first);
    expect(store.getState().transactions.ids).toBe(idsBefore);
    expect(idsBefore).toEqual(idsCopy);
    expect(selectTransactionsForPeriod(store.getState())).toHaveLength(5);

    // An unrelated action (asking the list screen to clear its filters) recomputes nothing.
    store.dispatch(transactionFiltersCleared());
    expect(selectRecentTransactionsForPeriod(store.getState())).toBe(first);
  });
});
