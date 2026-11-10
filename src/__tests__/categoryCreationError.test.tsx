import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Router from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import type { CategoryDto } from "../../shared/api";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import { NewCategoryScreen } from "../screens/NewCategoryScreen/NewCategoryScreen";
import { createStore } from "../store";
import { loadMe } from "../store/slices/authSlice";
import { fetchCategories } from "../store/slices/catalogSlices";
import { strings } from "../strings/he";
import { fulfilled, makeCategory, meWithHousehold, respond } from "../test-utils/fixtures";

/**
 * Stands in for the navigator: the screen stays mounted (and keeps its state) while blurred,
 * and only its focus effects run. Mounting counts as gaining focus.
 */
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  type MockEntry = { run: () => void | (() => void); cleanup: void | (() => void) };
  const entries = new Set<MockEntry>();
  return {
    __tab: {
      blur: () => entries.forEach((entry) => void (entry.cleanup?.(), (entry.cleanup = undefined))),
      focus: () => entries.forEach((entry) => void (entry.cleanup = entry.run())),
    },
    useFocusEffect: (run: MockEntry["run"]) =>
      useEffect(() => {
        const entry: MockEntry = { run, cleanup: run() };
        entries.add(entry);
        return () => {
          entry.cleanup?.();
          entries.delete(entry);
        };
      }, [run]),
    useNavigation: () => ({ isFocused: () => true }),
    router: { back: jest.fn() },
    Stack: { Screen: () => null },
  };
});

jest.mock("../api/endpoints", () => ({
  api: { categories: { list: jest.fn(), create: jest.fn(), update: jest.fn() } },
}));

const createCategoryApi = api.categories.create as jest.Mock;

const DUPLICATE = strings.API_ERRORS.CATEGORY_NAME_TAKEN!;
const duplicateError = () => new ApiError(409, "CATEGORY_NAME_TAKEN", "taken");
const food = makeCategory({ id: "food", name: "Food" });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let appStateListeners: ((state: AppStateStatus) => void)[] = [];

beforeEach(() => {
  jest.resetAllMocks();
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListeners.push(listener);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) };
  });
});

afterEach(() => jest.restoreAllMocks());

function renderScreen(store: ReturnType<typeof createStore>) {
  store.dispatch(fulfilled(loadMe, meWithHousehold, undefined));
  respond(store, fetchCategories, [food], undefined);
  return render(
    <SafeAreaProvider initialMetrics={{ insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } }}>
      <Provider store={store}>
        <NewCategoryScreen />
      </Provider>
    </SafeAreaProvider>,
  );
}

async function renderNewCategoryScreen(store = createStore()) {
  await renderScreen(store);
  await screen.findByLabelText(strings.NEW_CATEGORY);
  return store;
}

const nameInput = () => screen.getByLabelText(strings.NEW_CATEGORY);
const typeName = (value: string) => fireEvent.changeText(nameInput(), value);
const pressAdd = () => fireEvent.press(screen.getByRole("button", { name: strings.ADD }));

async function failWithDuplicate(value = "Food") {
  createCategoryApi.mockRejectedValueOnce(duplicateError());
  await typeName(value);
  await pressAdd();
  await screen.findByText(DUPLICATE);
}

const tab = (Router as unknown as { __tab: { blur: () => void; focus: () => void } }).__tab;
const leaveScreen = () => act(async () => tab.blur());
const returnToScreen = () => act(async () => tab.focus());

