import { describe, expect, it } from "vitest";

import type { SubCategoryDto, TransactionDto } from "../../../shared/api.js";
import { getPrisma } from "../../src/db/prisma.js";
import { addMember, createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext, type TestUser } from "../helpers/testApp.js";

const ctx = createTestContext();

async function setup() {
  const owner = ctx.user("owner");
  const admin = ctx.user("admin");
  const member = ctx.user("member");
  await createHousehold(ctx, owner);
  await addMember(ctx, owner, admin, "ADMIN");
  await addMember(ctx, owner, member, "MEMBER");
  const food = await createCategory(ctx, owner, "Food");
  const fun = await createCategory(ctx, owner, "Fun");
  return { owner, admin, member, food, fun };
}

async function createSub(user: TestUser, categoryId: string, name: string): Promise<SubCategoryDto> {
  const res = await ctx.as(user).post("/api/subcategories").send({ categoryId, name });
  expect(res.status).toBe(201);
  return res.body as SubCategoryDto;
}

const patchSub = (user: TestUser, id: string, body: Record<string, unknown>) =>
  ctx.as(user).patch(`/api/subcategories/${id}`).send(body);

const listSubs = async (user: TestUser, categoryId: string, includeInactive = false) =>
  (await ctx.as(user).get(`/api/subcategories?categoryId=${categoryId}${includeInactive ? "&includeInactive=true" : ""}`))
    .body as SubCategoryDto[];

function expense(categoryId: string, subCategoryId: string | null, overrides: Record<string, unknown> = {}) {
  return { type: "EXPENSE", amountAgorot: 1000, categoryId, subCategoryId, transactionDate: "2026-10-15", ...overrides };
}

describe("subcategory management", () => {
  it("creates subcategories as active", async () => {
    const { owner, food } = await setup();
    expect(await createSub(owner, food.id, "Bakery")).toMatchObject({ name: "Bakery", isActive: true });
  });

  it("renames, deactivates and reactivates, keeping the id and parent category", async () => {
    const { owner, admin, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");

    const renamed = await patchSub(owner, bakery.id, { name: "  Bread " });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ id: bakery.id, categoryId: food.id, name: "Bread", isActive: true });

    const deactivated = await patchSub(admin, bakery.id, { isActive: false });
    expect(deactivated.body).toMatchObject({ id: bakery.id, categoryId: food.id, isActive: false });

    // Inactive ones are listed only on request (for management).
    expect(await listSubs(owner, food.id)).toEqual([]);
    expect((await listSubs(owner, food.id, true)).map((s) => [s.name, s.isActive])).toEqual([["Bread", false]]);

    const reactivated = await patchSub(owner, bakery.id, { isActive: true });
    expect(reactivated.body).toMatchObject({ id: bakery.id, isActive: true });
  });

  it("rejects duplicate names within a category, including inactive ones", async () => {
    const { owner, food, fun } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const dairy = await createSub(owner, food.id, "Dairy");
    await patchSub(owner, bakery.id, { isActive: false });

    const res = await patchSub(owner, dairy.id, { name: "Bakery" });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "SUBCATEGORY_NAME_TAKEN" } });

    // The same name under another category is fine.
    const other = await createSub(owner, fun.id, "Other");
    expect((await patchSub(owner, other.id, { name: "Dairy" })).status).toBe(200);
  });

  it("validates the update", async () => {
    const { owner, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    for (const body of [{}, { name: "  " }, { isActive: "no" }, { categoryId: food.id }, { name: "x".repeat(61) }]) {
      const res = await patchSub(owner, bakery.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }
    expect((await patchSub(owner, "00000000-0000-4000-8000-000000000000", { name: "X" })).status).toBe(404);
  });

  it("MEMBER can read but not rename or (de)activate", async () => {
    const { owner, member, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");

    expect((await listSubs(member, food.id)).map((s) => s.name)).toEqual(["Bakery"]);
    for (const body of [{ name: "Mine" }, { isActive: false }]) {
      const res = await patchSub(member, bakery.id, body);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "INSUFFICIENT_ROLE" } });
    }
    expect(await getPrisma().subCategory.findUniqueOrThrow({ where: { id: bakery.id } })).toMatchObject({
      name: "Bakery",
      isActive: true,
    });
  });

  it("cannot read or change another household's subcategories", async () => {
    const { owner, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const outsider = ctx.user("outsider");
    await createHousehold(ctx, outsider, "Other home");

    const update = await patchSub(outsider, bakery.id, { name: "pwned", isActive: false });
    expect(update.status).toBe(404);
    const list = await ctx.as(outsider).get(`/api/subcategories?categoryId=${food.id}&includeInactive=true`);
    expect(list.status).toBe(404);
    expect(await getPrisma().subCategory.findUniqueOrThrow({ where: { id: bakery.id } })).toMatchObject({
      name: "Bakery",
      isActive: true,
    });
  });
});

describe("transactions with inactive subcategories", () => {
  it("keeps existing transactions and their associations when deactivating", async () => {
    const { owner, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const tx = (await ctx.as(owner).post("/api/transactions").send(expense(food.id, bakery.id))).body as TransactionDto;

    await patchSub(owner, bakery.id, { isActive: false });

    const read = await ctx.as(owner).get(`/api/transactions/${tx.id}`);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ id: tx.id, categoryId: food.id, subCategoryId: bakery.id });
  });

  it("rejects newly selecting an inactive subcategory, on create and on edit", async () => {
    const { owner, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const plain = (await ctx.as(owner).post("/api/transactions").send(expense(food.id, null))).body as TransactionDto;
    await patchSub(owner, bakery.id, { isActive: false });

    const created = await ctx.as(owner).post("/api/transactions").send(expense(food.id, bakery.id));
    expect(created.status).toBe(400);
    expect(created.body).toMatchObject({ error: { code: "SUBCATEGORY_INACTIVE" } });

    const edited = await ctx.as(owner).patch(`/api/transactions/${plain.id}`).send({ subCategoryId: bakery.id });
    expect(edited.status).toBe(400);
    expect(edited.body).toMatchObject({ error: { code: "SUBCATEGORY_INACTIVE" } });
  });

  it("allows editing a transaction that keeps its inactive subcategory", async () => {
    const { owner, food } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const tx = (await ctx.as(owner).post("/api/transactions").send(expense(food.id, bakery.id))).body as TransactionDto;
    await patchSub(owner, bakery.id, { isActive: false });

    const implicit = await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send({ description: "still fine" });
    expect(implicit.status).toBe(200);
    expect(implicit.body).toMatchObject({ subCategoryId: bakery.id });

    // Sending the unchanged selection back, as a full form would, is also allowed.
    const explicit = await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send(expense(food.id, bakery.id));
    expect(explicit.status).toBe(200);
    expect(explicit.body).toMatchObject({ subCategoryId: bakery.id });
  });

  it("still clears the old subcategory when the category changes without a replacement", async () => {
    const { owner, food, fun } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const tx = (await ctx.as(owner).post("/api/transactions").send(expense(food.id, bakery.id))).body as TransactionDto;
    await patchSub(owner, bakery.id, { isActive: false });

    const moved = await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send({ categoryId: fun.id });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ categoryId: fun.id, subCategoryId: null });
  });

  it("still rejects a subcategory from another category", async () => {
    const { owner, food, fun } = await setup();
    const bakery = await createSub(owner, food.id, "Bakery");
    const res = await ctx.as(owner).post("/api/transactions").send(expense(fun.id, bakery.id));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "SUBCATEGORY_CATEGORY_MISMATCH" } });
  });
});
