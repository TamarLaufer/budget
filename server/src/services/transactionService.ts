import type { TransactionDto } from "../../../shared/api.js";
import * as categoriesRepository from "../repositories/categoriesRepository.js";
import * as paymentMethodsRepository from "../repositories/paymentMethodsRepository.js";
import * as transactionsRepository from "../repositories/transactionsRepository.js";
import type { TransactionData, TransactionFilter } from "../repositories/transactionsRepository.js";
import type { AuthContext, HouseholdContext } from "../types/auth.js";
import { dateOnlyToDate, dateToDateOnly, monthRange, yearRange } from "../utils/dates.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { toTransactionDto } from "../utils/serializers.js";
import type { CreateTransactionInput, UpdateTransactionInput } from "../validators/resourceValidators.js";
import { MANAGER_ROLES } from "../middleware/requireHousehold.js";

const transactionNotFound = () => notFound("TRANSACTION_NOT_FOUND", "Transaction was not found");

export async function list(
  ctx: HouseholdContext,
  query: { year?: number; month?: number; categoryId?: string; type?: "EXPENSE" | "INCOME"; q?: string },
): Promise<TransactionDto[]> {
  const filter: TransactionFilter = {};
  if (query.year !== undefined) {
    filter.dateRange = query.month !== undefined ? monthRange(query.year, query.month) : yearRange(query.year);
  }
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.type) filter.type = query.type;
  if (query.q) filter.search = query.q;
  return (await transactionsRepository.list(ctx.householdId, filter)).map(toTransactionDto);
}

export async function get(ctx: HouseholdContext, transactionId: string): Promise<TransactionDto> {
  const transaction = await transactionsRepository.findInHousehold(ctx.householdId, transactionId);
  if (!transaction) throw transactionNotFound();
  return toTransactionDto(transaction);
}

/**
 * Business rules shared by create and update:
 * - EXPENSE requires a category; incomeSource only applies to INCOME.
 * - Referenced category / payment method must belong to the caller's household.
 * - Newly chosen categories / payment methods must be active (an edit may keep an inactive one).
 */
async function validateReferences(
  ctx: HouseholdContext,
  data: TransactionData,
  previous?: { categoryId: string | null; paymentMethodId: string | null },
): Promise<void> {
  if (data.type === "EXPENSE" && !data.categoryId) {
    throw badRequest("CATEGORY_REQUIRED", "Expenses require a category");
  }
  if (data.type === "EXPENSE" && data.incomeSource) {
    throw badRequest("INCOME_SOURCE_NOT_ALLOWED", "Income source applies to income only");
  }

  if (data.categoryId) {
    const category = await categoriesRepository.findInHousehold(ctx.householdId, data.categoryId);
    if (!category) throw badRequest("INVALID_CATEGORY", "Category does not exist in this household");
    if (!category.isActive && category.id !== previous?.categoryId) {
      throw badRequest("CATEGORY_INACTIVE", "Category is inactive");
    }
  }

  if (data.paymentMethodId) {
    const method = await paymentMethodsRepository.findInHousehold(ctx.householdId, data.paymentMethodId);
    if (!method) {
      throw badRequest("INVALID_PAYMENT_METHOD", "Payment method does not exist in this household");
    }
    if (!method.isActive && method.id !== previous?.paymentMethodId) {
      throw badRequest("PAYMENT_METHOD_INACTIVE", "Payment method is inactive");
    }
  }
}

export async function create(
  ctx: HouseholdContext,
  auth: AuthContext,
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  const data: TransactionData = {
    type: input.type,
    amountAgorot: input.amountAgorot,
    categoryId: input.categoryId ?? null,
    description: input.description ?? null,
    transactionDate: dateOnlyToDate(input.transactionDate),
    paymentMethodId: input.paymentMethodId ?? null,
    incomeSource: input.incomeSource ?? null,
  };
  await validateReferences(ctx, data);
  return toTransactionDto(await transactionsRepository.create(ctx.householdId, auth.user.id, data));
}

/** Any member may record transactions; only the creator or an OWNER/ADMIN may change them. */
function assertCanModify(ctx: HouseholdContext, auth: AuthContext, createdByUserId: string): void {
  if (createdByUserId !== auth.user.id && !MANAGER_ROLES.includes(ctx.role)) {
    throw forbidden("INSUFFICIENT_ROLE", "You can only change transactions you created");
  }
}

export async function update(
  ctx: HouseholdContext,
  auth: AuthContext,
  transactionId: string,
  patch: UpdateTransactionInput,
): Promise<TransactionDto> {
  const existing = await transactionsRepository.findInHousehold(ctx.householdId, transactionId);
  if (!existing) throw transactionNotFound();
  assertCanModify(ctx, auth, existing.createdByUserId);

  const type = patch.type ?? existing.type;
  const data: TransactionData = {
    type,
    amountAgorot: patch.amountAgorot ?? existing.amountAgorot,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
    description: patch.description !== undefined ? patch.description : existing.description,
    transactionDate: dateOnlyToDate(patch.transactionDate ?? dateToDateOnly(existing.transactionDate)),
    paymentMethodId: patch.paymentMethodId !== undefined ? patch.paymentMethodId : existing.paymentMethodId,
    // Switching to EXPENSE clears an income source left over from INCOME.
    incomeSource:
      patch.incomeSource !== undefined ? patch.incomeSource : type === "EXPENSE" ? null : existing.incomeSource,
  };
  await validateReferences(ctx, data, existing);
  return toTransactionDto(await transactionsRepository.update(existing.id, data));
}

export async function remove(ctx: HouseholdContext, auth: AuthContext, transactionId: string): Promise<void> {
  const existing = await transactionsRepository.findInHousehold(ctx.householdId, transactionId);
  if (!existing) throw transactionNotFound();
  assertCanModify(ctx, auth, existing.createdByUserId);
  await transactionsRepository.remove(existing.id);
}
