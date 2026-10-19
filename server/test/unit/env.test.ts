import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/env.js";

const base = { DATABASE_URL: "postgresql://localhost/db" };

describe("loadConfig", () => {
  it("applies secure defaults", () => {
    const config = loadConfig(base);
    expect(config.port).toBe(3000);
    expect(config.firebase.checkRevoked).toBe(true);
    expect(config.corsOrigins).toEqual([]);
    expect(config.trustProxy).toBe(0);
  });

  it("requires DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("requires FIREBASE_PROJECT_ID in production", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production" })).toThrow(/FIREBASE_PROJECT_ID/);
    expect(loadConfig({ ...base, NODE_ENV: "production", FIREBASE_PROJECT_ID: "p" }).firebase.projectId).toBe("p");
  });

  it("parses CORS origins and booleans", () => {
    const config = loadConfig({
      ...base,
      CORS_ORIGINS: "https://a.example, https://b.example ,",
      FIREBASE_CHECK_REVOKED: "false",
    });
    expect(config.corsOrigins).toEqual(["https://a.example", "https://b.example"]);
    expect(config.firebase.checkRevoked).toBe(false);
  });

  it("rejects invalid values", () => {
    expect(() => loadConfig({ ...base, PORT: "not-a-port" })).toThrow(/PORT/);
    expect(() => loadConfig({ ...base, FIREBASE_CHECK_REVOKED: "yes" })).toThrow(/FIREBASE_CHECK_REVOKED/);
  });
});
