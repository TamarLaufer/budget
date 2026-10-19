/**
 * Firebase is used for identity only (email/password sign-in and ID tokens). All app data lives
 * in the backend's PostgreSQL database.
 *
 * The web config below is public by design: it identifies the Firebase project but grants no
 * privileges. Admin credentials exist only on the server and must never be added to the app.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

/** The Auth instance, with the session persisted in AsyncStorage so it survives app restarts. */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (e.g. after a Fast Refresh in development).
    auth = getAuth(app);
  }
  return auth;
}
