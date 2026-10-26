import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { MonthlyBudgetDto, UpsertBudgetRequest } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { periodKey, type Period } from "../../budget/period";
import {
  acceptResponse,
  apiThunk,
  dataInvalidated,
  householdChanged,
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

export const budgetsAdapter = createEntityAdapter<MonthlyBudgetDto>();

interface BudgetsExtra {
  /** Load state per month, keyed by periodKey ("2026-10"). */
  months: Record<string, LoadState>;
  /** Counts successful upserts and deletes, to spot fetches that raced with one. */
  revision: number;
}

const initialState = budgetsAdapter.getInitialState<BudgetsExtra>({ months: {}, revision: 0 });

export const fetchMonthBudgets = apiThunk(
  "budgets/fetchMonth",
  ({ year, month }: Period & FetchOptions) => api.budgets.list({ year, month }),
  (arg, state) => shouldFetch(state.budgets.months[periodKey(arg)], arg.force),
);
export const upsertBudget = apiThunk("budgets/upsert", (body: UpsertBudgetRequest) => api.budgets.upsert(body));
export const deleteBudget = apiThunk("budgets/delete", (id: string) => api.budgets.remove(id));

const budgetsSlice = createSlice({
  name: "budgets",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => initialState)
      .addCase(dataInvalidated, (state) => {
        Object.values(state.months).forEach(markStale);
      })
      .addCase(fetchMonthBudgets.pending, (state, action) => {
        const key = periodKey(action.meta.arg);
        const { requestId: id, startedAt } = action.meta;
        state.months[key] = loadPending(state.months[key], { id, startedAt, revision: state.revision });
      })
      .addCase(fetchMonthBudgets.fulfilled, (state, action) => {
        const { year, month } = action.meta.arg;
        const key = periodKey(action.meta.arg);
        const fetchedAt = acceptResponse(state.months, key, action.meta.requestId, state.revision);
        if (fetchedAt === null) return;
        replaceRecords(budgetsAdapter, state, action.payload, (b) => b.year === year && b.month === month);
        // Same order as replacing the month wholesale: other months first, then this one as received.
        const received = action.payload.map((b) => b.id);
        const receivedIds = new Set(received);
        setIdOrder(state, [...state.ids.filter((id) => !receivedIds.has(id)), ...received]);
        state.months[key] = loadSucceeded(fetchedAt);
      })
      .addCase(fetchMonthBudgets.rejected, (state, action) => {
        const key = periodKey(action.meta.arg);
        if (isCurrentRequest(state.months[key], action.meta.requestId)) {
          state.months[key] = loadFailed(state.months[key], action.payload);
        }
      })
      .addCase(upsertBudget.fulfilled, (state, action) => {
        budgetsAdapter.upsertOne(state, action.payload);
        state.revision += 1;
      })
      .addCase(deleteBudget.fulfilled, (state, action) => {
        budgetsAdapter.removeOne(state, action.meta.arg);
        state.revision += 1;
      });
  },
});

export default budgetsSlice.reducer;
