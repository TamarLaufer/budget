import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findOrCreateByFirebaseUid = vi.fn();
vi.mock("../../src/repositories/usersRepository.js", () => ({ findOrCreateByFirebaseUid }));

const { authenticate } = await import("../../src/middleware/authenticate.js");

const verifier = { verify: vi.fn() };
const middleware = authenticate(verifier);

function run(headers: Record<string, string | undefined>) {
  const req = { headers } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  return { req, next, promise: Promise.resolve(middleware(req, {} as Response, next)) };
}

describe("authenticate middleware", () => {
  beforeEach(() => {
    verifier.verify.mockReset();
    findOrCreateByFirebaseUid.mockReset();
  });

  it.each([{}, { authorization: "Basic abc" }, { authorization: "Bearer" }, { authorization: "Bearer a b" }])(
    "rejects missing/malformed header %o with 401",
    async (headers) => {
      const { promise, next } = run(headers);
      await expect(promise).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
      expect(verifier.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("propagates verifier rejections and does not touch the database", async () => {
    verifier.verify.mockRejectedValue(Object.assign(new Error("bad"), { status: 401, code: "INVALID_TOKEN" }));
    const { promise } = run({ authorization: "Bearer abc.def.ghi" });
    await expect(promise).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    expect(findOrCreateByFirebaseUid).not.toHaveBeenCalled();
  });

  it("rejects identities without an email", async () => {
    verifier.verify.mockResolvedValue({ uid: "u1", email: null, emailVerified: false });
    await expect(run({ authorization: "Bearer abc" }).promise).rejects.toMatchObject({ code: "EMAIL_REQUIRED" });
  });

  it("maps the Firebase uid to the DB user and attaches req.auth", async () => {
    verifier.verify.mockResolvedValue({ uid: "u1", email: " User@Example.com ", emailVerified: true });
    findOrCreateByFirebaseUid.mockResolvedValue({ id: "db-1", email: "user@example.com", displayName: null });

    const { req, next, promise } = run({ authorization: "Bearer abc" });
    await promise;

    expect(findOrCreateByFirebaseUid).toHaveBeenCalledWith({ firebaseUid: "u1", email: "user@example.com" });
    expect(req.auth).toEqual({
      user: { id: "db-1", email: "user@example.com", displayName: null },
      emailVerified: true,
    });
    expect(next).toHaveBeenCalledOnce();
  });
});
