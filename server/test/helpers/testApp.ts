import { createServer, type Server } from "node:http";

import { pino } from "pino";
import request from "supertest";
import type { Express } from "express";
import { afterAll } from "vitest";

import { createApp } from "../../src/app.js";
import type { TokenVerifier, VerifiedIdentity } from "../../src/types/auth.js";
import { unauthorized } from "../../src/utils/errors.js";

/** Tokens the fake verifier treats specially, mirroring Firebase's failure modes. */
export const EXPIRED_TOKEN = "expired-token";
export const REVOKED_TOKEN = "revoked-token";

/**
 * Deterministic stand-in for Firebase: a token is valid only if it was registered here.
 * Anything else is rejected exactly like an invalid Firebase token (401 INVALID_TOKEN).
 */
export class FakeTokenVerifier implements TokenVerifier {
  private readonly identities = new Map<string, VerifiedIdentity>();

  register(token: string, identity: VerifiedIdentity): void {
    this.identities.set(token, identity);
  }

  verify(idToken: string): Promise<VerifiedIdentity> {
    if (idToken === EXPIRED_TOKEN) {
      return Promise.reject(unauthorized("TOKEN_EXPIRED", "Authentication token has expired"));
    }
    if (idToken === REVOKED_TOKEN) {
      return Promise.reject(unauthorized("TOKEN_REVOKED", "Authentication session is no longer valid"));
    }
    const identity = this.identities.get(idToken);
    return identity
      ? Promise.resolve(identity)
      : Promise.reject(unauthorized("INVALID_TOKEN", "Authentication token is invalid"));
  }
}

export interface TestUser {
  token: string;
  email: string;
  uid: string;
}

export interface TestContext {
  app: Express;
  verifier: FakeTokenVerifier;
  /** Registers a Firebase identity and returns its token. */
  user(name: string, options?: { emailVerified?: boolean; email?: string }): TestUser;
  /** supertest agent with the user's Bearer token. */
  as(user: TestUser): AuthedRequest;
}

type Method = "get" | "post" | "put" | "patch" | "delete";
export type AuthedRequest = Record<Method, (url: string) => request.Test>;

export function createTestContext(options: { rateLimitMax?: number } = {}): TestContext {
  const verifier = new FakeTokenVerifier();
  const app = createApp({
    config: {
      corsOrigins: [],
      trustProxy: 0,
      rateLimit: { windowMs: 60_000, max: options.rateLimitMax ?? 10_000 },
    },
    logger: pino({ level: process.env.TEST_LOG_LEVEL ?? "silent" }),
    tokenVerifier: verifier,
  });

  // One listening server per test file (supertest would otherwise open a new one per request).
  let server: Server | undefined;
  const target = () => (server ??= createServer(app).listen(0));
  afterAll(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

  return {
    app,
    verifier,
    user(name, { emailVerified = true, email } = {}) {
      const user = { token: `token-${name}`, uid: `uid-${name}`, email: email ?? `${name}@example.com` };
      verifier.register(user.token, { uid: user.uid, email: user.email, emailVerified });
      return user;
    },
    as(user) {
      const agent = request(target());
      const withAuth = (test: request.Test) => test.set("Authorization", `Bearer ${user.token}`);
      return {
        get: (url) => withAuth(agent.get(url)),
        post: (url) => withAuth(agent.post(url)),
        put: (url) => withAuth(agent.put(url)),
        patch: (url) => withAuth(agent.patch(url)),
        delete: (url) => withAuth(agent.delete(url)),
      };
    },
  };
}
