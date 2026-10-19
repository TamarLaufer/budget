import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import type { TokenVerifier } from "../types/auth.js";
import { unauthorized } from "../utils/errors.js";
import type { AppConfig } from "./env.js";

/** Firebase Admin error codes that mean the token itself is unacceptable (→ 401). */
const EXPIRED_CODES = new Set(["auth/id-token-expired"]);
const REVOKED_CODES = new Set(["auth/id-token-revoked", "auth/user-disabled"]);

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function initFirebaseApp(config: AppConfig["firebase"]): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (config.serviceAccountBase64) {
    const json = JSON.parse(Buffer.from(config.serviceAccountBase64, "base64").toString("utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }),
      projectId: config.projectId ?? json.project_id,
    });
  }
  // Without explicit credentials, firebase-admin uses GOOGLE_APPLICATION_CREDENTIALS if set.
  // Signature verification only needs the project ID.
  return initializeApp(config.projectId ? { projectId: config.projectId } : undefined);
}

/**
 * Production token verifier. Every request is verified independently: signature, issuer,
 * audience (project ID) and expiry are checked by firebase-admin; optionally revocation too.
 */
export function createFirebaseTokenVerifier(config: AppConfig["firebase"]): TokenVerifier {
  if (!config.projectId) {
    throw new Error("FIREBASE_PROJECT_ID must be set to verify Firebase ID tokens");
  }
  const auth = getAuth(initFirebaseApp(config));

  return {
    async verify(idToken) {
      try {
        const decoded = await auth.verifyIdToken(idToken, config.checkRevoked);
        return {
          uid: decoded.uid,
          email: decoded.email ?? null,
          emailVerified: decoded.email_verified === true,
        };
      } catch (error) {
        const code = errorCode(error);
        if (code && EXPIRED_CODES.has(code)) {
          throw unauthorized("TOKEN_EXPIRED", "Authentication token has expired");
        }
        if (code && REVOKED_CODES.has(code)) {
          throw unauthorized("TOKEN_REVOKED", "Authentication session is no longer valid");
        }
        if (code?.startsWith("auth/")) {
          throw unauthorized("INVALID_TOKEN", "Authentication token is invalid");
        }
        // Anything else (network failure reaching Google, misconfiguration) is a server error,
        // not the client's fault; let the error handler log it and return 500.
        throw error;
      }
    },
  };
}
