import { describe, expect, it } from "vitest";

import type { CategoryDto, MeDto, MemberDto, TransactionDto } from "../../../shared/api.js";
import { getPrisma } from "../../src/db/prisma.js";
import { addMember, createCategory, createHousehold } from "../helpers/scenarios.js";
import { createTestContext, type TestUser } from "../helpers/testApp.js";

const ctx = createTestContext();

const TITLE_80 = "מתקרבים לתקציב";
const TITLE_100 = "התקציב נוצל";
/** ₪2,000 */
const BUDGET = 200_000;

const tokenOf = (name: string) => `ExponentPushToken[${name}]`;

/** Opts the user in and registers one device per token name. */
async function enableAlerts(user: TestUser, ...devices: string[]) {
  expect(
    (await ctx.as(user).put("/api/notifications/preferences").send({ budgetAlertsEnabled: true })).status,
  ).toBe(200);
  for (const device of devices) {
    const res = await ctx.as(user).put("/api/notifications/devices").send({ token: tokenOf(device), platform: "android" });
    expect(res.status).toBe(204);
  }
}

async function setBudget(user: TestUser, category: CategoryDto, amountAgorot = BUDGET, year = 2026, month = 10) {
  const res = await ctx.as(user).put("/api/budgets").send({ categoryId: category.id, year, month, amountAgorot });
  expect(res.status).toBe(200);
}

async function spend(user: TestUser, category: CategoryDto, amountAgorot: number, transactionDate = "2026-10-10") {
  const res = await ctx
    .as(user)
    .post("/api/transactions")
    .send({ type: "EXPENSE", amountAgorot, categoryId: category.id, transactionDate, description: "Secret note" });
  expect(res.status).toBe(201);
  return res.body as TransactionDto;
}

/** Owner with alerts on, one device, a "Food" category with a ₪2,000 October budget. */
async function setup() {
  const owner = ctx.user("owner");
  await createHousehold(ctx, owner);
  const food = await createCategory(ctx, owner, "מזון");
  await setBudget(owner, food);
  await enableAlerts(owner, "owner-phone");
  return { owner, food };
}

const titles = () => ctx.push.sent.map((m) => m.title);

describe("budget alerts: thresholds", () => {
  it("sends nothing below 80%", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 159_999);
    expect(ctx.push.sent).toEqual([]);
  });

  it("sends one 80% alert when crossing 80%, with no amounts or descriptions in the payload", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 150_000);
    await spend(owner, food, 15_000); // ₪1,650 = 82.5%

    expect(ctx.push.sent).toEqual([
      {
        to: tokenOf("owner-phone"),
        title: TITLE_80,
        body: 'ניצלתם 80% מתקציב "מזון" החודשי.',
        data: { type: "budget-alert", year: 2026, month: 10, categoryId: food.id },
      },
    ]);
    expect(JSON.stringify(ctx.push.sent)).not.toMatch(/Secret|1650|165000/);
  });

  it("follows the ₪2,000 example: 80% once, then 100% once, never repeated", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 165_000); // ₪1,650 → 80%
    await spend(owner, food, 5_000); // ₪1,700 → still 80%: no duplicate
    expect(titles()).toEqual([TITLE_80]);

    await spend(owner, food, 35_000); // ₪2,050 → 100%
    expect(titles()).toEqual([TITLE_80, TITLE_100]);
    expect(ctx.push.sent[1]?.body).toBe('ניצלתם את מלוא תקציב "מזון" החודשי.');

    await spend(owner, food, 10_000); // more spending: no repeat
    expect(titles()).toEqual([TITLE_80, TITLE_100]);
  });

  it("counts exactly 80% and exactly 100% as reached", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 160_000);
    await spend(owner, food, 40_000);
    expect(titles()).toEqual([TITLE_80, TITLE_100]);
  });

  it("sends only the 100% alert when jumping from below 80% to over 100%", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 50_000);
    await spend(owner, food, 200_000);
    expect(titles()).toEqual([TITLE_100]);
    // 80% was recorded too, so it can never fire later this month.
    const rows = await getPrisma().budgetAlert.findMany({ orderBy: { threshold: "asc" } });
    expect(rows.map((r) => r.threshold)).toEqual([80, 100]);
  });

  it("does not duplicate alerts when several expenses are saved concurrently", async () => {
    const { owner, food } = await setup();
    // 12 × ₪200 = ₪2,400: crosses both thresholds while requests race.
    await Promise.all(Array.from({ length: 12 }, () => spend(owner, food, 20_000)));

    const t = titles();
    expect(t.filter((x) => x === TITLE_100)).toHaveLength(1);
    expect(t.filter((x) => x === TITLE_80).length).toBeLessThanOrEqual(1);
    expect(await getPrisma().budgetAlert.count()).toBe(2);
  });

  it("ignores income", async () => {
    const { owner, food } = await setup();
    await ctx
      .as(owner)
      .post("/api/transactions")
      .send({ type: "INCOME", amountAgorot: 500_000, categoryId: food.id, transactionDate: "2026-10-10" });
    expect(ctx.push.sent).toEqual([]);
  });

  it("only uses expenses of the same category", async () => {
    const { owner, food } = await setup();
    const fun = await createCategory(ctx, owner, "בילויים");
    await spend(owner, fun, 300_000);
    await spend(owner, food, 100_000);
    expect(ctx.push.sent).toEqual([]);
  });
});

