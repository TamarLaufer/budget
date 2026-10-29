import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createFirebaseTokenVerifier } from "./config/firebase.js";
import { createLogger } from "./config/logger.js";
import { disconnectPrisma } from "./db/prisma.js";
import { createExpoPushSender } from "./services/push/expoPushSender.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);

const app = createApp({
  config,
  logger,
  tokenVerifier: createFirebaseTokenVerifier(config.firebase),
  pushSender: createExpoPushSender({ accessToken: config.push.expoAccessToken }),
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, "Budget API listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
