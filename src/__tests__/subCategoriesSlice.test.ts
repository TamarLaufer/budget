import type { SubCategoryDto } from "../../shared/api";
import { createStore } from "../store";
import { selectSubCategoryLoad } from "../store/selectors";
import { householdChanged } from "../store/shared";
import { fetchSubCategories, updateSubCategory } from "../store/slices/catalogSlices";
import { fulfilled, pending } from "../test-utils/fixtures";

const bakery: SubCategoryDto = {
  id: "s1",
  categoryId: "food",
  name: "Bakery",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("subcategories slice", () => {
  it("does not let an older fetch overwrite a newer rename or (de)activation", () => {
    const store = createStore();
    store.dispatch(pending(fetchSubCategories, "food", "fetch-1"));

    const changes = { name: "Bread", isActive: false };
    store.dispatch(pending(updateSubCategory, { id: "s1", changes }, "update-1"));
    store.dispatch(fulfilled(updateSubCategory, { ...bakery, ...changes }, { id: "s1", changes }, "update-1"));

    // The fetch was answered before the update was saved, so it still has the old values.
    store.dispatch(fulfilled(fetchSubCategories, [bakery], "food", "fetch-1"));

    expect(store.getState().subCategories.entities.s1).toMatchObject({ name: "Bread", isActive: false });
    // Marked to be fetched again (the details screen does so as soon as it sees this).
    expect(selectSubCategoryLoad(store.getState(), "food")).toMatchObject({ status: "idle", stale: true });
  });

  it("stores a fetch that was sent after the last change", () => {
    const store = createStore();
    const changes = { name: "Bread" };
    store.dispatch(pending(updateSubCategory, { id: "s1", changes }, "update-1"));
    store.dispatch(fulfilled(updateSubCategory, { ...bakery, ...changes }, { id: "s1", changes }, "update-1"));

    store.dispatch(pending(fetchSubCategories, "food", "fetch-2"));
    store.dispatch(fulfilled(fetchSubCategories, [{ ...bakery, name: "Bread", isActive: false }], "food", "fetch-2"));

    expect(store.getState().subCategories.entities.s1).toMatchObject({ name: "Bread", isActive: false });
    expect(selectSubCategoryLoad(store.getState(), "food")).toMatchObject({ status: "succeeded", loaded: true });
  });

  it("ignores an update response that arrives after the household changed", () => {
    const store = createStore();
    const changes = { name: "Bread" };
    store.dispatch(pending(updateSubCategory, { id: "s1", changes }, "update-1"));
    store.dispatch(householdChanged());
    store.dispatch(fulfilled(updateSubCategory, { ...bakery, ...changes }, { id: "s1", changes }, "update-1"));

    expect(store.getState().subCategories.entities).toEqual({});
  });
});
