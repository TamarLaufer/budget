import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { configureApiClient } from "../api/client";
import { unregisterDevice } from "../notifications/pushNotifications";
import type { AppDispatch } from "../store";
import { sessionEnded } from "../store/shared";
import { firebaseUserChanged, loadMe, type FirebaseUserInfo } from "../store/slices/authSlice";
import { getFirebaseAuth } from "./firebase";

function toInfo(user: User): FirebaseUserInfo {
  return { uid: user.uid, email: user.email, emailVerified: user.emailVerified };
}

/**
 * Connects Firebase to Redux and the API client. Call once at app start; returns an unsubscribe.
 *
 * - The API client asks Firebase for the ID token on every request. The SDK refreshes it
 *   automatically before it expires; `forceRefresh` is used once after a 401.
 * - When the signed-in account changes or signs out, all Redux data is reset first.
 */
export function startSession(dispatch: AppDispatch): () => void {
  const auth = getFirebaseAuth();

  configureApiClient({
    getToken: async (forceRefresh) => (auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null),
  });

  let currentUid: string | null | undefined;
  return onIdTokenChanged(auth, (user) => {
    const uid = user?.uid ?? null;
    if (uid !== currentUid) {
      if (currentUid !== undefined) dispatch(sessionEnded());
      currentUid = uid;
      dispatch(firebaseUserChanged(user ? toInfo(user) : null));
      if (user) void dispatch(loadMe());
    } else if (user) {
      // Same account, refreshed token (e.g. email just verified): update claims only.
      dispatch(firebaseUserChanged(toInfo(user)));
    }
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function register(email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  // Verification proves ownership of the address; it is required to accept invitations.
  await sendEmailVerification(user);
}

export async function resendVerificationEmail(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (user) await sendEmailVerification(user);
}

/** Reloads the user and forces a new ID token so the server sees an updated email_verified claim. */
export async function refreshEmailVerification(): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified;
}

/** How long sign-out waits for the server to forget this device's push token. */
const UNREGISTER_TIMEOUT_MS = 3_000;

export async function signOut(): Promise<void> {
  // Needs the still-valid ID token, so it runs first; a failure must never block signing out.
  await Promise.race([
    unregisterDevice().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
  ]);
  await firebaseSignOut(getFirebaseAuth());
}

/** Firebase error codes → keys of strings.AUTH_ERRORS. */
export function authErrorKey(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "INVALID_EMAIL";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "INVALID_CREDENTIALS";
    case "auth/email-already-in-use":
      return "EMAIL_IN_USE";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "WEAK_PASSWORD";
    case "auth/too-many-requests":
      return "TOO_MANY_REQUESTS";
    case "auth/network-request-failed":
      return "NETWORK";
    default:
      return "UNKNOWN";
  }
}
