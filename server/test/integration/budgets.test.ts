import { describe, expect, it } from "vitest";

import type { MonthlyBudgetDto } from "../../../shared/api.js";
import { addMember, createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext, type TestUser } from "../helpers/testApp.js";

const ctx = createTestContext();

async function setup() {
  const owner = ctx.user("owner");
  await createHousehold(ctx, owner);
  const food = await createCategory(ctx, owner, "Food");
  return { owner, food };
}

const put = (user: TestUser, body: Record<string, unknown>) => ctx.as(user).put("/api/budgets").send(body);
const listMonth = async (user: TestUser, year: number, month: number) =>
  (await ctx.as(user).get(`/api/budgets?year=${year}&month=${month}`)).body as MonthlyBudgetDto[];

describe("monthly budgets", () => {
  it("sets a budget for a category and month", async () => {
    const { owner, food } = await setup();
    const res = await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 350_000 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ categoryId: food.id, year: 2026, month: 10, amountAgorot: 350_000 });
    expect(await listMonth(owner, 2026, 10)).toEqual([res.body]);
  });

  it("changing October does not modify September", async () => {
    const { owner, food } = await setup();
    await put(owner, { categoryId: food.id, year: 2026, month: 9, amountAgorot: 300_000 });
    const oct = (await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 350_000 }))
      .body as MonthlyBudgetDto;

    const again = await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 400_000 });
    expect((again.body as MonthlyBudgetDto).id).toBe(oct.id);
    await ctx.as(owner).patch(`/api/budgets/${oct.id}`).send({ amountAgorot: 420_000 });

    expect((await listMonth(owner, 2026, 9)).map((b) => b.amountAgorot)).toEqual([300_000]);
    expect((await listMonth(owner, 2026, 10)).map((b) => b.amountAgorot)).toEqual([420_000]);
    expect(await listMonth(owner, 2026, 11)).toEqual([]);
  });

  it("deletes a budget", async () => {
    const { owner, food } = await setup();
    const b = (await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 1 })).body as MonthlyBudgetDto;
    expect((await ctx.as(owner).delete(`/api/budgets/${b.id}`)).status).toBe(204);
    expect((await ctx.as(owner).delete(`/api/budgets/${b.id}`)).status).toBe(404);
  });

  it.each([
    ["a negative amount", { amountAgorot: -1 }],
    ["a fractional amount", { amountAgorot: 10.5 }],
    ["month 13", { month: 13 }],
    ["month 0", { month: 0 }],
    ["an implausible year", { year: 1900 }],
    ["an extra householdId", { householdId: "00000000-0000-4000-8000-000000000000" }],
  ])("rejects %s", async (_label, override) => {
    const { owner, food } = await setup();
    const res = await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 100, ...override });
    expect(res.status).toBe(400);
  });

  it("rejects unknown and inactive categories", async () => {
    const { owner, food } = await setup();
    const unknown = await put(owner, {
      categoryId: "00000000-0000-4000-8000-000000000000",
      year: 2026,
      month: 10,
      amountAgorot: 100,
    });
    expect(unknown.body).toMatchObject({ error: { code: "INVALID_CATEGORY" } });

    await ctx.as(owner).patch(`/api/categories/${food.id}`).send({ isActive: false });
    const inactive = await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 100 });
    expect(inactive.body).toMatchObject({ error: { code: "CATEGORY_INACTIVE" } });
  });

  it("requires year and month to list", async () => {
    const { owner } = await setup();
    expect((await ctx.as(owner).get("/api/budgets")).status).toBe(400);
    expect((await ctx.as(owner).get("/api/budgets?year=2026")).status).toBe(400);
  });

  it("MEMBER can read budgets but not change them", async () => {
    const { owner, food } = await setup();
    const member = ctx.user("member");
    await addMember(ctx, owner, member);
    const b = (await put(owner, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 100 })).body as MonthlyBudgetDto;

    expect(await listMonth(member, 2026, 10)).toHaveLength(1);
    expect((await put(member, { categoryId: food.id, year: 2026, month: 10, amountAgorot: 5 })).status).toBe(403);
    expect((await ctx.as(member).patch(`/api/budgets/${b.id}`).send({ amountAgorot: 5 })).status).toBe(403);
    expect((await ctx.as(member).delete(`/api/budgets/${b.id}`)).status).toBe(403);
  });
});
