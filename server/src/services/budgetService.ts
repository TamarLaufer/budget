import type { MonthlyBudgetDto } from "../../../shared/api.js";
import * as budgetsRepository from "../repositories/budgetsRepository.js";
import * as categoriesRepository from "../repositories/categoriesRepository.js";
import type { HouseholdContext } from "../types/auth.js";
import { badRequest, notFound } from "../utils/errors.js";
import { toBudgetDto } from "../utils/serializers.js";

const budgetNotFound = () => notFound("BUDGET_NOT_FOUND", "Budget was not found");

export async function listForMonth(ctx: HouseholdContext, year: number, month: number): Promise<MonthlyBudgetDto[]> {
  return (await budgetsRepository.listForMonth(ctx.householdId, year, month)).map(toBudgetDto);
}

/** Sets one category's budget for one month. Budgets of other months are never modified. */
export async function upsert(
  ctx: HouseholdContext,
  input: { categoryId: string; year: number; month: number; amountAgorot: number },
): Promise<MonthlyBudgetDto> {
  const category = await categoriesRepository.findInHousehold(ctx.householdId, input.categoryId);
  if (!category) throw badRequest("INVALID_CATEGORY", "Category does not exist in this household");
  if (!category.isActive) throw badRequest("CATEGORY_INACTIVE", "Category is inactive");
  const budget = await budgetsRepository.upsert({ ...input, householdId: ctx.householdId });
  return toBudgetDto(budget);
}

export async function updateAmount(
  ctx: HouseholdContext,
  budgetId: string,
  amountAgorot: number,
): Promise<MonthlyBudgetDto> {
  const existing = await budgetsRepository.findInHousehold(ctx.householdId, budgetId);
  if (!existing) throw budgetNotFound();
  return toBudgetDto(await budgetsRepository.updateAmount(existing.id, amountAgorot));
}

export async function remove(ctx: HouseholdContext, budgetId: string): Promise<void> {
  const existing = await budgetsRepository.findInHousehold(ctx.householdId, budgetId);
  if (!existing) throw budgetNotFound();
  await budgetsRepository.remove(existing.id);
}
