import type { CategoryDto, MeDto, MonthlyBudgetDto, TransactionDto } from "../../shared/api";

let counter = 0;
const nextId = () => `id-${++counter}`;

export function makeTransaction(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: nextId(),
    type: "EXPENSE",
    amountAgorot: 1000,
    categoryId: "food",
    description: null,
    transactionDate: "2026-10-10",
    paymentMethodId: null,
    incomeSource: null,
    createdBy: { id: "user-a", email: "a@example.com", displayName: "A" },
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: nextId(),
    name: "Food",
    isActive: true,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, "0")}.000Z`,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeBudget(overrides: Partial<MonthlyBudgetDto> = {}): MonthlyBudgetDto {
  return { id: nextId(), categoryId: "food", year: 2026, month: 10, amountAgorot: 100_000, ...overrides };
}

export const meWithHousehold: MeDto = {
  user: { id: "user-a", email: "a@example.com", displayName: "A" },
  membership: { household: { id: "h1", name: "Home", createdAt: "2026-01-01T00:00:00.000Z" }, role: "OWNER" },
};

/** Builds a fulfilled/rejected action the way createAsyncThunk would, for reducer tests. */
export function fulfilled<P, A>(thunk: { fulfilled: { type: string } }, payload: P, arg: A) {
  return { type: thunk.fulfilled.type, payload, meta: { arg, requestId: "r", requestStatus: "fulfilled" as const } };
}
