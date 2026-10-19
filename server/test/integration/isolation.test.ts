/**
 * SECURITY: household isolation. User A (household A) must never be able to read or change
 * household B's data, whatever ids or parameters they put in the request. User C (no household)
 * must not reach any household resource.
 */
import { describe, expect, it } from "vitest";

import type {
  CategoryDto,
  InvitationDto,
  MemberDto,
  MonthlyBudgetDto,
  PaymentMethodDto,
  TransactionDto,
} from "../../../shared/api.js";
import { getPrisma } from "../../src/db/prisma.js";
import { createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext } from "../helpers/testApp.js";

const ctx = createTestContext();

async function setupTwoHouseholds() {
  const alice = ctx.user("alice");
  const bob = ctx.user("bob");
  const carol = ctx.user("carol");
  const householdA = await createHousehold(ctx, alice, "A");
  const householdB = await createHousehold(ctx, bob, "B");
  await ctx.as(carol).get("/api/auth/me");

  const categoryB = await createCategory(ctx, bob, "B food");
  const paymentB = (await ctx.as(bob).post("/api/payment-methods").send({ name: "B card" })).body as PaymentMethodDto;
  const budgetB = (
    await ctx.as(bob).put("/api/budgets").send({ categoryId: categoryB.id, year: 2026, month: 10, amountAgorot: 100_000 })
  ).body as MonthlyBudgetDto;
  const transactionB = (
    await ctx.as(bob).post("/api/transactions").send({
      type: "EXPENSE",
      amountAgorot: 4200,
      categoryId: categoryB.id,
      transactionDate: "2026-10-05",
      description: "B secret",
    })
  ).body as TransactionDto;
  const invitationB = (await ctx.as(bob).post("/api/households/invitations").send({ email: "x@example.com", role: "MEMBER" }))
    .body as InvitationDto;
  const membersB = (await ctx.as(bob).get("/api/households/members")).body as MemberDto[];

  const categoryA = await createCategory(ctx, alice, "A food");
  return {
    alice,
    bob,
    carol,
    householdA,
    householdB,
    categoryA,
    b: { category: categoryB, payment: paymentB, budget: budgetB, transaction: transactionB, invitation: invitationB, ownerMember: membersB[0]! },
  };
}

async function snapshotB() {
  const prisma = getPrisma();
  return {
    transactions: await prisma.transaction.findMany({ orderBy: { id: "asc" } }),
    categories: await prisma.category.findMany({ orderBy: { id: "asc" } }),
    budgets: await prisma.monthlyBudget.findMany({ orderBy: { id: "asc" } }),
    members: await prisma.householdMember.findMany({ orderBy: { id: "asc" } }),
    invitations: await prisma.invitation.findMany({ orderBy: { id: "asc" } }),
    households: await prisma.household.findMany({ orderBy: { id: "asc" } }),
  };
}

