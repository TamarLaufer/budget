import { describe, expect, it } from "vitest";

import type { CategoryDto, MemberDto, MembershipDto } from "../../../shared/api.js";
import { getPrisma } from "../../src/db/prisma.js";
import { DEFAULT_CATEGORY_NAMES } from "../../src/services/defaultCategories.js";
import { addMember, createHousehold } from "../helpers/scenarios.js";
import { createTestContext } from "../helpers/testApp.js";

const ctx = createTestContext();

describe("household creation", () => {
  it("creates the household with the creator as OWNER", async () => {
    const alice = ctx.user("alice");
    const membership = await createHousehold(ctx, alice, "Our home");
    expect(membership).toMatchObject({ role: "OWNER", household: { name: "Our home" } });

    const me = await ctx.as(alice).get("/api/auth/me");
    expect((me.body as { membership: MembershipDto }).membership).toEqual(membership);
  });

  it("optionally adds default categories in the same transaction", async () => {
    const alice = ctx.user("alice");
    const res = await ctx.as(alice).post("/api/households").send({ name: "Home", withDefaultCategories: true });
    expect(res.status).toBe(201);
    const categories = await ctx.as(alice).get("/api/categories");
    expect((categories.body as CategoryDto[]).map((c) => c.name)).toEqual([...DEFAULT_CATEGORY_NAMES]);
  });

  it("prevents a user from creating or joining a second household", async () => {
    const alice = ctx.user("alice");
    await createHousehold(ctx, alice);
    const second = await ctx.as(alice).post("/api/households").send({ name: "Second" });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: { code: "ALREADY_IN_HOUSEHOLD" } });
    expect(await getPrisma().household.count()).toBe(1);
  });

  it("is safe under concurrent creation requests", async () => {
    const alice = ctx.user("alice");
    await ctx.as(alice).get("/api/auth/me");
    const results = await Promise.all(
      [1, 2, 3].map((n) => ctx.as(alice).post("/api/households").send({ name: `H${n}` })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await getPrisma().householdMember.count()).toBe(1);
  });

  it("validates the name and rejects unknown fields", async () => {
    const alice = ctx.user("alice");
    expect((await ctx.as(alice).post("/api/households").send({ name: "  " })).status).toBe(400);
    expect((await ctx.as(alice).post("/api/households").send({ name: "x".repeat(61) })).status).toBe(400);
    const smuggled = await ctx.as(alice).post("/api/households").send({ name: "H", createdByUserId: "x" });
    expect(smuggled.status).toBe(400);
  });
});

describe("users without a household", () => {
  it.each([
    ["get", "/api/households/current"],
    ["get", "/api/households/members"],
    ["get", "/api/households/invitations"],
    ["get", "/api/categories"],
    ["get", "/api/payment-methods"],
    ["get", "/api/budgets?year=2026&month=10"],
    ["get", "/api/transactions"],
    ["post", "/api/transactions"],
  ] as const)("get 403 NO_HOUSEHOLD on %s %s", async (method, path) => {
    const res = await ctx.as(ctx.user("loner"))[method](path).send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: { code: "NO_HOUSEHOLD" } });
  });
});

describe("household settings and members", () => {
  async function setup() {
    const owner = ctx.user("owner");
    const admin = ctx.user("admin");
    const member = ctx.user("member");
    await createHousehold(ctx, owner);
    await addMember(ctx, owner, admin, "ADMIN");
    await addMember(ctx, owner, member, "MEMBER");
    const res = await ctx.as(owner).get("/api/households/members");
    const members = res.body as MemberDto[];
    const idOf = (email: string) => members.find((m) => m.user.email === email)!.id;
    return { owner, admin, member, members, idOf };
  }

  it("lists all members with roles", async () => {
    const { members } = await setup();
    expect(members.map((m) => [m.user.email, m.role])).toEqual([
      ["owner@example.com", "OWNER"],
      ["admin@example.com", "ADMIN"],
      ["member@example.com", "MEMBER"],
    ]);
  });

  it("lets OWNER/ADMIN rename the household but not MEMBER", async () => {
    const { admin, member } = await setup();
    expect((await ctx.as(admin).patch("/api/households/current").send({ name: "Renamed" })).status).toBe(200);
    const denied = await ctx.as(member).patch("/api/households/current").send({ name: "Hacked" });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ error: { code: "INSUFFICIENT_ROLE" } });
  });

  it("only the OWNER can change roles, and never the owner's own role", async () => {
    const { owner, admin, member, idOf } = await setup();
    const memberId = idOf("member@example.com");

    expect((await ctx.as(admin).patch(`/api/households/members/${memberId}`).send({ role: "ADMIN" })).status).toBe(403);
    expect((await ctx.as(member).patch(`/api/households/members/${memberId}`).send({ role: "ADMIN" })).status).toBe(403);

    const promoted = await ctx.as(owner).patch(`/api/households/members/${memberId}`).send({ role: "ADMIN" });
    expect(promoted.status).toBe(200);
    expect((promoted.body as MemberDto).role).toBe("ADMIN");

    const ownerChange = await ctx.as(owner).patch(`/api/households/members/${idOf("owner@example.com")}`).send({ role: "MEMBER" });
    expect(ownerChange.status).toBe(403);
    expect(ownerChange.body).toMatchObject({ error: { code: "CANNOT_CHANGE_OWNER" } });

    const toOwner = await ctx.as(owner).patch(`/api/households/members/${memberId}`).send({ role: "OWNER" });
    expect(toOwner.status).toBe(400);
  });

  it("OWNER removes members; others may only leave; the owner can never be removed", async () => {
    const { owner, admin, member, idOf } = await setup();

    expect((await ctx.as(admin).delete(`/api/households/members/${idOf("member@example.com")}`)).status).toBe(403);
    expect((await ctx.as(admin).delete(`/api/households/members/${idOf("owner@example.com")}`)).status).toBe(403);
    expect((await ctx.as(owner).delete(`/api/households/members/${idOf("owner@example.com")}`)).status).toBe(403);

    expect((await ctx.as(member).delete(`/api/households/members/${idOf("member@example.com")}`)).status).toBe(204);
    expect((await ctx.as(member).get("/api/transactions")).status).toBe(403);

    expect((await ctx.as(owner).delete(`/api/households/members/${idOf("admin@example.com")}`)).status).toBe(204);
    const remaining = await ctx.as(owner).get("/api/households/members");
    expect((remaining.body as MemberDto[]).map((m) => m.role)).toEqual(["OWNER"]);
  });
});
