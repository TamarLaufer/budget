import type { Role } from "../generated/prisma/enums.js";

/** Identity proven by a verified Firebase ID token. */
export interface VerifiedIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

/**
 * Verifies an ID token and returns the identity it proves, or throws an AppError(401).
 * Injected into the app so tests can replace Firebase with a deterministic fake.
 */
export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedIdentity>;
}

export interface AuthContext {
  user: { id: string; email: string; displayName: string | null };
  emailVerified: boolean;
}

export interface HouseholdContext {
  householdId: string;
  memberId: string;
  role: Role;
}
