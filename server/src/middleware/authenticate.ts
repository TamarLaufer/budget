import type { RequestHandler } from "express";

import * as usersRepository from "../repositories/usersRepository.js";
import type { TokenVerifier } from "../types/auth.js";
import { normalizeEmail } from "../utils/email.js";
import { unauthorized } from "../utils/errors.js";

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

/**
 * SECURITY: the only way a request becomes authenticated.
 *
 * 1. Requires `Authorization: Bearer <Firebase ID token>`.
 * 2. Verifies the token on every request (no server-side session cache).
 * 3. Maps the Firebase uid to the application user in PostgreSQL, creating it on first sign-in.
 * 4. Sets `req.auth`. Nothing in the request body, query or params can change who the user is.
 */
export function authenticate(verifier: TokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const match = header ? BEARER.exec(header) : null;
    if (!match?.[1]) {
      throw unauthorized("UNAUTHENTICATED", "Missing or malformed Authorization header");
    }

    const identity = await verifier.verify(match[1]);
    if (!identity.email) {
      throw unauthorized("EMAIL_REQUIRED", "The account has no email address");
    }

    const user = await usersRepository.findOrCreateByFirebaseUid({
      firebaseUid: identity.uid,
      email: normalizeEmail(identity.email),
    });

    req.auth = {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      emailVerified: identity.emailVerified,
    };
    next();
  };
}
