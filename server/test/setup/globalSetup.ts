/**
 * Provides an isolated, migrated PostgreSQL database for integration tests.
 *
 * - If DATABASE_URL_TEST is set (CI, or `npm run db:local`), that database is used.
 * - Otherwise a throwaway embedded PostgreSQL is started in a temp dir and removed afterwards.
 *
 * Safety: refuses any URL whose database name does not contain "test", and any URL equal to
 * DATABASE_URL, so tests can never truncate a development or production database.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TestProject } from "vitest/node";

import { startEmbeddedPostgres } from "../../scripts/embedded-pg.js";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      srv.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

export function assertSafeTestDatabase(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test".`);
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("Refusing to run tests: DATABASE_URL_TEST must differ from DATABASE_URL.");
  }
}

export default async function setup(project: TestProject) {
  let url = process.env.DATABASE_URL_TEST;
  let cleanup: (() => Promise<void>) | undefined;

  if (!url) {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), "budget-test-pg-"));
    const db = await startEmbeddedPostgres({
      dataDir,
      port: await freePort(),
      persistent: false,
      databases: ["budget_test"],
    });
    url = db.urlFor("budget_test");
    cleanup = async () => {
      await db.stop();
      rmSync(dataDir, { recursive: true, force: true });
    };
  }

  assertSafeTestDatabase(url);

  execFileSync(process.execPath, [path.join(serverRoot, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  project.provide("databaseUrl", url);
  return async () => {
    await cleanup?.();
  };
}
