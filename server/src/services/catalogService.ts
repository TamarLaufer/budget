/**
 * Categories and payment methods: shared, named, household-level lists that are deactivated
 * rather than deleted, so historical transactions keep pointing at them.
 */
import type { CategoryDto, PaymentMethodDto } from "../../../shared/api.js";
import * as categoriesRepository from "../repositories/categoriesRepository.js";
import * as paymentMethodsRepository from "../repositories/paymentMethodsRepository.js";
import type { HouseholdContext } from "../types/auth.js";
import { conflict, notFound } from "../utils/errors.js";
import { toCategoryDto, toPaymentMethodDto } from "../utils/serializers.js";
import { isUniqueViolation } from "./householdService.js";

async function rethrowNameTaken<T>(code: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(code, "This name is already in use");
    throw error;
  }
}

// ---- Categories ----

export async function listCategories(ctx: HouseholdContext, includeInactive: boolean): Promise<CategoryDto[]> {
  return (await categoriesRepository.list(ctx.householdId, includeInactive)).map(toCategoryDto);
}

export async function createCategory(ctx: HouseholdContext, name: string): Promise<CategoryDto> {
  const category = await rethrowNameTaken(
    "CATEGORY_NAME_TAKEN",
    categoriesRepository.create(ctx.householdId, name),
  );
  return toCategoryDto(category);
}

export async function updateCategory(
  ctx: HouseholdContext,
  categoryId: string,
  patch: { name?: string; isActive?: boolean },
): Promise<CategoryDto> {
  const existing = await categoriesRepository.findInHousehold(ctx.householdId, categoryId);
  if (!existing) throw notFound("CATEGORY_NOT_FOUND", "Category was not found");
  const category = await rethrowNameTaken(
    "CATEGORY_NAME_TAKEN",
    categoriesRepository.update(existing.id, patch),
  );
  return toCategoryDto(category);
}

// ---- Payment methods ----

export async function listPaymentMethods(
  ctx: HouseholdContext,
  includeInactive: boolean,
): Promise<PaymentMethodDto[]> {
  return (await paymentMethodsRepository.list(ctx.householdId, includeInactive)).map(toPaymentMethodDto);
}

export async function createPaymentMethod(ctx: HouseholdContext, name: string): Promise<PaymentMethodDto> {
  const method = await rethrowNameTaken(
    "PAYMENT_METHOD_NAME_TAKEN",
    paymentMethodsRepository.create(ctx.householdId, name),
  );
  return toPaymentMethodDto(method);
}

export async function updatePaymentMethod(
  ctx: HouseholdContext,
  paymentMethodId: string,
  patch: { name?: string; isActive?: boolean },
): Promise<PaymentMethodDto> {
  const existing = await paymentMethodsRepository.findInHousehold(ctx.householdId, paymentMethodId);
  if (!existing) throw notFound("PAYMENT_METHOD_NOT_FOUND", "Payment method was not found");
  const method = await rethrowNameTaken(
    "PAYMENT_METHOD_NAME_TAKEN",
    paymentMethodsRepository.update(existing.id, patch),
  );
  return toPaymentMethodDto(method);
}
