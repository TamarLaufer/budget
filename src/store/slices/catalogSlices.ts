/** Categories and payment methods: small household-wide lists, loaded once and kept in sync. */
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CategoryDto, PaymentMethodDto, UpdateCategoryRequest, UpdatePaymentMethodRequest, CreateSubCategoryRequest,
SubCategoryDto, } from "../../../shared/api";
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

const subCategoriesInitial = subCategoriesAdapter.getInitialState<{
  loadByCategory: Record<string, LoadState | undefined>;
  fetchRequests: Record<string, string | undefined>;
  createRequests: Record<string, boolean | undefined>;
}>({
  loadByCategory: {},
  fetchRequests: {},
  createRequests: {},
});

const subCategoriesSlice = createSlice({
  name: "subCategories",
  initialState: subCategoriesInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => subCategoriesInitial)
      .addCase(fetchSubCategories.pending, (state, action) => {
        const categoryId = action.meta.arg;
        state.fetchRequests[categoryId] = action.meta.requestId;
        state.loadByCategory[categoryId] = loadPending(
          state.loadByCategory[categoryId] ?? idleLoad,
        );
      })
      .addCase(fetchSubCategories.fulfilled, (state, action) => {
        const categoryId = action.meta.arg;
        if (state.fetchRequests[categoryId] !== action.meta.requestId) return;

        subCategoriesAdapter.upsertMany(state, action.payload);
        state.loadByCategory[categoryId] = loadSucceeded;
        delete state.fetchRequests[categoryId];
      })
      .addCase(fetchSubCategories.rejected, (state, action) => {
        const categoryId = action.meta.arg;
        if (state.fetchRequests[categoryId] !== action.meta.requestId) return;

        state.loadByCategory[categoryId] = loadFailed(
          state.loadByCategory[categoryId] ?? idleLoad,
          action.payload,
        );
        delete state.fetchRequests[categoryId];
      })
      .addCase(createSubCategory.pending, (state, action) => {
        state.createRequests[action.meta.requestId] = true;
      })
      .addCase(createSubCategory.fulfilled, (state, action) => {
        if (!state.createRequests[action.meta.requestId]) return;

        subCategoriesAdapter.upsertOne(state, action.payload);
        delete state.createRequests[action.meta.requestId];
      })
      .addCase(createSubCategory.rejected, (state, action) => {
        delete state.createRequests[action.meta.requestId];
      });
  },
});


export const categoriesReducer = categoriesSlice.reducer;
export const paymentMethodsReducer = paymentMethodsSlice.reducer;
export const subCategoriesReducer = subCategoriesSlice.reducer;
