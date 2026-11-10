/** Categories and payment methods: small household-wide lists, loaded once and kept in sync. */
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CategoryDto, PaymentMethodDto, UpdateCategoryRequest, UpdatePaymentMethodRequest, CreateSubCategoryRequest,
SubCategoryDto, UpdateSubCategoryRequest, } from "../../../shared/api";
import { api } from "../../api/endpoints";
import {
  acceptResponse,
  apiThunk,
  dataInvalidated,
  householdChanged,
  idleLoad,
  isCurrentRequest,
  loadFailed,
  loadPending,
  loadSucceeded,
  markStale,
  replaceRecords,
  setIdOrder,
  shouldFetch,
  type FetchOptions,
  type LoadState,
} from "../shared";

export const categoriesAdapter = createEntityAdapter<CategoryDto>({
  sortComparer: (a, b) => a.createdAt.localeCompare(b.createdAt),
});
export const paymentMethodsAdapter = createEntityAdapter<PaymentMethodDto>();

export const fetchCategories = apiThunk(
  "categories/fetch",
  (_options: FetchOptions | undefined) => api.categories.list(),
  (options, state) => shouldFetch(state.categories.load, options?.force),
);
export const createCategory = apiThunk("categories/create", (name: string) => api.categories.create({ name }));

export const updateCategory = apiThunk(
  "categories/update",
  ({ id, changes }: { id: string; changes: UpdateCategoryRequest }) => api.categories.update(id, changes),
);

export const fetchPaymentMethods = apiThunk(
  "paymentMethods/fetch",
  (_options: FetchOptions | undefined) => api.paymentMethods.list(),
  (options, state) => shouldFetch(state.paymentMethods.load, options?.force),
);
export const createPaymentMethod = apiThunk("paymentMethods/create", (name: string) =>
  api.paymentMethods.create({ name }),
);
export const updatePaymentMethod = apiThunk(
  "paymentMethods/update",
  ({ id, changes }: { id: string; changes: UpdatePaymentMethodRequest }) => api.paymentMethods.update(id, changes),
);

interface CatalogExtra {
  load: LoadState;
  /** Counts successful creates and updates, to spot fetches that raced with one. */
  revision: number;
}

const categoriesInitial = categoriesAdapter.getInitialState<CatalogExtra>({ load: idleLoad, revision: 0 });

const categoriesSlice = createSlice({
  name: "categories",
  initialState: categoriesInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => categoriesInitial)
      .addCase(dataInvalidated, (state) => {
        markStale(state.load);
      })
      .addCase(fetchCategories.pending, (state, action) => {
        const { requestId: id, startedAt } = action.meta;
        state.load = loadPending(state.load, { id, startedAt, revision: state.revision });
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        const fetchedAt = acceptResponse(state, "load", action.meta.requestId, state.revision);
        if (fetchedAt === null) return;
        replaceRecords(categoriesAdapter, state, action.payload);
        state.load = loadSucceeded(fetchedAt);
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        if (isCurrentRequest(state.load, action.meta.requestId)) state.load = loadFailed(state.load, action.payload);
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        categoriesAdapter.addOne(state, action.payload);
        state.revision += 1;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        categoriesAdapter.setOne(state, action.payload);
        state.revision += 1;
      });
  },
});

const paymentMethodsInitial = paymentMethodsAdapter.getInitialState<CatalogExtra>({ load: idleLoad, revision: 0 });

const paymentMethodsSlice = createSlice({
  name: "paymentMethods",
  initialState: paymentMethodsInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => paymentMethodsInitial)
      .addCase(dataInvalidated, (state) => {
        markStale(state.load);
      })
      .addCase(fetchPaymentMethods.pending, (state, action) => {
        const { requestId: id, startedAt } = action.meta;
        state.load = loadPending(state.load, { id, startedAt, revision: state.revision });
      })
      .addCase(fetchPaymentMethods.fulfilled, (state, action) => {
        const fetchedAt = acceptResponse(state, "load", action.meta.requestId, state.revision);
        if (fetchedAt === null) return;
        replaceRecords(paymentMethodsAdapter, state, action.payload);
        // Unsorted adapter: keep the order the server returned, as setAll did.
        setIdOrder(state, action.payload.map((m) => m.id));
        state.load = loadSucceeded(fetchedAt);
      })
      .addCase(fetchPaymentMethods.rejected, (state, action) => {
        if (isCurrentRequest(state.load, action.meta.requestId)) state.load = loadFailed(state.load, action.payload);
      })
      .addCase(createPaymentMethod.fulfilled, (state, action) => {
        paymentMethodsAdapter.addOne(state, action.payload);
        state.revision += 1;
      })
      .addCase(updatePaymentMethod.fulfilled, (state, action) => {
        paymentMethodsAdapter.setOne(state, action.payload);
        state.revision += 1;
      });
  },
});