describe("household isolation", () => {
  it("lists only the caller's own household data", async () => {
    const { alice } = await setupTwoHouseholds();
    expect((await ctx.as(alice).get("/api/transactions")).body).toEqual([]);
    expect(((await ctx.as(alice).get("/api/categories")).body as CategoryDto[]).map((c) => c.name)).toEqual(["A food"]);
    expect((await ctx.as(alice).get("/api/budgets?year=2026&month=10")).body).toEqual([]);
    expect((await ctx.as(alice).get("/api/payment-methods")).body).toEqual([]);
    expect((await ctx.as(alice).get("/api/households/invitations")).body).toEqual([]);
    const members = (await ctx.as(alice).get("/api/households/members")).body as MemberDto[];
    expect(members.map((m) => m.user.email)).toEqual(["alice@example.com"]);
    expect(((await ctx.as(alice).get("/api/households/current")).body as { household: { name: string } }).household.name).toBe("A");
  });

  it("returns 404 for every attempt to read or change another household's records by id", async () => {
    const { alice, b } = await setupTwoHouseholds();
    const before = await snapshotB();
    const as = ctx.as(alice);

    const attempts = [
      as.get(`/api/transactions/${b.transaction.id}`),
      as.patch(`/api/transactions/${b.transaction.id}`).send({ amountAgorot: 1 }),
      as.delete(`/api/transactions/${b.transaction.id}`),
      as.patch(`/api/categories/${b.category.id}`).send({ name: "pwned" }),
      as.patch(`/api/payment-methods/${b.payment.id}`).send({ isActive: false }),
      as.patch(`/api/budgets/${b.budget.id}`).send({ amountAgorot: 1 }),
      as.delete(`/api/budgets/${b.budget.id}`),
      as.delete(`/api/households/invitations/${b.invitation.id}`),
      as.patch(`/api/households/members/${b.ownerMember.id}`).send({ role: "MEMBER" }),
      as.delete(`/api/households/members/${b.ownerMember.id}`),
    ];
    for (const [index, res] of (await Promise.all(attempts)).entries()) {
      expect(res.status, `attempt #${index}`).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("B secret");
    }
    expect(await snapshotB()).toEqual(before);
  });

  it("cannot attach another household's category or payment method to its own records", async () => {
    const { alice, categoryA, b } = await setupTwoHouseholds();
    const asAlice = ctx.as(alice);

    const tx = await asAlice.post("/api/transactions").send({
      type: "EXPENSE",
      amountAgorot: 100,
      categoryId: b.category.id,
      transactionDate: "2026-10-01",
    });
    expect(tx.status).toBe(400);
    expect(tx.body).toMatchObject({ error: { code: "INVALID_CATEGORY" } });

    const pm = await asAlice.post("/api/transactions").send({
      type: "EXPENSE",
      amountAgorot: 100,
      categoryId: categoryA.id,
      paymentMethodId: b.payment.id,
      transactionDate: "2026-10-01",
    });
    expect(pm.body).toMatchObject({ error: { code: "INVALID_PAYMENT_METHOD" } });

    const budget = await asAlice.put("/api/budgets").send({ categoryId: b.category.id, year: 2026, month: 10, amountAgorot: 1 });
    expect(budget.body).toMatchObject({ error: { code: "INVALID_CATEGORY" } });

    const own = (
      await asAlice.post("/api/transactions").send({ type: "EXPENSE", amountAgorot: 100, categoryId: categoryA.id, transactionDate: "2026-10-01" })
    ).body as TransactionDto;
    const moved = await asAlice.patch(`/api/transactions/${own.id}`).send({ categoryId: b.category.id });
    expect(moved.body).toMatchObject({ error: { code: "INVALID_CATEGORY" } });
  });

  it("ignores no client-supplied scoping: householdId/userId in body or query is rejected", async () => {
    const { alice, categoryA, householdB } = await setupTwoHouseholds();
    const hid = householdB.household.id;

    const queries = [
      `/api/transactions?householdId=${hid}`,
      `/api/categories?householdId=${hid}`,
      `/api/budgets?year=2026&month=10&householdId=${hid}`,
      `/api/payment-methods?householdId=${hid}`,
    ];
    for (const path of queries) {
      const res = await ctx.as(alice).get(path);
      expect(res.status, path).toBe(400);
    }

    const bodies = [
      ctx.as(alice).post("/api/transactions").send({
        type: "EXPENSE",
        amountAgorot: 100,
        categoryId: categoryA.id,
        transactionDate: "2026-10-01",
        householdId: hid,
      }),
      ctx.as(alice).post("/api/categories").send({ name: "X", householdId: hid }),
      ctx.as(alice).put("/api/budgets").send({ categoryId: categoryA.id, year: 2026, month: 10, amountAgorot: 1, householdId: hid }),
      ctx.as(alice).post("/api/transactions").send({
        type: "EXPENSE",
        amountAgorot: 100,
        categoryId: categoryA.id,
        transactionDate: "2026-10-01",
        createdByUserId: "00000000-0000-4000-8000-000000000000",
      }),
    ];
    for (const res of await Promise.all(bodies)) {
      expect(res.status).toBe(400);
    }
    expect(await getPrisma().transaction.count({ where: { householdId: hid } })).toBe(1);
    expect(await getPrisma().category.count({ where: { householdId: hid } })).toBe(1);
  });

  it("a user with no household cannot reach any household resource", async () => {
    const { carol, b } = await setupTwoHouseholds();
    const as = ctx.as(carol);
    const attempts = [
      as.get("/api/households/current"),
      as.get("/api/households/members"),
      as.get("/api/households/invitations"),
      as.get("/api/transactions"),
      as.get(`/api/transactions/${b.transaction.id}`),
      as.patch(`/api/transactions/${b.transaction.id}`).send({ amountAgorot: 1 }),
      as.delete(`/api/transactions/${b.transaction.id}`),
      as.get("/api/categories"),
      as.patch(`/api/categories/${b.category.id}`).send({ name: "x" }),
      as.get("/api/budgets?year=2026&month=10"),
      as.delete(`/api/budgets/${b.budget.id}`),
      as.get("/api/payment-methods"),
      as.delete(`/api/households/invitations/${b.invitation.id}`),
      as.delete(`/api/households/members/${b.ownerMember.id}`),
    ];
    for (const [index, res] of (await Promise.all(attempts)).entries()) {
      expect(res.status, `attempt #${index}`).toBe(403);
    }
    // ...and cannot accept an invitation addressed to someone else.
    const accept = await as.post(`/api/households/invitations/${b.invitation.id}/accept`);
    expect(accept.status).toBe(404);
  });
});
