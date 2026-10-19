import type { ApiErrorBody } from "../../shared/api";

/** Any failed API call. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Returns a Firebase ID token; `forceRefresh` bypasses the SDK's token cache. */
export type TokenProvider = (forceRefresh: boolean) => Promise<string | null>;

interface ClientConfig {
  baseUrl: string;
  getToken: TokenProvider;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

let config: ClientConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
  getToken: async () => null,
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

/** Wires the client to the auth layer (and lets tests inject fakes). */
export function configureApiClient(overrides: Partial<ClientConfig>): void {
  config = { ...config, ...overrides };
}

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${config.baseUrl}/api${path}${params.length ? `?${params.join("&")}` : ""}`;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

async function send(method: string, url: string, token: string | null, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(0, "TIMEOUT", "The server took too long to respond");
    throw new ApiError(0, "NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends an authenticated JSON request.
 * Every request carries the current Firebase ID token. If the server answers 401 (for example
 * the cached token expired a moment ago), the token is force-refreshed and the request retried
 * once. The server still verifies every request independently.
 */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: { body?: unknown; query?: Query } = {},
): Promise<T> {
  if (!config.baseUrl) throw new ApiError(0, "CONFIG_ERROR", "EXPO_PUBLIC_API_URL is not configured");
  const url = buildUrl(path, options.query);

  let response = await send(method, url, await config.getToken(false), options.body);
  if (response.status === 401) {
    response = await send(method, url, await config.getToken(true), options.body);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below.
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(response.status, payload.error.code, payload.error.message);
    }
    throw new ApiError(response.status, "HTTP_ERROR", `Request failed with status ${response.status}`);
  }
  return payload as T;
}
