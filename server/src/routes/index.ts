import { Router, type RequestHandler } from "express";

import * as authController from "../controllers/authController.js";
import * as householdController from "../controllers/householdController.js";
import * as notificationController from "../controllers/notificationController.js";
import {
  budgets,
  categories,
  createTransactionsController,
  paymentMethods,
} from "../controllers/resourceControllers.js";
import { authenticate } from "../middleware/authenticate.js";
import { invitationRateLimit } from "../middleware/rateLimit.js";
import { MANAGER_ROLES, requireHousehold, requireRole } from "../middleware/requireHousehold.js";
import type { BudgetAlerts } from "../services/budgetAlertService.js";
import type { TokenVerifier } from "../types/auth.js";

/**
 * Route table. Every route below `authenticate` requires a valid Firebase ID token.
 * Household resources additionally go through `requireHousehold`, which derives the household
 * from the user's membership; role checks come from `requireRole`.
 */
export function createApiRouter(verifier: TokenVerifier, budgetAlerts: BudgetAlerts): Router {
  const api = Router();
  api.use(authenticate(verifier));

  const manager = requireRole(...MANAGER_ROLES);
  const owner = requireRole("OWNER");
  const transactions = createTransactionsController(budgetAlerts);

  // ---- Current user ----
  api.get("/auth/me", authController.getMe);
  api.patch("/auth/me", authController.updateMe);

  // ---- Push notifications: per user and device, independent of household membership ----
  api.put("/notifications/devices", notificationController.registerDevice);
  api.delete("/notifications/devices", notificationController.unregisterDevice);
  api.put("/notifications/preferences", notificationController.updatePreferences);

  // ---- Onboarding: available to users without a household ----
  api.post("/households", householdController.create);
  api.get("/households/invitations/received", householdController.listReceivedInvitations);
  api.post("/households/invitations/:id/accept", householdController.acceptInvitation);
  api.post("/households/invitations/:id/decline", householdController.declineInvitation);

  // ---- Everything below requires household membership ----
  // requireHousehold is attached per route (not via use()) so unknown paths still 404.
  const household = {
    get: (path: string, ...handlers: RequestHandler[]) => api.get(path, requireHousehold, ...handlers),
    post: (path: string, ...handlers: RequestHandler[]) => api.post(path, requireHousehold, ...handlers),
    put: (path: string, ...handlers: RequestHandler[]) => api.put(path, requireHousehold, ...handlers),
    patch: (path: string, ...handlers: RequestHandler[]) => api.patch(path, requireHousehold, ...handlers),
    delete: (path: string, ...handlers: RequestHandler[]) => api.delete(path, requireHousehold, ...handlers),
  };

  household.get("/households/current", householdController.getCurrent);
  household.patch("/households/current", manager, householdController.updateCurrent);
  household.get("/households/members", householdController.listMembers);
  household.patch("/households/members/:id", owner, householdController.updateMember);
  household.delete("/households/members/:id", householdController.removeMember);
  household.get("/households/invitations", manager, householdController.listInvitations);
  household.post(
    "/households/invitations",
    manager,
    invitationRateLimit(),
    householdController.createInvitation,
  );
  household.delete("/households/invitations/:id", manager, householdController.revokeInvitation);

  household.get("/categories", categories.list);
  household.post("/categories", manager, categories.create);
  household.patch("/categories/:id", manager, categories.update);

  household.get("/payment-methods", paymentMethods.list);
  household.post("/payment-methods", manager, paymentMethods.create);
  household.patch("/payment-methods/:id", manager, paymentMethods.update);

  household.get("/budgets", budgets.list);
  household.put("/budgets", manager, budgets.upsert);
  household.patch("/budgets/:id", manager, budgets.update);
  household.delete("/budgets/:id", manager, budgets.remove);

  household.get("/transactions", transactions.list);
  household.post("/transactions", transactions.create);
  household.get("/transactions/:id", transactions.get);
  household.patch("/transactions/:id", transactions.update);
  household.delete("/transactions/:id", transactions.remove);

  return api;
}
