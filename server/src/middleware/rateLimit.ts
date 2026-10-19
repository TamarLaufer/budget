import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";

import type { ApiErrorBody } from "../../../shared/api.js";

const tooManyRequests: ApiErrorBody = {
  error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
};

/** Coarse per-IP limit for the whole API. */
export function apiRateLimit(options: { windowMs: number; max: number }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: tooManyRequests,
  });
}

const INVITE_WINDOW_MS = 60 * 60 * 1000;
const INVITES_PER_WINDOW = 20;

/** Per-user limit on sending invitations (which could otherwise be used to spam addresses). */
export function invitationRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: INVITE_WINDOW_MS,
    limit: INVITES_PER_WINDOW,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Runs after `authenticate`, so the key is the application user, not the IP.
    keyGenerator: (req) => req.auth?.user.id ?? "anonymous",
    message: tooManyRequests,
  });
}
