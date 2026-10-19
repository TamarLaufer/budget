import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();

vi.mock("firebase-admin/app", () => ({
  getApps: () => [],
  initializeApp: () => ({}),
  cert: () => ({}),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken }),
}));

const { createFirebaseTokenVerifier } = await import("../../src/config/firebase.js");

const config = { projectId: "demo-project", serviceAccountBase64: undefined, checkRevoked: true };

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("Firebase token verifier", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it("requires a project id", () => {
    expect(() => createFirebaseTokenVerifier({ ...config, projectId: undefined })).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it("returns the verified identity and checks revocation", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", email: "a@b.co", email_verified: true });
    const verifier = createFirebaseTokenVerifier(config);
    await expect(verifier.verify("tok")).resolves.toEqual({ uid: "u1", email: "a@b.co", emailVerified: true });
    expect(verifyIdToken).toHaveBeenCalledWith("tok", true);
  });

  it("treats a missing email_verified claim as unverified", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", email: "a@b.co" });
    const identity = await createFirebaseTokenVerifier(config).verify("tok");
    expect(identity.emailVerified).toBe(false);
  });

  it.each([
    ["auth/id-token-expired", "TOKEN_EXPIRED"],
    ["auth/id-token-revoked", "TOKEN_REVOKED"],
    ["auth/user-disabled", "TOKEN_REVOKED"],
    ["auth/argument-error", "INVALID_TOKEN"],
  ])("maps %s to 401 %s", async (firebaseCode, apiCode) => {
    verifyIdToken.mockImplementation(() => Promise.reject(firebaseError(firebaseCode)));
    await expect(createFirebaseTokenVerifier(config).verify("tok")).rejects.toMatchObject({
      status: 401,
      code: apiCode,
    });
  });

  it("does not disguise infrastructure failures as client errors", async () => {
    verifyIdToken.mockImplementation(() => Promise.reject(new Error("ECONNRESET")));
    await expect(createFirebaseTokenVerifier(config).verify("tok")).rejects.toThrow("ECONNRESET");
  });
});
