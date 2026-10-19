import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CreateTransactionRequest, TransactionDto, UpdateTransactionRequest } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { isDateInPeriod, periodKey, type Period } from "../../budget/period";
import { apiThunk, loadFailed, loadPending, loadSucceeded, householdChanged, type LoadState } from "../shared";

/** Newest first: by date, then by creation time for same-day entries. */
export const transactionsAdapter = createEntityAdapter<TransactionDto>({
  sortComparer: (a, b) =>
    b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt),
});

interface TransactionsExtra {
  /** Load state per month, keyed by periodKey ("2026-10"). */
  months: Record<string, LoadState>;
}

const initialState = transactionsAdapter.getInitialState<TransactionsExtra>({ months: {} });

export const fetchMonthTransactions = apiThunk("transactions/fetchMonth", ({ year, month }: Period) =>
  api.transactions.list({ year, month }),
);
export const createTransaction = apiThunk("transactions/create", (body: CreateTransactionRequest) =>
  api.transactions.create(body),
);
export const updateTransaction = apiThunk(
  "transactions/update",
  ({ id, changes }: { id: string; changes: UpdateTransactionRequest }) => api.transactions.update(id, changes),
);
export const deleteTransaction = apiThunk("transactions/delete", (id: string) => api.transactions.remove(id));

const transactionsSlice = createSlice({
  name: "transactions",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => initialState)
      .addCase(fetchMonthTransactions.pending, (state, action) => {
        const key = periodKey(action.meta.arg);
        state.months[key] = loadPending(state.months[key]);
      })
      .addCase(fetchMonthTransactions.fulfilled, (state, action) => {
        const period = action.meta.arg;
        // Replace the month wholesale so records another member deleted disappear too.
        const stale = Object.values(state.entities)
          .filter((t) => isDateInPeriod(t.transactionDate, period))
          .map((t) => t.id);
        transactionsAdapter.removeMany(state, stale);
        transactionsAdapter.upsertMany(state, action.payload);
        state.months[periodKey(period)] = loadSucceeded;
      })
      .addCase(fetchMonthTransactions.rejected, (state, action) => {
        state.months[periodKey(action.meta.arg)] = loadFailed(state.months[periodKey(action.meta.arg)], action.payload);
      })
      // Mutations apply the server's response directly; no refetch needed.
      .addCase(createTransaction.fulfilled, (state, action) => {
        transactionsAdapter.addOne(state, action.payload);
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        transactionsAdapter.setOne(state, action.payload);
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        transactionsAdapter.removeOne(state, action.meta.arg);
      });
  },
});

export default transactionsSlice.reducer;
