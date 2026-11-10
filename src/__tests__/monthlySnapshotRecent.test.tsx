import { act, fireEvent, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import * as Router from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import type { MemberDto, SubCategoryDto, TransactionDto, TransactionListQuery } from "../../shared/api";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import MonthlySnapshotScreen from "../screens/MonthlySnapshotScreen/MonthlySnapshotScreen";
import TransactionsScreen from "../screens/TransactionsScreen/TransactionsScreen";
import { createStore } from "../store";
import { loadMe } from "../store/slices/authSlice";
import { fetchSubCategories } from "../store/slices/catalogSlices";
import { fetchMembers } from "../store/slices/householdSlice";
import { periodSelected } from "../store/slices/periodSlice";
import { createTransaction, deleteTransaction, updateTransaction } from "../store/slices/transactionsSlice";
import { strings } from "../strings/he";
import { fulfilled, makeCategory, makeTransaction, meWithHousehold, respond } from "../test-utils/fixtures";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    // Mounting counts as gaining focus; unmounting as losing it.
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useNavigation: () => ({ isFocused: () => true }),
    useLocalSearchParams: () => ({}),
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  };
});

// Icon fonts are native assets that jest cannot load.
jest.mock("@expo/vector-icons", () => ({ Feather: () => null, MaterialCommunityIcons: () => null }));
jest.mock("../budget/exportTransactions", () => ({ shareTransactionsExcel: jest.fn() }));
// The native worklets runtime behind Reanimated is unavailable in jest; use the libraries' mocks.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("../api/endpoints", () => ({
  api: {
    transactions: { list: jest.fn() },
    budgets: { list: jest.fn() },
    categories: { list: jest.fn() },
    subCategories: { list: jest.fn() },
  },
}));

const listTransactions = api.transactions.list as jest.Mock;
const listBudgets = api.budgets.list as jest.Mock;
const listCategories = api.categories.list as jest.Mock;
const listSubCategories = api.subCategories.list as jest.Mock;
const push = Router.router.push as jest.Mock;
const navigate = Router.router.navigate as jest.Mock;

const october = { year: 2026, month: 10 };
const september = { year: 2026, month: 9 };

const food = makeCategory({ id: "food", name: "Food" });
const fun = makeCategory({ id: "fun", name: "Fun" });
const old = makeCategory({ id: "old", name: "Old", isActive: false });
const pasta: SubCategoryDto = { id: "pasta", categoryId: "food", name: "Pasta", isActive: false, createdAt: "2026-01-01T00:00:00.000Z" };
const movies: SubCategoryDto = { id: "movies", categoryId: "fun", name: "Movies", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" };
const subCategoriesByCategory: Record<string, SubCategoryDto[]> = { food: [pasta], fun: [movies], old: [] };

const tx = (id: string, day: number, overrides: Partial<TransactionDto> = {}) => {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  return makeTransaction({ id, description: id, transactionDate: date, createdAt: `${date}T09:00:00.000Z`, ...overrides });
};

const member = (id: string, name: string): MemberDto => ({
  id: `m-${id}`,
  role: "MEMBER",
  joinedAt: "2026-01-01T00:00:00.000Z",
  user: { id, email: `${id}@example.com`, displayName: name },
});

let monthData: Record<string, TransactionDto[]>;

beforeEach(() => {
  jest.resetAllMocks();
  monthData = { "2026-10": [], "2026-9": [] };
  listTransactions.mockImplementation(({ year, month }: TransactionListQuery) =>
    Promise.resolve(monthData[`${year}-${month}`] ?? []),
  );
  listBudgets.mockResolvedValue([]);
  listCategories.mockResolvedValue([food, fun, old]);
  listSubCategories.mockImplementation((categoryId: string) => Promise.resolve(subCategoriesByCategory[categoryId] ?? []));
});

function signedInStore() {
  const store = createStore();
  store.dispatch(fulfilled(loadMe, meWithHousehold, undefined));
  store.dispatch(periodSelected(october));
  return store;
}

async function renderScreen(ui: React.ReactElement = <MonthlySnapshotScreen />, store = signedInStore()) {
  await render(
    <SafeAreaProvider initialMetrics={{ insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } }}>
      <Provider store={store}>{ui}</Provider>
    </SafeAreaProvider>,
  );
  return store;
}

/** Descriptions of the rows in the Recent Transactions section, top to bottom. */
const recentRows = () =>
  within(screen.getByTestId("recent-transactions"))
    .getAllByRole("button")
    .map((row) => within(row).getAllByText(/./)[0]?.props.children as string);

