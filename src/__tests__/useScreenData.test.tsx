import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";

import { api } from "../api/endpoints";
import { useScreenData } from "../hooks/useScreenData";
import { createStore } from "../store";
import type { Dataset } from "../store/selectors";
import { dataInvalidated } from "../store/shared";

// Mounting the hook counts as the screen gaining focus.
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ isFocused: () => true }),
  };
});

jest.mock("../api/endpoints", () => ({
  api: {
    transactions: { list: jest.fn() },
    budgets: { list: jest.fn() },
    categories: { list: jest.fn() },
    paymentMethods: { list: jest.fn() },
  },
}));

const listCategories = api.categories.list as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const CATEGORIES: readonly Dataset[] = ["categories"];

async function renderScreenData(store = createStore()) {
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  const hook = await renderHook(() => useScreenData(CATEGORIES), { wrapper });
  return { store, ...hook };
}

beforeEach(() => {
  jest.resetAllMocks();
  listCategories.mockResolvedValue([]);
});

describe("useScreenData", () => {
  it("loads missing data on focus without the pull-to-refresh spinner", async () => {
    const response = deferred<never[]>();
    listCategories.mockReturnValueOnce(response.promise);
    const { result } = await renderScreenData();

    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({ refreshing: false, load: { loaded: false } });

    await act(async () => response.resolve([]));
    expect(result.current).toMatchObject({ refreshing: false, load: { loaded: true, status: "succeeded" } });
  });

  it("reuses fresh data when the screen gains focus again", async () => {
    const first = await renderScreenData();
    await waitFor(() => expect(first.result.current.load.loaded).toBe(true));
    await first.unmount();

    const second = await renderScreenData(first.store);
    await act(async () => {});

    expect(second.result.current.load.loaded).toBe(true);
    expect(listCategories).toHaveBeenCalledTimes(1);
  });

  it("shows the spinner for a manual refresh until its request finishes", async () => {
    const { result } = await renderScreenData();
    await waitFor(() => expect(result.current.load.loaded).toBe(true));

    const response = deferred<never[]>();
    listCategories.mockReturnValueOnce(response.promise);
    await act(async () => result.current.refresh());
    expect(result.current.refreshing).toBe(true);
    expect(listCategories).toHaveBeenCalledTimes(2);

    await act(async () => response.resolve([]));
    expect(result.current.refreshing).toBe(false);
  });

  it("a pull during a background fetch waits for it instead of sending another request", async () => {
    const response = deferred<never[]>();
    listCategories.mockReturnValueOnce(response.promise);
    const { result } = await renderScreenData();
    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(1));

    await act(async () => result.current.refresh());
    expect(result.current.refreshing).toBe(true);
    expect(listCategories).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve([]));
    expect(result.current.refreshing).toBe(false);
  });

  it("refetches in the background when the app returns to the foreground", async () => {
    const { result, store } = await renderScreenData();
    await waitFor(() => expect(result.current.load.loaded).toBe(true));

    const response = deferred<never[]>();
    listCategories.mockReturnValueOnce(response.promise);
    await act(async () => store.dispatch(dataInvalidated()));

    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(2));
    expect(result.current).toMatchObject({ refreshing: false, load: { loaded: true } });
    await act(async () => response.resolve([]));
    expect(store.getState().categories.load.stale).toBe(false);
  });

  it("does not retry a failing request in a loop", async () => {
    listCategories.mockRejectedValue(new Error("offline"));
    const { result } = await renderScreenData();

    await waitFor(() => expect(result.current.load.status).toBe("failed"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(listCategories).toHaveBeenCalledTimes(1);
  });
});
