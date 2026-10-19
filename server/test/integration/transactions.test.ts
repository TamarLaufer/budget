import { describe, expect, it } from "vitest";

import type { CategoryDto, PaymentMethodDto, TransactionDto } from "../../../shared/api.js";
import { MAX_AMOUNT_AGOROT } from "../../../shared/limits.js";
import { getPrisma } from "../../src/db/prisma.js";
import { addMember, createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext, type TestUser } from "../helpers/testApp.js";

const ctx = createTestContext();

async function setup() {
  const owner = ctx.user("owner");
  await createHousehold(ctx, owner);
  const food = await createCategory(ctx, owner, "Food");
  const fun = await createCategory(ctx, owner, "Fun");
  return { owner, food, fun };
}

function expense(categoryId: string, overrides: Record<string, unknown> = {}) {
  return { type: "EXPENSE", amountAgorot: 8790, categoryId, transactionDate: "2026-10-15", ...overrides };
}

async function create(user: TestUser, body: Record<string, unknown>) {
  return ctx.as(user).post("/api/transactions").send(body);
}

describe("transaction CRUD", () => {
  it("creates, reads, updates and deletes an expense", async () => {
    const { owner, food, fun } = await setup();

    const created = await create(owner, expense(food.id, { description: "Groceries" }));
    expect(created.status).toBe(201);
    const tx = created.body as TransactionDto;
    expect(tx).toMatchObject({
      type: "EXPENSE",
      amountAgorot: 8790,
      categoryId: food.id,
      description: "Groceries",
      transactionDate: "2026-10-15",
      createdBy: { email: "owner@example.com" },
    });

    expect((await ctx.as(owner).get(`/api/transactions/${tx.id}`)).body).toEqual(tx);

    const updated = await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send({ amountAgorot: 12000, categoryId: fun.id });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: tx.id, amountAgorot: 12000, categoryId: fun.id, description: "Groceries" });

    expect((await ctx.as(owner).delete(`/api/transactions/${tx.id}`)).status).toBe(204);
    expect((await ctx.as(owner).get(`/api/transactions/${tx.id}`)).status).toBe(404);
  });

  it("records income with an optional category and income source", async () => {
    const { owner } = await setup();
    const res = await create(owner, {
      type: "INCOME",
      amountAgorot: 1_500_000,
      transactionDate: "2026-10-01",
      incomeSource: "Salary",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "INCOME", categoryId: null, incomeSource: "Salary" });
  });

  it("stores and returns amounts as exact integer agorot", async () => {
    const { owner, food } = await setup();
    const res = await create(owner, expense(food.id, { amountAgorot: 1 }));
    expect((res.body as TransactionDto).amountAgorot).toBe(1);
    const row = await getPrisma().transaction.findFirstOrThrow();
    expect(Number.isInteger(row.amountAgorot)).toBe(true);
  });

  it("records a payment method from the same household", async () => {
    const { owner, food } = await setup();
    const method = (await ctx.as(owner).post("/api/payment-methods").send({ name: "Visa" })).body as PaymentMethodDto;
    const res = await create(owner, expense(food.id, { paymentMethodId: method.id }));
    expect(res.status).toBe(201);
    expect((res.body as TransactionDto).paymentMethodId).toBe(method.id);
  });
});

describe("transaction validation", () => {
  it.each([
    ["a fractional amount", { amountAgorot: 87.9 }, "VALIDATION_ERROR"],
    ["a zero amount", { amountAgorot: 0 }, "VALIDATION_ERROR"],
    ["a negative amount", { amountAgorot: -500 }, "VALIDATION_ERROR"],
    ["an amount over the limit", { amountAgorot: MAX_AMOUNT_AGOROT + 1 }, "VALIDATION_ERROR"],
    ["a string amount", { amountAgorot: "87.90" }, "VALIDATION_ERROR"],
    ["an impossible date", { transactionDate: "2026-02-30" }, "VALIDATION_ERROR"],
    ["an expense without category", { categoryId: null }, "CATEGORY_REQUIRED"],
    ["an expense with an income source", { incomeSource: "Salary" }, "INCOME_SOURCE_NOT_ALLOWED"],
    ["an unknown category id", { categoryId: "00000000-0000-4000-8000-000000000000" }, "INVALID_CATEGORY"],
    ["a malformed category id", { categoryId: "food" }, "VALIDATION_ERROR"],
    ["an unknown payment method", { paymentMethodId: "00000000-0000-4000-8000-000000000000" }, "INVALID_PAYMENT_METHOD"],
  ])("rejects %s", async (_label, override, code) => {
    const { owner, food } = await setup();
    const res = await create(owner, expense(food.id, override));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code } });
    expect(await getPrisma().transaction.count()).toBe(0);
  });

  it("rejects new transactions in an inactive category but keeps existing ones editable", async () => {
    const { owner, food } = await setup();
    const tx = (await create(owner, expense(food.id))).body as TransactionDto;
    await ctx.as(owner).patch(`/api/categories/${food.id}`).send({ isActive: false });

    const res = await create(owner, expense(food.id));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "CATEGORY_INACTIVE" } });

    const edit = await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send({ description: "still fine" });
    expect(edit.status).toBe(200);
  });

  it("re-validates the merged record on update", async () => {
    const { owner } = await setup();
    const income = (await create(owner, { type: "INCOME", amountAgorot: 100, transactionDate: "2026-10-01" }))
      .body as TransactionDto;
    const res = await ctx.as(owner).patch(`/api/transactions/${income.id}`).send({ type: "EXPENSE" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "CATEGORY_REQUIRED" } });
  });
});

