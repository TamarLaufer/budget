import type { TransactionDto, TransactionType } from "../../shared/api";

export interface TransactionFilters {
  type: TransactionType | null;
  categoryId: string | null;
  query: string;
}

export const noFilters: TransactionFilters = { type: null, categoryId: null, query: "" };

/**
 * Client-side filtering of one month's transactions (already loaded in full), so changing a
 * filter is instant and needs no network. Text search matches description, income source and
 * category name, case-insensitively.
 */
export function filterTransactions(
  transactions: readonly TransactionDto[],
  filters: TransactionFilters,
  categoryNames: ReadonlyMap<string, string>,
): TransactionDto[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (!query) return true;
    const haystack = [t.description, t.incomeSource, t.categoryId ? categoryNames.get(t.categoryId) : null]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(query);
  });
}
