import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import type { AppConfig } from "./config/env.js";
import type { Logger } from "./config/logger.js";
import { getPrisma } from "./db/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { createApiRouter } from "./routes/index.js";
import type { TokenVerifier } from "./types/auth.js";

export interface AppDependencies {
  config: Pick<AppConfig, "corsOrigins" | "trustProxy" | "rateLimit">;
  logger: Logger;
  /** Firebase in production; a fake in tests. */
  tokenVerifier: TokenVerifier;
}

const JSON_BODY_LIMIT = "100kb";

export function createApp({ config, logger, tokenVerifier }: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  // Needed behind a load balancer so rate limiting sees the real client IP.
  app.set("trust proxy", config.trustProxy);

  app.use(helmet());
  // Native apps don't send Origin; browsers are only allowed from the configured allowlist.
  app.use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false }));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ method: req.method, path: req.path, status: res.statusCode, ms }, "request");
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/health/ready", async (_req, res) => {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });

  app.use("/api", apiRateLimit(config.rateLimit), createApiRouter(tokenVerifier));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