describe("transaction listing and filters", () => {
  async function seed() {
    const base = await setup();
    const { owner, food, fun } = base;
    await create(owner, expense(food.id, { transactionDate: "2026-09-30", amountAgorot: 100, description: "September bread" }));
    await create(owner, expense(food.id, { transactionDate: "2026-10-01", amountAgorot: 200, description: "October milk" }));
    await create(owner, expense(fun.id, { transactionDate: "2026-10-31", amountAgorot: 300, description: "Cinema" }));
    await create(owner, expense(fun.id, { transactionDate: "2026-11-01", amountAgorot: 400 }));
    await create(owner, { type: "INCOME", amountAgorot: 5000, transactionDate: "2026-10-10", incomeSource: "Salary" });
    return base;
  }

  const list = async (user: TestUser, query: string) =>
    (await ctx.as(user).get(`/api/transactions${query}`)).body as TransactionDto[];

  it("filters by month using exact calendar boundaries", async () => {
    const { owner } = await seed();
    const october = await list(owner, "?year=2026&month=10");
    expect(october.map((t) => t.transactionDate)).toEqual(["2026-10-31", "2026-10-10", "2026-10-01"]);
    expect((await list(owner, "?year=2026&month=9")).map((t) => t.amountAgorot)).toEqual([100]);
    expect(await list(owner, "?year=2026")).toHaveLength(5);
  });

  it("filters by category, type and text", async () => {
    const { owner, fun } = await seed();
    expect((await list(owner, `?categoryId=${fun.id}`)).map((t) => t.amountAgorot)).toEqual([400, 300]);
    expect((await list(owner, "?type=INCOME")).map((t) => t.incomeSource)).toEqual(["Salary"]);
    expect((await list(owner, "?q=MILK")).map((t) => t.description)).toEqual(["October milk"]);
    expect((await list(owner, "?q=salary")).map((t) => t.type)).toEqual(["INCOME"]);
  });

  it("rejects invalid filters", async () => {
    const { owner } = await setup();
    for (const query of ["?month=10", "?year=2026&month=0", "?type=TRANSFER", "?categoryId=abc", "?year=abc"]) {
      expect((await ctx.as(owner).get(`/api/transactions${query}`)).status).toBe(400);
    }
  });
});

describe("transaction permissions", () => {
  it("members create transactions but may only change their own; admins may change any", async () => {
    const { owner, food } = await setup();
    const member = ctx.user("member");
    const admin = ctx.user("admin");
    await addMember(ctx, owner, member, "MEMBER");
    await addMember(ctx, owner, admin, "ADMIN");

    const ownersTx = (await create(owner, expense(food.id))).body as TransactionDto;
    const membersRes = await create(member, expense(food.id));
    expect(membersRes.status).toBe(201);
    const membersTx = membersRes.body as TransactionDto;
    expect(membersTx.createdBy.email).toBe("member@example.com");

    const denied = await ctx.as(member).patch(`/api/transactions/${ownersTx.id}`).send({ amountAgorot: 1 });
    expect(denied.status).toBe(403);
    expect((await ctx.as(member).delete(`/api/transactions/${ownersTx.id}`)).status).toBe(403);

    expect((await ctx.as(member).patch(`/api/transactions/${membersTx.id}`).send({ amountAgorot: 1 })).status).toBe(200);
    expect((await ctx.as(admin).patch(`/api/transactions/${membersTx.id}`).send({ amountAgorot: 2 })).status).toBe(200);
    expect((await ctx.as(admin).delete(`/api/transactions/${ownersTx.id}`)).status).toBe(204);
  });

  it("shares transactions between all household members", async () => {
    const { owner, food } = await setup();
    const partner = ctx.user("partner");
    await addMember(ctx, owner, partner);
    await create(partner, expense(food.id, { amountAgorot: 5555 }));

    const seenByOwner = (await ctx.as(owner).get("/api/transactions?year=2026&month=10")).body as TransactionDto[];
    expect(seenByOwner.map((t) => [t.amountAgorot, t.createdBy.email])).toEqual([[5555, "partner@example.com"]]);
    const categories = (await ctx.as(partner).get("/api/categories")).body as CategoryDto[];
    expect(categories.map((c) => c.name)).toEqual(["Food", "Fun"]);
  });
});
