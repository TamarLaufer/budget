import { onIdTokenChanged, type User } from "firebase/auth";

import { startSession } from "../auth/session";
import { createStore } from "../store";
import { selectLockGate } from "../store/selectors";

jest.mock("firebase/auth", () => ({
  onIdTokenChanged: jest.fn(),
  EmailAuthProvider: { PROVIDER_ID: "password", credential: jest.fn() },
  reauthenticateWithCredential: jest.fn(),
}));
jest.mock("../auth/firebase", () => ({ getFirebaseAuth: () => ({ currentUser: null }) }));
jest.mock("../api/client", () => ({ configureApiClient: jest.fn() }));
jest.mock("../api/endpoints", () => ({ api: { me: { get: jest.fn(() => new Promise(() => undefined)) } } }));
jest.mock("../notifications/pushNotifications", () => ({ unregisterDevice: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
  // Every user has fingerprint unlock enabled in these tests.
  getItemAsync: jest.fn(async () => "1"),
}));

const user = (uid: string) => ({ uid, email: `${uid}@example.com`, emailVerified: true }) as User;

function connect() {
  const store = createStore();
  startSession(store.dispatch);
  const emit = (onIdTokenChanged as jest.Mock).mock.calls.at(-1)[1] as (u: User | null) => void;
  return { store, emit };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("session start and the app lock", () => {
  it("locks a session that Firebase restored at app start", async () => {
    const { store, emit } = connect();
    emit(user("userA"));
    expect(selectLockGate(store.getState())).toBe("checking");
    await settle();
    expect(selectLockGate(store.getState())).toBe("locked");
  });

  it("does not lock right after the user typed their password", async () => {
    const { store, emit } = connect();
    emit(null);
    emit(user("userA"));
    await settle();
    expect(selectLockGate(store.getState())).toBe("unlocked");
    expect(store.getState().appLock.enabled).toBe(true);
  });

  it("keeps the lock state on token refresh for the same user", async () => {
    const { store, emit } = connect();
    emit(user("userA"));
    await settle();
    emit(user("userA"));
    await settle();
    expect(selectLockGate(store.getState())).toBe("locked");
  });

  it("resets the lock state when signing out", async () => {
    const { store, emit } = connect();
    emit(user("userA"));
    await settle();
    emit(null);
    expect(store.getState().appLock).toEqual({ uid: null, status: "checking", enabled: false, hasUnlocked: false });
  });
});
