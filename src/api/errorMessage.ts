import type { ApiFailure } from "../store/shared";
import { strings } from "../strings/he";
import { ApiError } from "./client";

/** A user-facing Hebrew message for any API failure. Unknown codes get a generic message. */
export function errorMessage(error: ApiFailure | ApiError | null | undefined): string {
  if (!error) return strings.API_ERROR_FALLBACK;
  return strings.API_ERRORS[error.code] ?? strings.API_ERROR_FALLBACK;
}

/** For `dispatch(thunk).unwrap()` rejections, which carry an ApiFailure payload. */
export function messageFromUnknown(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error);
  if (typeof error === "object" && error !== null && "code" in error) {
    return errorMessage(error as ApiFailure);
  }
  return strings.API_ERROR_FALLBACK;
}
