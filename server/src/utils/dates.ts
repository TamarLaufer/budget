/**
 * Transaction dates are calendar dates ("YYYY-MM-DD") stored in a PostgreSQL DATE column.
 * Prisma maps DATE to a JS Date at UTC midnight, so all conversions here are done in UTC
 * to avoid off-by-one-day bugs from the server's local time zone.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateToDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Half-open range [gte, lt) covering a calendar month (month is 1-12). */
export function monthRange(year: number, month: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

export function yearRange(year: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
}
