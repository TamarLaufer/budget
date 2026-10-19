import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** Firebase project whose ID tokens are accepted. Required outside tests. */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  /**
   * Base64 of a service-account JSON. Only needed for revocation checks; ID-token signature
   * verification itself uses Google's public keys. Alternatively set GOOGLE_APPLICATION_CREDENTIALS.
   */
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().min(1).optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  /** Reject tokens of users whose sessions were revoked/disabled. Costs one Firebase call per request. */
  FIREBASE_CHECK_REVOKED: booleanFromString.default(true),

  /** Comma-separated browser origins allowed by CORS. The mobile app does not need CORS. */
  CORS_ORIGINS: z.string().default(""),
  /** Number of reverse-proxy hops to trust for the client IP (rate limiting). 0 = none. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
});

type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  nodeEnv: Env["NODE_ENV"];
  port: number;
  databaseUrl: string;
  logLevel: Env["LOG_LEVEL"];
  firebase: {
    projectId: string | undefined;
    serviceAccountBase64: string | undefined;
    checkRevoked: boolean;
  };
  corsOrigins: string[];
  trustProxy: number;
  rateLimit: { windowMs: number; max: number };
}

/** Parses and validates environment variables. Throws with a readable message on misconfiguration. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = result.data;

  if (e.NODE_ENV === "production" && !e.FIREBASE_PROJECT_ID) {
    throw new Error("Invalid environment configuration:\n  FIREBASE_PROJECT_ID: required in production");
  }

  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    logLevel: e.LOG_LEVEL,
    firebase: {
      projectId: e.FIREBASE_PROJECT_ID,
      serviceAccountBase64: e.FIREBASE_SERVICE_ACCOUNT_BASE64,
      checkRevoked: e.FIREBASE_CHECK_REVOKED,
    },
    corsOrigins: e.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: e.TRUST_PROXY,
    rateLimit: { windowMs: e.RATE_LIMIT_WINDOW_MS, max: e.RATE_LIMIT_MAX },
  };
}