describe("budget alerts: months", () => {
  it("a new month has independent alert state", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 210_000);
    expect(titles()).toEqual([TITLE_100]);

    ctx.clock.now = new Date("2026-11-10T09:00:00.000Z");
    await setBudget(owner, food, BUDGET, 2026, 11);
    await spend(owner, food, 170_000, "2026-11-05");
    await spend(owner, food, 40_000, "2026-11-06");
    expect(titles()).toEqual([TITLE_100, TITLE_80, TITLE_100]);
    expect(ctx.push.sent[2]?.data).toMatchObject({ year: 2026, month: 11 });
  });

  it("only alerts for expenses dated in the current month", async () => {
    const { owner, food } = await setup();
    await setBudget(owner, food, BUDGET, 2026, 9);
    await spend(owner, food, 250_000, "2026-09-20"); // last month
    await setBudget(owner, food, BUDGET, 2026, 11);
    await spend(owner, food, 250_000, "2026-11-02"); // next month
    expect(ctx.push.sent).toEqual([]);
  });

  it("uses the Israel calendar month, not the server's UTC month", async () => {
    const { owner, food } = await setup();
    // 23:30 UTC on Oct 31 is already Nov 1 in Israel.
    ctx.clock.now = new Date("2026-10-31T23:30:00.000Z");
    await setBudget(owner, food, BUDGET, 2026, 11);
    await spend(owner, food, 250_000, "2026-11-01");
    expect(titles()).toEqual([TITLE_100]);
  });
});

describe("budget alerts: edits and deletes", () => {
  it("evaluates an edited amount", async () => {
    const { owner, food } = await setup();
    const tx = await spend(owner, food, 100_000);
    expect(ctx.push.sent).toEqual([]);
    await ctx.as(owner).patch(`/api/transactions/${tx.id}`).send({ amountAgorot: 170_000 });
    expect(titles()).toEqual([TITLE_80]);
  });

  it("evaluates an expense moved into the category or into the current month", async () => {
    const { owner, food } = await setup();
    const other = await createCategory(ctx, owner, "אחר");
    const moved = await spend(owner, other, 170_000);
    await ctx.as(owner).patch(`/api/transactions/${moved.id}`).send({ categoryId: food.id });
    expect(titles()).toEqual([TITLE_80]);

    const old = await spend(owner, food, 40_000, "2026-09-30");
    expect(titles()).toEqual([TITLE_80]);
    await ctx.as(owner).patch(`/api/transactions/${old.id}`).send({ transactionDate: "2026-10-01" });
    expect(titles()).toEqual([TITLE_80, TITLE_100]);
  });

  it("evaluates an income changed into an expense", async () => {
    const { owner, food } = await setup();
    const res = await ctx
      .as(owner)
      .post("/api/transactions")
      .send({ type: "INCOME", amountAgorot: 210_000, transactionDate: "2026-10-10" });
    await ctx.as(owner).patch(`/api/transactions/${(res.body as TransactionDto).id}`).send({ type: "EXPENSE", categoryId: food.id });
    expect(titles()).toEqual([TITLE_100]);
  });

  it("recalculates after a delete and does not re-arm a threshold within the month", async () => {
    const { owner, food } = await setup();
    const big = await spend(owner, food, 170_000);
    expect(titles()).toEqual([TITLE_80]);

    expect((await ctx.as(owner).delete(`/api/transactions/${big.id}`)).status).toBe(204);
    await spend(owner, food, 100_000); // 50% after the delete: nothing
    await spend(owner, food, 70_000); // back to 85%: 80% already sent this month
    expect(titles()).toEqual([TITLE_80]);

    await spend(owner, food, 30_000); // exactly 100% of the remaining real spending
    expect(titles()).toEqual([TITLE_80, TITLE_100]);
  });

  it("budget edits do not trigger alerts", async () => {
    const { owner, food } = await setup();
    await spend(owner, food, 150_000);
    await setBudget(owner, food, 100_000);
    expect(ctx.push.sent).toEqual([]);
  });
});

