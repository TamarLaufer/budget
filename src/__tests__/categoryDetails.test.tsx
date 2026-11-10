import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as Router from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";

import type { MeDto, SubCategoryDto } from "../../shared/api";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import CategoriesScreen from "../screens/CategoriesScreen/CategoriesScreen";
import { CategoryDetailsScreen } from "../screens/CategoryDetailsScreen/CategoryDetailsScreen";
import { createStore } from "../store";
import { loadMe } from "../store/slices/authSlice";
import { strings } from "../strings/he";
import { fulfilled, makeCategory, meWithHousehold } from "../test-utils/fixtures";

/** Route params the details screen reads; each test sets them before rendering. */
let mockRouteParams: Record<string, string | string[] | undefined> = {};

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    // Mounting counts as gaining focus; unmounting as losing it.
    useFocusEffect: (run: () => void | (() => void)) => useEffect(run, [run]),
    useNavigation: () => ({ isFocused: () => true }),
    useLocalSearchParams: () => mockRouteParams,
    router: { push: jest.fn(), back: jest.fn() },
    Stack: { Screen: () => null },
  };
});

// Icon fonts are native assets that jest cannot load.
jest.mock("@expo/vector-icons/Ionicons", () => () => null);

jest.mock("../api/endpoints", () => ({
  api: {
    categories: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
    subCategories: { list: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const listCategories = api.categories.list as jest.Mock;
const updateCategoryApi = api.categories.update as jest.Mock;
const listSubCategories = api.subCategories.list as jest.Mock;
const createSubCategoryApi = api.subCategories.create as jest.Mock;
const updateSubCategoryApi = api.subCategories.update as jest.Mock;
const push = Router.router.push as jest.Mock;

const food = makeCategory({ id: "food", name: "Food" });
const fun = makeCategory({ id: "fun", name: "Fun" });
const old = makeCategory({ id: "old", name: "Old", isActive: false });
const groceries: SubCategoryDto = {
  id: "s1",
  categoryId: "food",
  name: "Groceries",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const snacks: SubCategoryDto = { ...groceries, id: "s3", name: "Snacks", isActive: false };

const member: MeDto = {
  ...meWithHousehold,
  membership: { ...meWithHousehold.membership!, role: "MEMBER" },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRouteParams = {};
  listCategories.mockResolvedValue([food, fun, old]);
  listSubCategories.mockResolvedValue([groceries]);
});

function signedInStore(me: MeDto = meWithHousehold) {
  const store = createStore();
  store.dispatch(fulfilled(loadMe, me, undefined));
  return store;
}

function renderWith(store: ReturnType<typeof createStore>, ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={{ insets: { top: 0, left: 0, right: 0, bottom: 0 }, frame: { x: 0, y: 0, width: 400, height: 800 } }}>
      <Provider store={store}>{ui}</Provider>
    </SafeAreaProvider>,
  );
}

async function openDetails(id: string | string[] | undefined, store = signedInStore()) {
  mockRouteParams = { id };
  await renderWith(store, <CategoryDetailsScreen />);
  return store;
}

describe("categories list", () => {
  it("shows compact rows grouped by status, and opens the tapped category by id", async () => {
    await renderWith(signedInStore(), <CategoriesScreen />);
    await screen.findByText("Food");
    expect(screen.getByText(strings.ACTIVE_CATEGORIES)).toBeTruthy();
    expect(screen.getByText(strings.INACTIVE_CATEGORIES)).toBeTruthy();
    // No management controls in the rows.
    expect(screen.queryByText(strings.RENAME)).toBeNull();
    expect(screen.queryByText(strings.DEACTIVATE)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Fun" }));
    expect(push).toHaveBeenCalledWith("/category/fun");
  });

  it("does not request subcategories for every category", async () => {
    await renderWith(signedInStore(), <CategoriesScreen />);
    await screen.findByText("Food");
    expect(listSubCategories).not.toHaveBeenCalled();
  });

  it("offers managers the Add action, which opens the new-category screen", async () => {
    await renderWith(signedInStore(), <CategoriesScreen />);
    await fireEvent.press(await screen.findByTestId("add-category"));
    expect(push).toHaveBeenCalledWith("/category/new");
  });

  it("hides the Add action from members", async () => {
    await renderWith(signedInStore(member), <CategoriesScreen />);
    await screen.findByText("Food");
    expect(screen.queryByTestId("add-category")).toBeNull();
    expect(screen.getByText(strings.MANAGERS_ONLY)).toBeTruthy();
  });

  it("keeps showing a failed first load until retry succeeds", async () => {
    listCategories.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    await renderWith(signedInStore(), <CategoriesScreen />);
    await screen.findByText(strings.API_ERRORS.NETWORK_ERROR!);

    listCategories.mockResolvedValue([food]);
    await fireEvent.press(screen.getByText(strings.RETRY));
    await screen.findByText("Food");
    expect(screen.queryByText(strings.API_ERRORS.NETWORK_ERROR!)).toBeNull();
  });
});

describe("category details: loading and route params", () => {
  it("shows the category from the route id and fetches only its subcategories", async () => {
    await openDetails("food");
    await screen.findByText("Groceries");
    expect(screen.getByText("Food")).toBeTruthy();
    expect(listSubCategories).toHaveBeenCalledTimes(1);
    expect(listSubCategories).toHaveBeenCalledWith("food");
  });

  it("shows loading, not 'not found', while the categories are still loading", async () => {
    const response = deferred<(typeof food)[]>();
    listCategories.mockReturnValueOnce(response.promise);
    await openDetails("food");

    await screen.findByText(strings.LOADING);
    expect(screen.queryByText(strings.CATEGORY_NOT_FOUND)).toBeNull();

    await act(async () => response.resolve([food]));
    await screen.findByText("Food");
  });

  it("shows 'not found' once the categories loaded without it", async () => {
    await openDetails("missing");
    await screen.findByText(strings.CATEGORY_NOT_FOUND);
    expect(listSubCategories).not.toHaveBeenCalled();
  });

  it.each([[undefined], [""], [["food", "fun"]]])("treats an invalid id (%p) as not found", async (id) => {
    await openDetails(id);
    await screen.findByText(strings.CATEGORY_NOT_FOUND);
  });

  it("offers a retry when loading the categories fails", async () => {
    listCategories.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    await openDetails("food");
    await screen.findByText(strings.API_ERRORS.NETWORK_ERROR!);

    await fireEvent.press(screen.getByText(strings.RETRY));
    await screen.findByText("Food");
  });
});

describe("category details: managing", () => {
  it("renames the category, and the list shows the new name", async () => {
    const store = await openDetails("food");
    updateCategoryApi.mockResolvedValueOnce({ ...food, name: "Meals" });

    await fireEvent.press(await screen.findByText(strings.RENAME));
    await fireEvent.changeText(screen.getByLabelText(strings.CATEGORY_NAME), "Meals");
    await fireEvent.press(screen.getByText(strings.SAVE));

    await screen.findByText(strings.RENAME);
    expect(updateCategoryApi).toHaveBeenCalledWith("food", { name: "Meals" });

    await screen.unmount();
    await renderWith(store, <CategoriesScreen />);
    expect(await screen.findByText("Meals")).toBeTruthy();
  });

  it("deactivates the category in the store the list reads from", async () => {
    const store = await openDetails("fun");
    updateCategoryApi.mockResolvedValueOnce({ ...fun, isActive: false });

    await fireEvent.press(await screen.findByText(strings.DEACTIVATE));
    await screen.findByText(strings.ACTIVATE);
    expect(store.getState().categories.entities.fun?.isActive).toBe(false);
  });

  it("adds a subcategory as a chip and clears the input", async () => {
    await openDetails("food");
    await screen.findByText("Groceries");
    createSubCategoryApi.mockResolvedValueOnce({ ...groceries, id: "s2", name: "Bakery" });

    await fireEvent.changeText(screen.getByLabelText(strings.SUBCATEGORY_NAME), "Bakery");
    await fireEvent.press(screen.getByRole("button", { name: strings.ADD }));

    await screen.findByText("Bakery");
    expect(createSubCategoryApi).toHaveBeenCalledWith({ categoryId: "food", name: "Bakery" });
    expect(screen.getByLabelText(strings.SUBCATEGORY_NAME).props.value).toBe("");
  });

  it("sends one request when Add is pressed again while saving", async () => {
    await openDetails("food");
    await screen.findByText("Groceries");
    const response = deferred<SubCategoryDto>();
    createSubCategoryApi.mockReturnValueOnce(response.promise);

    await fireEvent.changeText(screen.getByLabelText(strings.SUBCATEGORY_NAME), "Bakery");
    await fireEvent.press(screen.getByRole("button", { name: strings.ADD }));
    // While saving, the button shows a spinner and is disabled.
    await fireEvent.press(screen.getByRole("button", { busy: true }));

    await act(async () => response.resolve({ ...groceries, id: "s2", name: "Bakery" }));
    expect(createSubCategoryApi).toHaveBeenCalledTimes(1);
  });

  it("keeps the entered name after a failed request", async () => {
    await openDetails("food");
    await screen.findByText("Groceries");
    createSubCategoryApi.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));

    await fireEvent.changeText(screen.getByLabelText(strings.SUBCATEGORY_NAME), "Bakery");
    await fireEvent.press(screen.getByRole("button", { name: strings.ADD }));

    await screen.findByText(strings.API_ERRORS.NETWORK_ERROR!);
    expect(screen.getByLabelText(strings.SUBCATEGORY_NAME).props.value).toBe("Bakery");
  });

  it("offers a retry when loading the subcategories fails", async () => {
    listSubCategories.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    await openDetails("food");
    await screen.findByText(strings.SUBCATEGORIES_LOAD_FAILED);

    await fireEvent.press(screen.getByText(strings.RETRY));
    await waitFor(() => expect(screen.getByText("Groceries")).toBeTruthy());
  });
});

describe("category details: read-only members", () => {
  it("shows the category and its subcategories without modification controls", async () => {
    await openDetails("food", signedInStore(member));
    await screen.findByText("Groceries");

    expect(screen.getByText(strings.MANAGERS_ONLY)).toBeTruthy();
    expect(screen.queryByText(strings.RENAME)).toBeNull();
    expect(screen.queryByText(strings.DEACTIVATE)).toBeNull();
    expect(screen.queryByLabelText(strings.SUBCATEGORY_NAME)).toBeNull();
    expect(screen.queryByRole("button", { name: strings.ADD })).toBeNull();
  });

  it("cannot open the subcategory editor", async () => {
    listSubCategories.mockResolvedValue([groceries, snacks]);
    await openDetails("food", signedInStore(member));
    await screen.findByText("Groceries");

    expect(screen.queryByRole("button", { name: "Groceries" })).toBeNull();
    await fireEvent.press(screen.getByText("Groceries"));
    expect(screen.queryByLabelText(strings.EDIT_SUBCATEGORY)).toBeNull();
    // Inactive ones are still shown, in their own group.
    expect(screen.getByText(strings.INACTIVE_SUBCATEGORIES)).toBeTruthy();
  });
});

describe("category details: editing subcategories", () => {
  // The editor's own controls (the category card has Save/Deactivate buttons too).
  const editor = () => within(screen.getByLabelText(strings.EDIT_SUBCATEGORY));
  const editorInput = () => editor().getByLabelText(strings.SUBCATEGORY_NAME);

  async function openEditor(chipName = "Groceries") {
    await openDetails("food");
    await fireEvent.press(await screen.findByRole("button", { name: chipName }));
    await screen.findByLabelText(strings.EDIT_SUBCATEGORY);
  }

  it("opens an inline editor with the current name when a manager taps a chip", async () => {
    await openEditor();
    expect(editorInput().props.value).toBe("Groceries");
    expect(editor().getByText(strings.DEACTIVATE)).toBeTruthy();
  });

  it("shows inactive subcategories in a labelled group", async () => {
    listSubCategories.mockResolvedValue([groceries, snacks]);
    await openDetails("food");
    await screen.findByText(strings.INACTIVE_SUBCATEGORIES);
    expect(screen.getByRole("button", { name: `Snacks, ${strings.CATEGORY_IS_INACTIVE}` })).toBeTruthy();
  });

  it("renames: the chip updates and the editor closes", async () => {
    await openEditor();
    updateSubCategoryApi.mockResolvedValueOnce({ ...groceries, name: "Market" });

    await fireEvent.changeText(editorInput(), "  Market ");
    await fireEvent.press(editor().getByText(strings.SAVE));

    await screen.findByText("Market");
    expect(updateSubCategoryApi).toHaveBeenCalledWith("s1", { name: "Market" });
    expect(screen.queryByText("Groceries")).toBeNull();
    expect(screen.queryByLabelText(strings.EDIT_SUBCATEGORY)).toBeNull();
  });

  it("keeps the draft and shows the error when the name is taken", async () => {
    await openEditor();
    updateSubCategoryApi.mockRejectedValueOnce(new ApiError(409, "SUBCATEGORY_NAME_TAKEN", "taken"));

    await fireEvent.changeText(editorInput(), "Snacks");
    await fireEvent.press(editor().getByText(strings.SAVE));

    await screen.findByText(strings.API_ERRORS.SUBCATEGORY_NAME_TAKEN!);
    expect(editorInput().props.value).toBe("Snacks");
    expect(screen.getByLabelText(strings.EDIT_SUBCATEGORY)).toBeTruthy();
  });

  it("deactivates into the inactive group and reactivates back", async () => {
    await openEditor();
    updateSubCategoryApi.mockResolvedValueOnce({ ...groceries, isActive: false });
    await fireEvent.press(editor().getByText(strings.DEACTIVATE));

    const inactiveChip = await screen.findByRole("button", { name: `Groceries, ${strings.CATEGORY_IS_INACTIVE}` });
    expect(screen.getByText(strings.INACTIVE_SUBCATEGORIES)).toBeTruthy();
    expect(updateSubCategoryApi).toHaveBeenCalledWith("s1", { isActive: false });

    await fireEvent.press(inactiveChip);
    updateSubCategoryApi.mockResolvedValueOnce({ ...groceries, isActive: true });
    await fireEvent.press(await editor().findByText(strings.ACTIVATE));

    await screen.findByRole("button", { name: "Groceries" });
    expect(screen.queryByText(strings.INACTIVE_SUBCATEGORIES)).toBeNull();
  });

  it("sends one request at a time: Save and Deactivate are blocked while saving", async () => {
    await openEditor();
    const response = deferred<SubCategoryDto>();
    updateSubCategoryApi.mockReturnValueOnce(response.promise);

    await fireEvent.changeText(editorInput(), "Market");
    await fireEvent.press(editor().getByText(strings.SAVE));
    await fireEvent.press(editor().getByRole("button", { busy: true }));
    await fireEvent.press(editor().getByText(strings.DEACTIVATE));

    await act(async () => response.resolve({ ...groceries, name: "Market" }));
    expect(updateSubCategoryApi).toHaveBeenCalledTimes(1);
  });

  it("after Cancel, a late failure neither reopens the editor nor shows an error", async () => {
    await openEditor();
    const response = deferred<SubCategoryDto>();
    updateSubCategoryApi.mockReturnValueOnce(response.promise);

    await fireEvent.changeText(editorInput(), "Market");
    await fireEvent.press(editor().getByText(strings.SAVE));
    await fireEvent.press(editor().getByText(strings.CANCEL));

    await act(async () => response.reject(new ApiError(409, "SUBCATEGORY_NAME_TAKEN", "taken")));
    expect(screen.queryByLabelText(strings.EDIT_SUBCATEGORY)).toBeNull();
    expect(screen.queryByText(strings.API_ERRORS.SUBCATEGORY_NAME_TAKEN!)).toBeNull();
  });

  it("after leaving the screen, a late success still updates Redux", async () => {
    const store = signedInStore();
    await openDetails("food", store);
    await fireEvent.press(await screen.findByRole("button", { name: "Groceries" }));
    const response = deferred<SubCategoryDto>();
    updateSubCategoryApi.mockReturnValueOnce(response.promise);
    await fireEvent.changeText(editorInput(), "Market");
    await fireEvent.press(editor().getByText(strings.SAVE));

    await screen.unmount();
    await act(async () => response.resolve({ ...groceries, name: "Market" }));
    expect(store.getState().subCategories.entities.s1?.name).toBe("Market");
  });
});
