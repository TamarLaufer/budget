/** Categories and payment methods: small household-wide lists, loaded once and kept in sync. */
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CategoryDto, PaymentMethodDto, UpdateCategoryRequest, UpdatePaymentMethodRequest } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { apiThunk, loadFailed, loadPending, loadSucceeded, householdChanged, idleLoad, type LoadState } from "../shared";

export const categoriesAdapter = createEntityAdapter<CategoryDto>({
  sortComparer: (a, b) => a.createdAt.localeCompare(b.createdAt),
});
export const paymentMethodsAdapter = createEntityAdapter<PaymentMethodDto>();

export const fetchCategories = apiThunk("categories/fetch", () => api.categories.list());
export const createCategory = apiThunk("categories/create", (name: string) => api.categories.create({ name }));
export const updateCategory = apiThunk(
  "categories/update",
  ({ id, changes }: { id: string; changes: UpdateCategoryRequest }) => api.categories.update(id, changes),
);

export const fetchPaymentMethods = apiThunk("paymentMethods/fetch", () => api.paymentMethods.list());
export const createPaymentMethod = apiThunk("paymentMethods/create", (name: string) =>
  api.paymentMethods.create({ name }),
);
export const updatePaymentMethod = apiThunk(
  "paymentMethods/update",
  ({ id, changes }: { id: string; changes: UpdatePaymentMethodRequest }) => api.paymentMethods.update(id, changes),
);

const categoriesInitial = categoriesAdapter.getInitialState<{ load: LoadState }>({ load: idleLoad });

const categoriesSlice = createSlice({
  name: "categories",
  initialState: categoriesInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => categoriesInitial)
      .addCase(fetchCategories.pending, (state) => {
        state.load = loadPending(state.load);
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        categoriesAdapter.setAll(state, action.payload);
        state.load = loadSucceeded;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.load = loadFailed(state.load, action.payload);
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        categoriesAdapter.addOne(state, action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        categoriesAdapter.setOne(state, action.payload);
      });
  },
});

const paymentMethodsInitial = paymentMethodsAdapter.getInitialState<{ load: LoadState }>({ load: idleLoad });

const paymentMethodsSlice = createSlice({
  name: "paymentMethods",
  initialState: paymentMethodsInitial,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => paymentMethodsInitial)
      .addCase(fetchPaymentMethods.pending, (state) => {
        state.load = loadPending(state.load);
      })
      .addCase(fetchPaymentMethods.fulfilled, (state, action) => {
        paymentMethodsAdapter.setAll(state, action.payload);
        state.load = loadSucceeded;
      })
      .addCase(fetchPaymentMethods.rejected, (state, action) => {
        state.load = loadFailed(state.load, action.payload);
      })
      .addCase(createPaymentMethod.fulfilled, (state, action) => {
        paymentMethodsAdapter.addOne(state, action.payload);
      })
      .addCase(updatePaymentMethod.fulfilled, (state, action) => {
        paymentMethodsAdapter.setOne(state, action.payload);
      });
  },
});

export const categoriesReducer = categoriesSlice.reducer;
export const paymentMethodsReducer = paymentMethodsSlice.reducer;
