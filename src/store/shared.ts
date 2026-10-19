import { createAction, createAsyncThunk } from "@reduxjs/toolkit";

import { ApiError } from "../api/client";

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

/** createAsyncThunk whose rejections always carry an ApiFailure. */
export const createApiThunk = createAsyncThunk.withTypes<{ rejectValue: ApiFailure }>();

/** Wraps an API call so any thrown error becomes a typed rejection. */
export function apiThunk<Returned, Arg = void>(type: string, run: (arg: Arg) => Promise<Returned>) {
  return createApiThunk<Returned, Arg>(type, async (arg, { rejectWithValue }) => {
    try {
      return await run(arg);
    } catch (error) {
      return rejectWithValue(toApiFailure(error));
    }
  });
}

/** Signed out (or switched account): every slice returns to its initial state. */
export const sessionEnded = createAction("session/ended");

/** Joined or left a household: household data from before must not leak into the new one. */
export const householdChanged = createAction("session/householdChanged");

export interface LoadState {
  status: RequestStatus;
  error: ApiFailure | null;
  /** True once data has loaded at least once, so refetches can keep showing it. */
  loaded: boolean;
}

export const idleLoad: LoadState = { status: "idle", error: null, loaded: false };

export const loadPending = (prev: LoadState | undefined): LoadState => ({
  status: "loading",
  error: null,
  loaded: prev?.loaded ?? false,
});
export const loadSucceeded: LoadState = { status: "succeeded", error: null, loaded: true };
export const loadFailed = (prev: LoadState | undefined, error: ApiFailure | undefined): LoadState => ({
  status: "failed",
  error: error ?? null,
  loaded: prev?.loaded ?? false,
});