describe("recent transactions on the dashboard", () => {
  it("shows the month's three newest transactions, income included, in a stable order", async () => {
    monthData["2026-10"] = [
      tx("oldest", 1),
      tx("salary", 2, { type: "INCOME", categoryId: null, incomeSource: "Work" }),
      // Same date and creation time: the higher id comes first.
      tx("tie-a", 3),
      tx("tie-b", 3),
    ];
    await renderScreen();

    await waitFor(() => expect(recentRows()).toEqual(["tie-b", "tie-a", "salary"]));
    expect(screen.queryByText("oldest")).toBeNull();
    expect(screen.getByRole("header", { name: strings.RECENT_TRANSACTIONS })).toBeTruthy();
  });

  it("is placed after Add Transaction and before Categories", async () => {
    monthData["2026-10"] = [tx("one", 1)];
    await renderScreen();
    await screen.findByTestId("recent-transactions");

    // Text elements come back in screen order.
    const texts = screen.getAllByText(/./).map((t) => t.props.children);
    const position = (text: string) => texts.indexOf(text);
    expect(position(strings.ADD_TRANSACTION)).toBeGreaterThan(-1);
    expect(position(strings.ADD_TRANSACTION)).toBeLessThan(position(strings.RECENT_TRANSACTIONS));
    expect(position(strings.RECENT_TRANSACTIONS)).toBeLessThan(position("one"));
    expect(position("one")).toBeLessThan(position(strings.CATEGORIES));
  });

  it("shows fewer rows when the month has fewer, and an empty state without the link when it has none", async () => {
    monthData["2026-10"] = [tx("only", 5)];
    const store = await renderScreen();
    await waitFor(() => expect(recentRows()).toEqual(["only"]));
    expect(screen.getByTestId("view-all-transactions")).toBeTruthy();

    await act(async () => {
      store.dispatch(periodSelected(september));
    });
    expect(await screen.findByText(strings.NO_TRANSACTIONS)).toBeTruthy();
    expect(screen.queryByTestId("recent-transactions")).toBeNull();
    expect(screen.queryByTestId("view-all-transactions")).toBeNull();
  });

  it("follows month changes", async () => {
    monthData["2026-10"] = [tx("october", 5)];
    monthData["2026-9"] = [makeTransaction({ id: "september", description: "september", transactionDate: "2026-09-10" })];
    const store = await renderScreen();
    await waitFor(() => expect(recentRows()).toEqual(["october"]));

    await act(async () => {
      store.dispatch(periodSelected(september));
    });
    await waitFor(() => expect(recentRows()).toEqual(["september"]));
    expect(listTransactions).toHaveBeenCalledWith({ year: 2026, month: 9 });
  });

  it("reflects creates, edits and deletes immediately, without refetching", async () => {
    monthData["2026-10"] = [tx("a", 1), tx("b", 2), tx("c", 3)];
    const store = await renderScreen();
    await waitFor(() => expect(recentRows()).toEqual(["c", "b", "a"]));
    const requests = listTransactions.mock.calls.length;

    await act(async () => {
      store.dispatch(fulfilled(createTransaction, tx("new", 4), {}));
    });
    expect(recentRows()).toEqual(["new", "c", "b"]);

    await act(async () => {
      store.dispatch(fulfilled(updateTransaction, tx("a", 20, { description: "a-moved" }), { id: "a", changes: {} }));
    });
    expect(recentRows()).toEqual(["a-moved", "new", "c"]);

    await act(async () => {
      store.dispatch(fulfilled(deleteTransaction, undefined, "new"));
    });
    expect(recentRows()).toEqual(["a-moved", "c", "b"]);
    expect(listTransactions).toHaveBeenCalledTimes(requests);
  });

  it("opens a tapped transaction's edit screen", async () => {
    monthData["2026-10"] = [tx("abc", 1)];
    await renderScreen();
    await fireEvent.press(await screen.findByText("abc"));
    expect(push).toHaveBeenCalledWith("/transaction/abc");
  });

  it("shows category names, including inactive ones, and the creator only in shared households", async () => {
    monthData["2026-10"] = [tx("archived", 1, { categoryId: "old" })];
    const store = await renderScreen();
    const section = await screen.findByTestId("recent-transactions");
    expect(within(section).getByText("01/10 · Old")).toBeTruthy();
    expect(screen.queryByText(/נוסף על ידי/)).toBeNull();

    await act(async () => {
      store.dispatch(fulfilled(fetchMembers, [member("user-a", "A"), member("user-b", "B")], undefined));
    });
    expect(within(section).getByText("01/10 · Old · נוסף על ידי A")).toBeTruthy();
  });
});

