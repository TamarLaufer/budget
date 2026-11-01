import { describe, expect, it, vi } from "vitest";

import { thresholdReached } from "../../src/services/budgetAlertService.js";
import { createExpoPushSender } from "../../src/services/push/expoPushSender.js";
import { currentPeriod } from "../../src/utils/dates.js";

describe("thresholdReached", () => {
  it.each([
    [200_000, 0, null],
    [200_000, 159_999, null],
    [200_000, 160_000, 80],
    [200_000, 199_999, 80],
    [200_000, 200_000, 100],
    [200_000, 500_000, 100],
    // Agorot precision: 80% of ₪0.07 is 5.6 agorot, so 5 is below and 6 reaches it.
    [7, 5, null],
    [7, 6, 80],
  ])("budget %i, spent %i → %s", (budget, spent, expected) => {
    expect(thresholdReached(budget, spent)).toBe(expected);
  });

  it.each([0, -100, Number.NaN, 1.5])("never alerts for an invalid budget (%s)", (budget) => {
    expect(thresholdReached(budget, 1_000_000)).toBeNull();
  });
});

describe("currentPeriod", () => {
  // Israel is UTC+2 after DST ends (Oct 25, 2026) and in December.
  it("uses the Israel calendar month", () => {
    expect(currentPeriod(new Date("2026-10-31T22:30:00Z"))).toEqual({ year: 2026, month: 11 });
    expect(currentPeriod(new Date("2026-10-31T21:30:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(currentPeriod(new Date("2026-12-31T22:30:00Z"))).toEqual({ year: 2027, month: 1 });
  });
});

describe("Expo push sender", () => {
  const message = (to: string) => ({ to, title: "t", body: "b", data: {} });

  it("posts batches of at most 100 with the Android channel and maps tickets", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const batch = JSON.parse(init?.body as string) as { to: string; channelId: string; priority: string }[];
      expect(batch.length).toBeLessThanOrEqual(100);
      expect(batch[0]).toMatchObject({ channelId: "budget-alerts", priority: "high" });
      return Promise.resolve(Response.json({
        data: batch.map((m) =>
          m.to === "dead"
            ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
            : { status: "ok", id: "x" },
        ),
      }));
    });
    const sender = createExpoPushSender({ fetchImpl, accessToken: "secret" });
    const messages = [...Array.from({ length: 150 }, (_, i) => message(`t${i}`)), message("dead")];

    const results = await sender.send(messages);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(results).toHaveLength(151);
    expect(results.at(-1)).toEqual({ ok: false, deviceNotRegistered: true, message: "gone" });
    expect(results.slice(0, 150).every((r) => r.ok)).toBe(true);
  });

  it("throws when the push service answers with an HTTP error", async () => {
    const sender = createExpoPushSender({ fetchImpl: () => Promise.resolve(new Response("down", { status: 503 })) });
    await expect(sender.send([message("a")])).rejects.toThrow("503");
  });
});
