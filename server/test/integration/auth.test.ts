import request from "supertest";
import { describe, expect, it } from "vitest";

import { getPrisma } from "../../src/db/prisma.js";
import { createTestContext, EXPIRED_TOKEN, REVOKED_TOKEN } from "../helpers/testApp.js";

const ctx = createTestContext();

describe("authentication", () => {
  it("serves health checks without authentication", async () => {
    expect((await request(ctx.app).get("/health")).status).toBe(200);
    expect((await request(ctx.app).get("/health/ready")).status).toBe(200);
  });

  it.each([
    ["no Authorization header", undefined, "UNAUTHENTICATED"],
    ["a non-Bearer scheme", "Basic dXNlcjpwYXNz", "UNAUTHENTICATED"],
    ["an unknown/forged token", "Bearer forged.token.value", "INVALID_TOKEN"],
    ["an expired token", `Bearer ${EXPIRED_TOKEN}`, "TOKEN_EXPIRED"],
    ["a revoked token", `Bearer ${REVOKED_TOKEN}`, "TOKEN_REVOKED"],
  ])("rejects %s with 401", async (_label, header, code) => {
    const req = request(ctx.app).get("/api/auth/me");
    const res = await (header ? req.set("Authorization", header) : req);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code, message: expect.any(String) as string } });
  });

  it("protects every API route, not only /auth/me", async () => {
    for (const path of ["/api/transactions", "/api/categories", "/api/budgets?year=2026&month=10", "/api/households/members"]) {
      expect((await request(ctx.app).get(path)).status).toBe(401);
    }
    expect((await request(ctx.app).post("/api/transactions").send({})).status).toBe(401);
  });

  it("provisions the DB user on first sign-in and reuses it afterwards", async () => {
    const alice = ctx.user("alice");
    const first = await ctx.as(alice).get("/api/auth/me");
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      user: { id: expect.any(String) as string, email: "alice@example.com", displayName: null },
      membership: null,
      notifications: { budgetAlertsEnabled: false },
    });

    const second = await ctx.as(alice).get("/api/auth/me");
    expect((second.body as { user: { id: string } }).user.id).toBe((first.body as { user: { id: string } }).user.id);
    expect(await getPrisma().user.count()).toBe(1);
  });

  it("never exposes the Firebase uid", async () => {
    const res = await ctx.as(ctx.user("alice")).get("/api/auth/me");
    expect(JSON.stringify(res.body)).not.toContain("uid-alice");
  });

  it("normalizes and syncs the email from the token", async () => {
    const bob = ctx.user("bob", { email: "Bob@Example.COM" });
    const res = await ctx.as(bob).get("/api/auth/me");
    expect((res.body as { user: { email: string } }).user.email).toBe("bob@example.com");

    ctx.verifier.register(bob.token, { uid: bob.uid, email: "bob.new@example.com", emailVerified: true });
    const after = await ctx.as(bob).get("/api/auth/me");
    expect((after.body as { user: { email: string } }).user.email).toBe("bob.new@example.com");
  });

  it("updates the display name", async () => {
    const alice = ctx.user("alice");
    const res = await ctx.as(alice).patch("/api/auth/me").send({ displayName: "  Alice  " });
    expect(res.status).toBe(200);
    expect((res.body as { user: { displayName: string } }).user.displayName).toBe("Alice");
  });

  it("returns JSON errors for unknown routes and malformed bodies", async () => {
    const alice = ctx.user("alice");
    const missing = await ctx.as(alice).get("/api/nope");
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ error: { code: "ROUTE_NOT_FOUND" } });

    const malformed = await ctx
      .as(alice)
      .post("/api/households")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(malformed.status).toBe(400);
    expect(malformed.body).toMatchObject({ error: { code: "INVALID_JSON" } });
  });

  it("sets security headers", async () => {
    const res = await request(ctx.app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("rate limiting", () => {
  const limited = createTestContext({ rateLimitMax: 3 });

  it("returns 429 in the standard error format once the limit is exceeded", async () => {
    const user = limited.user("alice");
    for (let i = 0; i < 3; i++) {
      expect((await limited.as(user).get("/api/auth/me")).status).toBe(200);
    }
    const res = await limited.as(user).get("/api/auth/me");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
