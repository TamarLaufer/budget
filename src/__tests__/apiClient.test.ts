import { ApiError, apiRequest, configureApiClient } from "../api/client";
import { errorMessage } from "../api/errorMessage";
import { createStore } from "../store";
import { selectTransactionsForPeriod } from "../store/selectors";
import { periodSelected } from "../store/slices/periodSlice";
import { createTransaction } from "../store/slices/transactionsSlice";
import { makeTransaction } from "../test-utils/fixtures";

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const getToken = jest.fn((forceRefresh: boolean) => Promise.resolve(forceRefresh ? "fresh-token" : "cached-token"));

beforeEach(() => {
  fetchMock.mockReset();
  getToken.mockClear();
  configureApiClient({ baseUrl: "https://api.example.com", getToken, timeoutMs: 50 });
});

function headersOf(call: number): Record<string, string> {
  return (fetchMock.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>;
}

describe("apiRequest", () => {
  it("sends the Firebase ID token as a Bearer header and serializes query/body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await apiRequest("POST", "/transactions", { body: { a: 1 }, query: { year: 2026, month: 10, q: undefined } });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.com/api/transactions?year=2026&month=10");
    expect(headersOf(0).Authorization).toBe("Bearer cached-token");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBe('{"a":1}');
  });

  it("retries once with a force-refreshed token after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "TOKEN_EXPIRED", message: "expired" } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "x" }));

    await expect(apiRequest("GET", "/auth/me")).resolves.toEqual({ id: "x" });
    expect(getToken).toHaveBeenLastCalledWith(true);
    expect(headersOf(1).Authorization).toBe("Bearer fresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the standard error body as an ApiError", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: { code: "CATEGORY_NOT_FOUND", message: "Category was not found" } }));
    const error = (await apiRequest("GET", "/categories/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "CATEGORY_NOT_FOUND" });
    expect(errorMessage(error)).toBe("הקטגוריה לא נמצאה");
  });

  it("handles non-JSON error bodies", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error("html")) } as Response);
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ status: 502, code: "HTTP_ERROR" });
  });

  it("maps network failures and timeouts to readable errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });

    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new Error("empty")) } as Response);
    await expect(apiRequest("DELETE", "/transactions/x")).resolves.toBeUndefined();
  });

  it("refuses to run without a configured base URL", async () => {
    configureApiClient({ baseUrl: "" });
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ code: "CONFIG_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("thunk + API flow", () => {
  it("POST /transactions puts the returned record into Redux with no follow-up GET", async () => {
    const created = makeTransaction({ amountAgorot: 8790 });
    fetchMock.mockResolvedValue(jsonResponse(201, created));
    const store = createStore();
    store.dispatch(periodSelected({ year: 2026, month: 10 }));

    await store
      .dispatch(createTransaction({ type: "EXPENSE", amountAgorot: 8790, categoryId: "food", transactionDate: "2026-10-10" }))
      .unwrap();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
    expect(selectTransactionsForPeriod(store.getState())).toEqual([created]);
  });

  it("a failed save rejects with an ApiFailure and leaves the store unchanged", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { code: "CATEGORY_REQUIRED", message: "x" } }));
    const store = createStore();
    const result = await store.dispatch(
      createTransaction({ type: "EXPENSE", amountAgorot: 100, categoryId: null, transactionDate: "2026-10-10" }),
    );
    expect(result.payload).toEqual({ status: 400, code: "CATEGORY_REQUIRED", message: "x" });
    expect(store.getState().transactions.ids).toEqual([]);
  });
});
