import { describe, expect, it } from "vitest";

import { dateOnlyToDate, dateToDateOnly, isValidDateOnly, monthRange, yearRange } from "../../src/utils/dates.js";

describe("isValidDateOnly", () => {
  it.each(["2026-10-01", "2024-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidDateOnly(value)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-01", "01/10/2026", "2026-10-01T00:00:00Z", ""])(
    "rejects %s",
    (value) => {
      expect(isValidDateOnly(value)).toBe(false);
    },
  );
});

describe("date-only conversion", () => {
  it("round-trips without time-zone drift", () => {
    expect(dateToDateOnly(dateOnlyToDate("2026-10-01"))).toBe("2026-10-01");
    expect(dateToDateOnly(dateOnlyToDate("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("monthRange", () => {
  it("covers exactly one month as a half-open range", () => {
    const range = monthRange(2026, 10);
    expect(range.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("rolls over December into the next year", () => {
    expect(monthRange(2026, 12).lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("year range spans the calendar year", () => {
    const range = yearRange(2026);
    expect(range.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
