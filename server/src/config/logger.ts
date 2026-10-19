import { pino, type Logger } from "pino";

import type { AppConfig } from "./env.js";

export type { Logger };

export function createLogger(level: AppConfig["logLevel"]): Logger {
  return pino({
    level,
    // Never log credentials, even by accident.
    redact: ["req.headers.authorization", "authorization", "token", "idToken"],
  });
}
