/** A calendar month. `month` is 1-12, matching the API (unlike Date.getMonth()). */
export interface Period {
  year: number;
  month: number;
}

export function periodOf(date: Date): Period {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function shiftPeriod({ year, month }: Period, delta: number): Period {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "2026-10": the prefix every "YYYY-MM-DD" transaction date of that month starts with. */
export function periodKey({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isDateInPeriod(dateOnly: string, period: Period): boolean {
  return dateOnly.startsWith(`${periodKey(period)}-`);
}

/** The user's local calendar date as "YYYY-MM-DD". */
export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as a local date (no UTC shift). */
export function fromDateOnly(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function periodToDate({ year, month }: Period): Date {
  return new Date(year, month - 1, 1);
}
