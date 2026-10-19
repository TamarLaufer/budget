import type { Request, Response } from "express";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { errorHandler } from "../../src/middleware/errorHandler.js";
import { AppError } from "../../src/utils/errors.js";

function respond(error: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const logger = pino({ level: "silent" });
  const logSpy = vi.spyOn(logger, "error");
  errorHandler(logger)(error, { method: "GET", path: "/x" } as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0]?.[0] as number, body: res.json.mock.calls[0]?.[0] as unknown, logSpy };
}

describe("errorHandler", () => {
  it("renders AppErrors in the standard format", () => {
    const { status, body } = respond(new AppError(404, "CATEGORY_NOT_FOUND", "Category was not found"));
    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "CATEGORY_NOT_FOUND", message: "Category was not found" } });
  });

  it("renders Zod errors as 400 with field details", () => {
    const result = z.strictObject({ amount: z.number() }).safeParse({ amount: "x" });
    const { status, body } = respond(result.error);
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR", details: [{ path: "amount" }] } });
  });

  it("hides internal details of unexpected errors and logs them", () => {
    const { status, body, logSpy } = respond(new Error("connection string postgres://secret@db"));
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(logSpy).toHaveBeenCalled();
  });
});