export const subCategoriesAdapter = createEntityAdapter<SubCategoryDto>({
  sortComparer: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
});

export const fetchSubCategories = apiThunk(
  "subCategories/fetch",
  (categoryId: string) => api.subCategories.list(categoryId),
);

export const createSubCategory = apiThunk(
  "subCategories/create",
  (body: CreateSubCategoryRequest) => api.subCategories.create(body),
);

export const updateSubCategory = apiThunk(
  "subCategories/update",
  ({ id, changes }: { id: string; changes: UpdateSubCategoryRequest }) => api.subCategories.update(id, changes),
);

const subCategoriesInitial = subCategoriesAdapter.getInitialState<{
  loadByCategory: Record<string, LoadState | undefined>;
  /** Per category: counts successful creates and updates, to spot fetches that raced with one. */
  revisionByCategory: Record<string, number | undefined>;
  /** Creates and updates sent since the household last changed; responses to others are ignored. */
  mutationRequests: Record<string, boolean | undefined>;
}>({
  loadByCategory: {},
  revisionByCategory: {},
  mutationRequests: {},
});

type SubCategoriesState = typeof subCategoriesInitial;

/** Stores a created or updated subcategory, unless it was sent before the household changed. */
function storeMutation(state: SubCategoriesState, requestId: string, subCategory: SubCategoryDto) {
  if (!state.mutationRequests[requestId]) return;
  delete state.mutationRequests[requestId];
  subCategoriesAdapter.upsertOne(state, subCategory);
  const { categoryId } = subCategory;
  state.revisionByCategory[categoryId] = (state.revisionByCategory[categoryId] ?? 0) + 1;
}

const subCategoriesSlice = createSlice({
  name: "subCategories",
  initialState: subCategoriesInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => subCategoriesInitial)
      .addCase(fetchSubCategories.pending, (state, action) => {
        const { arg: categoryId, requestId: id, startedAt } = action.meta;
        const revision = state.revisionByCategory[categoryId] ?? 0;
        state.loadByCategory[categoryId] = loadPending(state.loadByCategory[categoryId], { id, startedAt, revision });
      })
      .addCase(fetchSubCategories.fulfilled, (state, action) => {
        const categoryId = action.meta.arg;
        // Dropped (and marked stale) if a rename or (de)activation succeeded while it was in flight.
        const fetchedAt = acceptResponse(
          state.loadByCategory,
          categoryId,
          action.meta.requestId,
          state.revisionByCategory[categoryId] ?? 0,
        );
        if (fetchedAt === null) return;

        subCategoriesAdapter.upsertMany(state, action.payload);
        state.loadByCategory[categoryId] = loadSucceeded(fetchedAt);
      })
      .addCase(fetchSubCategories.rejected, (state, action) => {
        const categoryId = action.meta.arg;
        const load = state.loadByCategory[categoryId];
        if (isCurrentRequest(load, action.meta.requestId)) {
          state.loadByCategory[categoryId] = loadFailed(load, action.payload);
        }
      })
      .addCase(createSubCategory.pending, (state, action) => {
        state.mutationRequests[action.meta.requestId] = true;
      })
      .addCase(createSubCategory.fulfilled, (state, action) => {
        storeMutation(state, action.meta.requestId, action.payload);
      })
      .addCase(createSubCategory.rejected, (state, action) => {
        delete state.mutationRequests[action.meta.requestId];
      })
      .addCase(updateSubCategory.pending, (state, action) => {
        state.mutationRequests[action.meta.requestId] = true;
      })
      .addCase(updateSubCategory.fulfilled, (state, action) => {
        storeMutation(state, action.meta.requestId, action.payload);
      })
      .addCase(updateSubCategory.rejected, (state, action) => {
        delete state.mutationRequests[action.meta.requestId];
      });
  },
});


export const categoriesReducer = categoriesSlice.reducer;
export const paymentMethodsReducer = paymentMethodsSlice.reducer;
export const subCategoriesReducer = subCategoriesSlice.reducer;
