import {
  createAction,
  createAsyncThunk,
  isDraft,
  original,
  type Draft,
  type EntityState,
  type EntityStateAdapter,
} from "@reduxjs/toolkit";
import { copyWithStructuralSharing } from "@reduxjs/toolkit/query";

import { ApiError } from "../api/client";
import type { RootState } from "./index";

export type RequestStatus = "idle" | "loading" | "succeeded" | "failed";

/** Serializable form of an ApiError, stored in Redux and mapped to a Hebrew message by the UI. */
export interface ApiFailure {
  status: number;
  code: string;
  message: string;
}

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiError) return { status: error.status, code: error.code, message: error.message };
  return { status: 0, code: "UNKNOWN", message: error instanceof Error ? error.message : String(error) };
}

/** createAsyncThunk whose rejections always carry an ApiFailure and whose requests record when they started. */
export const createApiThunk = createAsyncThunk.withTypes<{ rejectValue: ApiFailure; pendingMeta: { startedAt: number } }>();

/**
 * Wraps an API call so any thrown error becomes a typed rejection. When `condition` returns false
 * the request is not sent and no action is dispatched.
 */
export function apiThunk<Returned, Arg = void>(
  type: string,
  run: (arg: Arg) => Promise<Returned>,
  condition?: (arg: Arg, state: RootState) => boolean,
) {
  return createApiThunk<Returned, Arg>(
    type,
    async (arg, { rejectWithValue }) => {
      try {
        return await run(arg);
      } catch (error) {
        return rejectWithValue(toApiFailure(error));
      }
    },
    {
      getPendingMeta: () => ({ startedAt: Date.now() }),
      condition: condition && ((arg, { getState }) => condition(arg, getState() as RootState)),
    },
  );
}

/** Signed out (or switched account): every slice returns to its initial state. */
export const sessionEnded = createAction("session/ended");

/** Joined or left a household: household data from before must not leak into the new one. */
export const householdChanged = createAction("session/householdChanged");

/** The app returned to the foreground: other household members may have changed data meanwhile. */
export const dataInvalidated = createAction("session/dataInvalidated");

/** The fetch a load is waiting for. */
export interface PendingRequest {
  id: string;
  /** When it was sent; once it succeeds, this is how old the stored data is. */
  startedAt: number;
  /** The slice's `revision` when it was sent. */
  revision: number;
}

export interface LoadState {
  status: RequestStatus;
  error: ApiFailure | null;
  /** True once data has loaded at least once, so refetches can keep showing it. */
  loaded: boolean;
  /** When the request behind the stored data was sent; null until something has loaded. */
  fetchedAt: number | null;
  /** Fetch again on next use, whatever its age (set when the app returns to the foreground). */
  stale: boolean;
  /** The fetch in flight; responses to any other request are ignored. */
  request: PendingRequest | null;
}

export const idleLoad: LoadState = { status: "idle", error: null, loaded: false, fetchedAt: null, stale: false, request: null };

export const loadPending = (prev: LoadState | undefined, request: PendingRequest | null = null): LoadState => ({
  ...(prev ?? idleLoad),
  status: "loading",
  error: null,
  request,
});
export const loadSucceeded = (fetchedAt: number | null = null): LoadState => ({
  status: "succeeded",
  error: null,
  loaded: true,
  fetchedAt,
  stale: false,
  request: null,
});
export const loadFailed = (prev: LoadState | undefined, error: ApiFailure | undefined): LoadState => ({
  ...(prev ?? idleLoad),
  status: "failed",
  error: error ?? null,
  request: null,
});

/** How long fetched data is reused before the next request for it goes to the server again. */
export const FRESH_FOR_MS = 5 * 60 * 1000;

/** `force` fetches even fresh data (pull-to-refresh, retry). */
export interface FetchOptions {
  force?: boolean;
}

/**
 * Whether a fetch should be sent. Never while the same fetch is in flight; otherwise when forced,
 * or when the data is missing, marked stale or older than FRESH_FOR_MS.
 */
export function shouldFetch(load: LoadState | undefined, force = false, now = Date.now()): boolean {
  if (load?.status === "loading") return false;
  if (force || !load?.loaded || load.stale) return true;
  return load.fetchedAt === null || now - load.fetchedAt >= FRESH_FOR_MS;
}

/** Marks loaded data to be fetched again on next use. */
export function markStale(load: LoadState) {
  if (load.loaded) load.stale = true;
}

/**
 * Checks a fetch response before it is stored and returns when its request was sent, or null if
 * it must not be stored. Responses to a request the load is no longer waiting for are ignored
 * (for example one sent before the household changed). If a create, update or delete succeeded
 * while the fetch was in flight, the response may predate it and would undo it, so it is dropped
 * and the data marked stale to be fetched again.
 */
export function acceptResponse<K extends string>(
  loads: Partial<Record<K, LoadState>>,
  key: K,
  requestId: string,
  revision: number,
): number | null {
  const load = loads[key];
  if (!load?.request || load.request.id !== requestId) return null;
  if (load.request.revision !== revision) {
    loads[key] = { ...load, status: "idle", request: null, stale: true };
    return null;
  }
  return load.request.startedAt;
}

/** Whether a fetch's failure belongs to the request the load is waiting for. */
export const isCurrentRequest = (load: LoadState | undefined, requestId: string) => load?.request?.id === requestId;

/**
 * Makes the stored records matching `inScope` equal to the server's `received` list: records it
 * no longer returns are removed, new and changed ones are written, and identical ones are left
 * untouched. Unchanged records, and the collections holding them, keep their identity, so a
 * refetch that returns the same data does not recompute selectors or re-render components.
 */
export function replaceRecords<T extends { id: string }>(
  adapter: EntityStateAdapter<T, string>,
  state: EntityState<T, string>,
  received: readonly T[],
  inScope: (record: T) => boolean = () => true,
) {
  // Compare against plain objects: reading through Immer drafts would create a proxy per record.
  const stored = isDraft(state.entities)
    ? (original<Record<string, T>>(state.entities as Draft<Record<string, T>>) as Record<string, T>)
    : state.entities;
  const receivedIds = new Set(received.map((record) => record.id));

  const removed = Object.values(stored).filter((record) => inScope(record) && !receivedIds.has(record.id));
  adapter.removeMany(state, removed.map((record) => record.id));

  const changed = received.filter((record) => {
    const previous = stored[record.id];
    return previous === undefined || copyWithStructuralSharing(previous, record) !== previous;
  });
  adapter.setMany(state, changed);
}

/** Puts `ids` in the given order, keeping the existing array when the order is already the same. */
export function setIdOrder(state: { ids: string[] }, ids: string[]) {
  if (ids.length !== state.ids.length || ids.some((id, i) => id !== state.ids[i])) state.ids = ids;
}
