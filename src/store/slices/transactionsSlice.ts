import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

import type { CreateTransactionRequest, TransactionDto, UpdateTransactionRequest } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { isDateInPeriod, periodKey, type Period } from "../../budget/period";
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
  shouldFetch,
  type FetchOptions,
  type LoadState,
} from "../shared";

/** Newest first: by date, then by creation time for same-day entries. */
export const transactionsAdapter = createEntityAdapter<TransactionDto>({
  sortComparer: (a, b) =>
    b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt),
});

interface TransactionsExtra {
  /** Load state per month, keyed by periodKey ("2026-10"). */
  months: Record<string, LoadState>;
  /** Counts successful creates, updates and deletes, to spot fetches that raced with one. */
  revision: number;
}

const initialState = transactionsAdapter.getInitialState<TransactionsExtra>({ months: {}, revision: 0 });

export const fetchMonthTransactions = apiThunk(
  "transactions/fetchMonth",
  ({ year, month }: Period & FetchOptions) => api.transactions.list({ year, month }),
  (arg, state) => shouldFetch(state.transactions.months[periodKey(arg)], arg.force),
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
      .addCase(dataInvalidated, (state) => {
        Object.values(state.months).forEach(markStale);
      })
      .addCase(fetchMonthTransactions.pending, (state, action) => {
        const key = periodKey(action.meta.arg);
        const { requestId: id, startedAt } = action.meta;
        state.months[key] = loadPending(state.months[key], { id, startedAt, revision: state.revision });
      })
      .addCase(fetchMonthTransactions.fulfilled, (state, action) => {
        const period = action.meta.arg;
        const key = periodKey(period);
        const fetchedAt = acceptResponse(state.months, key, action.meta.requestId, state.revision);
        if (fetchedAt === null) return;
        // Replace the month wholesale so records another member deleted disappear too.
        replaceRecords(transactionsAdapter, state, action.payload, (t) => isDateInPeriod(t.transactionDate, period));
        state.months[key] = loadSucceeded(fetchedAt);
      })
      .addCase(fetchMonthTransactions.rejected, (state, action) => {
        const key = periodKey(action.meta.arg);
        if (isCurrentRequest(state.months[key], action.meta.requestId)) {
          state.months[key] = loadFailed(state.months[key], action.payload);
        }
      })
      // Mutations apply the server's response directly; no refetch needed.
      .addCase(createTransaction.fulfilled, (state, action) => {
        transactionsAdapter.addOne(state, action.payload);
        state.revision += 1;
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        transactionsAdapter.setOne(state, action.payload);
        state.revision += 1;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        transactionsAdapter.removeOne(state, action.meta.arg);
        state.revision += 1;
      });
  },
});

export default transactionsSlice.reducer;
