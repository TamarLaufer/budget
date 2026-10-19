import type { Request, RequestHandler } from "express";

import type { Role } from "../generated/prisma/enums.js";
import * as membersRepository from "../repositories/membersRepository.js";
import type { AuthContext, HouseholdContext } from "../types/auth.js";
import { AppError, forbidden } from "../utils/errors.js";

/**
 * SECURITY: household authorization.
 *
 * The household is looked up from the authenticated user's membership row; it is never taken
 * from the request. Every household-scoped repository call must use `req.household.householdId`.
 */
export const requireHousehold: RequestHandler = async (req, _res, next) => {
  const auth = getAuth(req);
  const membership = await membersRepository.findByUserId(auth.user.id);
  if (!membership) {
    throw forbidden("NO_HOUSEHOLD", "You are not a member of a household");
  }
  req.household = {
    householdId: membership.householdId,
    memberId: membership.id,
    role: membership.role,
  };
  next();
};

/** Must run after `requireHousehold`. */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    const household = getHousehold(req);
    if (!allowed.includes(household.role)) {
      throw forbidden("INSUFFICIENT_ROLE", "Your household role does not allow this action");
    }
    next();
  };
}

/** Roles allowed to manage shared household configuration (categories, budgets, invitations…). */
export const MANAGER_ROLES: Role[] = ["OWNER", "ADMIN"];

// A missing context here means a route was wired without its middleware: a programming error,
// so fail closed with a 500 instead of continuing unauthenticated.
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(500, "INTERNAL_ERROR", "Authentication context missing");
  return req.auth;
}

export function getHousehold(req: Request): HouseholdContext {
  if (!req.household) throw new AppError(500, "INTERNAL_ERROR", "Household context missing");
  return req.household;
}