describe("category creation error", () => {
  it("shows the duplicate-name error, keeping the entered name and the cached categories", async () => {
    const store = await renderNewCategoryScreen();
    await failWithDuplicate();

    expect(nameInput().props.value).toBe("Food");
    expect(createCategoryApi).toHaveBeenCalledWith({ name: "Food" });
    expect(Object.keys(store.getState().categories.entities)).toEqual(["food"]);
  });

  it("clears when the name is edited, including when it is emptied", async () => {
    await renderNewCategoryScreen();
    await failWithDuplicate();
    await typeName("Foo");
    expect(screen.queryByText(DUPLICATE)).toBeNull();

    await failWithDuplicate("Food");
    await typeName("");
    expect(screen.queryByText(DUPLICATE)).toBeNull();
  });

  it("clears the error and entered name when leaving the screen", async () => {
    await renderNewCategoryScreen();
    await failWithDuplicate();

    await leaveScreen();
    await returnToScreen();

    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(nameInput().props.value).toBe("");
  });

  it("clears when the app goes to the background, which is not a cold restart", async () => {
    await renderNewCategoryScreen();
    await failWithDuplicate();

    await act(async () => appStateListeners.forEach((listener) => listener("background")));

    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(nameInput().props.value).toBe("Food");
  });

  it("clears before a new submission", async () => {
    await renderNewCategoryScreen();
    await failWithDuplicate();

    const retry = deferred<CategoryDto>();
    createCategoryApi.mockReturnValueOnce(retry.promise);
    await pressAdd();
    expect(screen.queryByText(DUPLICATE)).toBeNull();

    await act(async () => retry.resolve(makeCategory({ id: "new", name: "Food" })));
  });

  it("returns to the list after a successful retry, without the error", async () => {
    const store = await renderNewCategoryScreen();
    await failWithDuplicate();

    createCategoryApi.mockResolvedValueOnce(makeCategory({ id: "new", name: "Toys" }));
    await typeName("Toys");
    await pressAdd();

    await waitFor(() => expect(Router.router.back).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(store.getState().categories.entities.new).toBeDefined();
  });

  it("sends one request when Add is pressed again while saving", async () => {
    await renderNewCategoryScreen();
    const response = deferred<CategoryDto>();
    createCategoryApi.mockReturnValueOnce(response.promise);
    await typeName("Toys");
    await pressAdd();
    // While saving, the button shows a spinner and is disabled.
    await fireEvent.press(screen.getByRole("button", { busy: true }));

    await act(async () => response.resolve(makeCategory({ id: "toys", name: "Toys" })));
    expect(createCategoryApi).toHaveBeenCalledTimes(1);
  });

  it("is not stored, so a real cold start (new store, new screen) begins without it", async () => {
    const store = await renderNewCategoryScreen();
    await failWithDuplicate();
    expect(JSON.stringify(store.getState())).not.toContain("CATEGORY_NAME_TAKEN");

    await screen.unmount();
    await renderNewCategoryScreen();
    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(nameInput().props.value).toBe("");
  });
});

describe("late responses from an abandoned attempt", () => {
  async function submitPending(value = "Food") {
    const response = deferred<CategoryDto>();
    createCategoryApi.mockReturnValueOnce(response.promise);
    await typeName(value);
    await pressAdd();
    return response;
  }

  it("does not restore the error after the name was edited", async () => {
    await renderNewCategoryScreen();
    const response = await submitPending();
    await typeName("Foo");

    await act(async () => response.reject(duplicateError()));

    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(nameInput().props.value).toBe("Foo");
  });

  it("does not restore the error after leaving the screen", async () => {
    await renderNewCategoryScreen();
    const response = await submitPending();
    await leaveScreen();

    await act(async () => response.reject(duplicateError()));
    await returnToScreen();

    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(nameInput().props.value).toBe("");
  });

  it("does not erase a name edited while the request was in flight, but still stores the category", async () => {
    const store = await renderNewCategoryScreen();
    const response = await submitPending("Toys");
    await typeName("Toys 2");

    await act(async () => response.resolve(makeCategory({ id: "toys", name: "Toys" })));

    expect(nameInput().props.value).toBe("Toys 2");
    expect(Router.router.back).not.toHaveBeenCalled();
    expect(store.getState().categories.entities.toys).toBeDefined();
  });

  it("empties the submitted name if the request succeeds after leaving the screen", async () => {
    await renderNewCategoryScreen();
    const response = await submitPending("Toys");
    await leaveScreen();

    await act(async () => response.resolve(makeCategory({ id: "toys", name: "Toys" })));
    await returnToScreen();

    expect(nameInput().props.value).toBe("");
    expect(Router.router.back).not.toHaveBeenCalled();
  });
});

describe("genuine failures", () => {
  it("shows a network failure of the current attempt, keeping the entered name", async () => {
    await renderNewCategoryScreen();
    createCategoryApi.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    await typeName("Toys");
    await pressAdd();

    await screen.findByText(strings.API_ERRORS.NETWORK_ERROR!);
    expect(nameInput().props.value).toBe("Toys");
  });
});
