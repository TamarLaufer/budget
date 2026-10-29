import type { RequestHandler } from "express";

import { getAuth, getHousehold } from "../middleware/requireHousehold.js";
import type { BudgetAlerts } from "../services/budgetAlertService.js";
import * as budgetService from "../services/budgetService.js";
import * as catalogService from "../services/catalogService.js";
import * as transactionService from "../services/transactionService.js";
import { idParamsSchema } from "../validators/common.js";
import {
  budgetListQuerySchema,
  createNamedSchema,
  createTransactionSchema,
  listActiveQuerySchema,
  transactionListQuerySchema,
  updateBudgetSchema,
  updateNamedSchema,
  updateTransactionSchema,
  upsertBudgetSchema,
} from "../validators/resourceValidators.js";

export const categories = {
  list: (async (req, res) => {
    const query = listActiveQuerySchema.parse(req.query);
    res.json(await catalogService.listCategories(getHousehold(req), query.includeInactive ?? false));
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const body = createNamedSchema.parse(req.body);
    res.status(201).json(await catalogService.createCategory(getHousehold(req), body.name));
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateNamedSchema.parse(req.body);
    res.json(await catalogService.updateCategory(getHousehold(req), id, body));
  }) satisfies RequestHandler,
};

export const paymentMethods = {
  list: (async (req, res) => {
    const query = listActiveQuerySchema.parse(req.query);
    res.json(await catalogService.listPaymentMethods(getHousehold(req), query.includeInactive ?? false));
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const body = createNamedSchema.parse(req.body);
    res.status(201).json(await catalogService.createPaymentMethod(getHousehold(req), body.name));
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateNamedSchema.parse(req.body);
    res.json(await catalogService.updatePaymentMethod(getHousehold(req), id, body));
  }) satisfies RequestHandler,
};

export const budgets = {
  list: (async (req, res) => {
    const query = budgetListQuerySchema.parse(req.query);
    res.json(await budgetService.listForMonth(getHousehold(req), query.year, query.month));
  }) satisfies RequestHandler,

  upsert: (async (req, res) => {
    const body = upsertBudgetSchema.parse(req.body);
    res.json(await budgetService.upsert(getHousehold(req), body));
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateBudgetSchema.parse(req.body);
    res.json(await budgetService.updateAmount(getHousehold(req), id, body.amountAgorot));
  }) satisfies RequestHandler,

  remove: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    await budgetService.remove(getHousehold(req), id);
    res.status(204).end();
  }) satisfies RequestHandler,
};

/**
 * Budget alerts run after the transaction is saved; they never throw and their wait is bounded,
 * so a notification problem cannot fail or stall a save. Deletes only lower usage: no alert.
 */
export const createTransactionsController = (budgetAlerts: BudgetAlerts) => ({
  list: (async (req, res) => {
    const query = transactionListQuerySchema.parse(req.query);
    res.json(await transactionService.list(getHousehold(req), query));
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    res.json(await transactionService.get(getHousehold(req), id));
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const body = createTransactionSchema.parse(req.body);
    const household = getHousehold(req);
    const transaction = await transactionService.create(household, getAuth(req), body);
    await budgetAlerts.afterExpenseSaved(household.householdId, transaction);
    res.status(201).json(transaction);
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateTransactionSchema.parse(req.body);
    const household = getHousehold(req);
    const transaction = await transactionService.update(household, getAuth(req), id, body);
    await budgetAlerts.afterExpenseSaved(household.householdId, transaction);
    res.json(transaction);
  }) satisfies RequestHandler,

  remove: (async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    await transactionService.remove(getHousehold(req), getAuth(req), id);
    res.status(204).end();
  }) satisfies RequestHandler,
});
