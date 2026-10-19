import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { MonthlyBudgetDto, UpsertBudgetRequest } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { periodKey, type Period } from "../../budget/period";
import { apiThunk, loadFailed, loadPending, loadSucceeded, householdChanged, type LoadState } from "../shared";

export const budgetsAdapter = createEntityAdapter<MonthlyBudgetDto>();

const initialState = budgetsAdapter.getInitialState<{ months: Record<string, LoadState> }>({ months: {} });

export const fetchMonthBudgets = apiThunk("budgets/fetchMonth", (period: Period) => api.budgets.list(period));
export const upsertBudget = apiThunk("budgets/upsert", (body: UpsertBudgetRequest) => api.budgets.upsert(body));
export const deleteBudget = apiThunk("budgets/delete", (id: string) => api.budgets.remove(id));

const budgetsSlice = createSlice({
  name: "budgets",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => initialState)
      .addCase(fetchMonthBudgets.pending, (state, action) => {
        state.months[periodKey(action.meta.arg)] = loadPending(state.months[periodKey(action.meta.arg)]);
      })
      .addCase(fetchMonthBudgets.fulfilled, (state, action) => {
        const { year, month } = action.meta.arg;
        const stale = Object.values(state.entities)
          .filter((b) => b.year === year && b.month === month)
          .map((b) => b.id);
        budgetsAdapter.removeMany(state, stale);
        budgetsAdapter.upsertMany(state, action.payload);
        state.months[periodKey(action.meta.arg)] = loadSucceeded;
      })
      .addCase(fetchMonthBudgets.rejected, (state, action) => {
        state.months[periodKey(action.meta.arg)] = loadFailed(state.months[periodKey(action.meta.arg)], action.payload);
      })
      .addCase(upsertBudget.fulfilled, (state, action) => {
        budgetsAdapter.upsertOne(state, action.payload);
      })
      .addCase(deleteBudget.fulfilled, (state, action) => {
        budgetsAdapter.removeOne(state, action.meta.arg);
      });
  },
});

export default budgetsSlice.reducer;