describe("budget alerts: recipients", () => {
  async function withPartner() {
    const base = await setup();
    const partner = ctx.user("partner");
    await addMember(ctx, base.owner, partner);
    return { ...base, partner };
  }

  it("sends to every opted-in member's devices when another member adds the expense", async () => {
    const { food, partner } = await withPartner();
    await enableAlerts(partner, "partner-phone", "partner-tablet");
    await spend(partner, food, 170_000);

    expect(ctx.push.sent.map((m) => m.to).sort()).toEqual(
      [tokenOf("owner-phone"), tokenOf("partner-phone"), tokenOf("partner-tablet")].sort(),
    );
    expect(new Set(titles())).toEqual(new Set([TITLE_80]));
  });

  it("sends nothing to members who did not opt in, and nothing at all when everyone disabled", async () => {
    const { owner, food, partner } = await withPartner();
    // Partner registers a device but keeps the default (disabled).
    await ctx.as(partner).put("/api/notifications/devices").send({ token: tokenOf("partner-phone"), platform: "android" });
    await spend(partner, food, 170_000);
    expect(ctx.push.sent.map((m) => m.to)).toEqual([tokenOf("owner-phone")]);

    await ctx.as(owner).put("/api/notifications/preferences").send({ budgetAlertsEnabled: false });
    await spend(partner, food, 40_000);
    expect(ctx.push.sent).toHaveLength(1);
  });

  it("defaults to disabled and reports the preference on /auth/me", async () => {
    const user = ctx.user("fresh");
    const me = (await ctx.as(user).get("/api/auth/me")).body as MeDto;
    expect(me.notifications).toEqual({ budgetAlertsEnabled: false });
    await ctx.as(user).put("/api/notifications/preferences").send({ budgetAlertsEnabled: true });
    expect(((await ctx.as(user).get("/api/auth/me")).body as MeDto).notifications.budgetAlertsEnabled).toBe(true);
  });

  it("a member who left the household receives no further alerts from it", async () => {
    const { owner, food, partner } = await withPartner();
    await enableAlerts(partner, "partner-phone");

    const members = (await ctx.as(partner).get("/api/households/members")).body as MemberDto[];
    const mine = members.find((m) => m.user.email === "partner@example.com");
    expect((await ctx.as(partner).delete(`/api/households/members/${mine?.id}`)).status).toBe(204);

    await spend(owner, food, 210_000);
    expect(ctx.push.sent.map((m) => m.to)).toEqual([tokenOf("owner-phone")]);
  });

  it("sends nothing when the category has no budget or a zero budget", async () => {
    const { owner } = await setup();
    const noBudget = await createCategory(ctx, owner, "ללא תקציב");
    await spend(owner, noBudget, 500_000);
    const zero = await createCategory(ctx, owner, "אפס");
    await setBudget(owner, zero, 0);
    await spend(owner, zero, 500_000);
    expect(ctx.push.sent).toEqual([]);
  });
});

describe("budget alerts: devices and failures", () => {
  it("removes a device the push service reports as no longer registered", async () => {
    const { owner, food } = await setup();
    await enableAlerts(owner, "old-phone");
    ctx.push.respond = (m) =>
      m.to === tokenOf("old-phone")
        ? { ok: false, deviceNotRegistered: true, message: "not registered" }
        : { ok: true };

    await spend(owner, food, 170_000);
    expect(ctx.push.sent).toHaveLength(2);
    const tokens = (await getPrisma().pushDevice.findMany()).map((d) => d.expoPushToken);
    expect(tokens).toEqual([tokenOf("owner-phone")]);
  });

  it("keeps a device on other per-message errors", async () => {
    const { owner, food } = await setup();
    ctx.push.respond = () => ({ ok: false, deviceNotRegistered: false, message: "MessageRateExceeded" });
    expect((await spend(owner, food, 170_000)).id).toBeDefined();
    expect(await getPrisma().pushDevice.count()).toBe(1);
  });

  it("rejects malformed push tokens", async () => {
    const owner = ctx.user("owner");
    const res = await ctx.as(owner).put("/api/notifications/devices").send({ token: "not-a-token", platform: "android" });
    expect(res.status).toBe(400);
  });

  it("saves the transaction when the push service fails", async () => {
    const { owner, food } = await setup();
    ctx.push.fail = new Error("Expo is down");
    const tx = await spend(owner, food, 210_000);
    expect((await ctx.as(owner).get(`/api/transactions/${tx.id}`)).status).toBe(200);
    // The threshold was claimed before the failed send, so it is not retried (no duplicate later).
    ctx.push.fail = null;
    await spend(owner, food, 1_000);
    expect(ctx.push.sent).toEqual([]);
  });

  it("bounds the extra save latency when the push service is slow", async () => {
    const { owner, food } = await setup();
    ctx.push.delayMs = 4_500;
    const started = Date.now();
    await spend(owner, food, 210_000);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(4_000); // 3 s deadline + request overhead
    // The alert still completes in the background.
    await expect.poll(() => ctx.push.sent.length, { timeout: 5_000, interval: 100 }).toBe(1);
  });

  it("moves a token to the account that registered it last, and only lets the owner unregister it", async () => {
    const { owner } = await setup();
    const other = ctx.user("other");
    await ctx.as(other).put("/api/notifications/devices").send({ token: tokenOf("owner-phone"), platform: "android" });
    const device = await getPrisma().pushDevice.findUniqueOrThrow({
      where: { expoPushToken: tokenOf("owner-phone") },
      include: { user: true },
    });
    expect(device.user.email).toBe("other@example.com");

    await ctx.as(owner).delete("/api/notifications/devices").send({ token: tokenOf("owner-phone") });
    expect(await getPrisma().pushDevice.count()).toBe(1);
    await ctx.as(other).delete("/api/notifications/devices").send({ token: tokenOf("owner-phone") });
    expect(await getPrisma().pushDevice.count()).toBe(0);
  });
});
