import { describe, expect, it } from "vitest";

import type { CategoryDto, PaymentMethodDto } from "../../../shared/api.js";
import { addMember, createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext } from "../helpers/testApp.js";

const ctx = createTestContext();

async function setup() {
  const owner = ctx.user("owner");
  const member = ctx.user("member");
  await createHousehold(ctx, owner);
  await addMember(ctx, owner, member, "MEMBER");
  return { owner, member };
}

describe("categories", () => {
  it("creates, renames and deactivates categories", async () => {
    const { owner } = await setup();
    const food = await createCategory(ctx, owner, "  Food ");
    expect(food).toMatchObject({ name: "Food", isActive: true });

    const renamed = await ctx.as(owner).patch(`/api/categories/${food.id}`).send({ name: "Groceries" });
    expect(renamed.body).toMatchObject({ id: food.id, name: "Groceries" });

    const deactivated = await ctx.as(owner).patch(`/api/categories/${food.id}`).send({ isActive: false });
    expect((deactivated.body as CategoryDto).isActive).toBe(false);

    expect((await ctx.as(owner).get("/api/categories")).body).toEqual([]);
    const all = (await ctx.as(owner).get("/api/categories?includeInactive=true")).body as CategoryDto[];
    expect(all.map((c) => [c.name, c.isActive])).toEqual([["Groceries", false]]);

    const reactivated = await ctx.as(owner).patch(`/api/categories/${food.id}`).send({ isActive: true });
    expect((reactivated.body as CategoryDto).isActive).toBe(true);
  });

  it("rejects duplicate names within a household", async () => {
    const { owner } = await setup();
    await createCategory(ctx, owner, "Food");
    const other = await createCategory(ctx, owner, "Fun");

    const dup = await ctx.as(owner).post("/api/categories").send({ name: "Food" });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ error: { code: "CATEGORY_NAME_TAKEN" } });
    expect((await ctx.as(owner).patch(`/api/categories/${other.id}`).send({ name: "Food" })).status).toBe(409);
  });

  it("allows the same name in different households", async () => {
    await setup();
    const stranger = ctx.user("stranger");
    await createHousehold(ctx, stranger, "Other");
    expect((await ctx.as(stranger).post("/api/categories").send({ name: "Food" })).status).toBe(201);
  });

  it("validates input", async () => {
    const { owner } = await setup();
    const food = await createCategory(ctx, owner, "Food");
    expect((await ctx.as(owner).post("/api/categories").send({ name: "" })).status).toBe(400);
    expect((await ctx.as(owner).patch(`/api/categories/${food.id}`).send({})).status).toBe(400);
    expect((await ctx.as(owner).patch("/api/categories/not-a-uuid").send({ name: "x" })).status).toBe(400);
    expect((await ctx.as(owner).patch("/api/categories/00000000-0000-4000-8000-000000000000").send({ name: "x" })).status).toBe(404);
  });

  it("MEMBER can read but not manage categories", async () => {
    const { owner, member } = await setup();
    const food = await createCategory(ctx, owner, "Food");
    expect((await ctx.as(member).get("/api/categories")).status).toBe(200);
    expect((await ctx.as(member).post("/api/categories").send({ name: "Mine" })).status).toBe(403);
    expect((await ctx.as(member).patch(`/api/categories/${food.id}`).send({ isActive: false })).status).toBe(403);
  });
});

describe("payment methods", () => {
  it("creates, lists and deactivates payment methods (managers only)", async () => {
    const { owner, member } = await setup();
    const created = await ctx.as(owner).post("/api/payment-methods").send({ name: "Visa" });
    expect(created.status).toBe(201);
    const visa = created.body as PaymentMethodDto;

    expect((await ctx.as(member).get("/api/payment-methods")).body).toEqual([visa]);
    expect((await ctx.as(member).post("/api/payment-methods").send({ name: "Cash" })).status).toBe(403);
    expect((await ctx.as(owner).post("/api/payment-methods").send({ name: "Visa" })).status).toBe(409);

    await ctx.as(owner).patch(`/api/payment-methods/${visa.id}`).send({ isActive: false });
    expect((await ctx.as(owner).get("/api/payment-methods")).body).toEqual([]);
  });
});