describe("View all transactions", () => {
  it("opens the list for the same month with its search and filters cleared", async () => {
    monthData["2026-9"] = [
      makeTransaction({ id: "s1", description: "Groceries", transactionDate: "2026-09-10", categoryId: "food" }),
      makeTransaction({ id: "s2", description: "Cinema", transactionDate: "2026-09-12", categoryId: "fun" }),
    ];
    const store = signedInStore();
    store.dispatch(periodSelected(september));
    await renderScreen(
      <>
        <MonthlySnapshotScreen />
        <TransactionsScreen />
      </>,
      store,
    );
    await screen.findByTestId("recent-transactions");

    // Leave the list filtered, as a user might have.
    await fireEvent.changeText(screen.getByLabelText(strings.SEARCH), "Cinema");
    await fireEvent.press(screen.getByRole("radio", { name: strings.TYPE_EXPENSE }));
    await waitFor(() => expect(screen.getAllByText("Groceries")).toHaveLength(1)); // dashboard only

    await fireEvent.press(screen.getByTestId("view-all-transactions"));

    expect(navigate).toHaveBeenCalledWith("/transactions");
    expect(store.getState().period).toEqual(september);
    expect(screen.getByLabelText(strings.SEARCH).props.value).toBe("");
    // Both rows show in the list again (plus the dashboard's copies), with no debounce delay.
    expect(screen.getAllByText("Groceries")).toHaveLength(2);
    expect(screen.getAllByText("Cinema")).toHaveLength(2);
  });
});

describe("subcategory names", () => {
  it("loads names only for the visible rows' categories, once each", async () => {
    monthData["2026-10"] = [
      tx("hidden", 1, { categoryId: "old", subCategoryId: "unused" }),
      tx("p", 2, { description: null, categoryId: "food", subCategoryId: "pasta" }),
      tx("m1", 3, { description: null, categoryId: "fun", subCategoryId: "movies" }),
      tx("m2", 4, { description: null, categoryId: "fun", subCategoryId: "movies" }),
    ];
    const store = await renderScreen();

    // Rows without a description are titled by their subcategory, inactive ones included.
    await waitFor(() => expect(recentRows()).toEqual(["Movies", "Movies", "Pasta"]));
    expect(listSubCategories.mock.calls.map(([id]) => id).sort()).toEqual(["food", "fun"]);

    // Later updates to the month do not send them again.
    await act(async () => {
      store.dispatch(fulfilled(createTransaction, tx("x", 5), {}));
    });
    expect(listSubCategories).toHaveBeenCalledTimes(2);
  });

  it("does not request names that are already cached", async () => {
    monthData["2026-10"] = [tx("p", 2, { description: null, categoryId: "food", subCategoryId: "pasta" })];
    const store = signedInStore();
    respond(store, fetchSubCategories, [pasta], "food");
    await renderScreen(<MonthlySnapshotScreen />, store);

    await waitFor(() => expect(recentRows()).toEqual(["Pasta"]));
    expect(listSubCategories).not.toHaveBeenCalled();
  });

  it("does not retry a failed load by itself, but retries it on pull-to-refresh", async () => {
    monthData["2026-10"] = [tx("p", 2, { description: null, categoryId: "food", subCategoryId: "pasta" })];
    listSubCategories.mockRejectedValue(new ApiError(500, "INTERNAL", "boom"));
    const store = await renderScreen();

    // Falls back to the category name, and the failure is not retried in a loop.
    await waitFor(() => expect(store.getState().subCategories.loadByCategory.food?.status).toBe("failed"));
    expect(recentRows()).toEqual(["Food"]);
    await act(async () => {
      store.dispatch(fulfilled(createTransaction, tx("unrelated", 1), {}));
    });
    expect(listSubCategories).toHaveBeenCalledTimes(1);

    listSubCategories.mockResolvedValue([pasta]);
    await userEvent.setup().pullToRefresh(screen.getByTestId("monthly-snapshot"));

    await waitFor(() => expect(recentRows()).toEqual(["Pasta"]));
    expect(listSubCategories).toHaveBeenCalledTimes(2);
  });
});
