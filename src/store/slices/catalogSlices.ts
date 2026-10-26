/** Categories and payment methods: small household-wide lists, loaded once and kept in sync. */
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CategoryDto, PaymentMethodDto, UpdateCategoryRequest, UpdatePaymentMethodRequest } from "../../../shared/api";
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

export const categoriesReducer = categoriesSlice.reducer;
export const paymentMethodsReducer = paymentMethodsSlice.reducer;
