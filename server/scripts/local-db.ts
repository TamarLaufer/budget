/**
 * `npm run db:local` — starts a persistent local PostgreSQL for development on port 54320
 * with databases `budget_dev` and `budget_test`. Data lives in server/.local-db (git-ignored).
 * Press Ctrl+C to stop.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { startEmbeddedPostgres } from "./embedded-pg.js";

const PORT = 54320;
const here = path.dirname(fileURLToPath(import.meta.url));

const db = await startEmbeddedPostgres({
  dataDir: path.join(here, "..", ".local-db"),
  port: PORT,
  persistent: true,
  databases: ["budget_dev", "budget_test"],
});

console.log("PostgreSQL is running.");
console.log(`  DATABASE_URL=${db.urlFor("budget_dev")}`);
console.log(`  DATABASE_URL_TEST=${db.urlFor("budget_test")}`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
