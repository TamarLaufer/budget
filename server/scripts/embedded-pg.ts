/**
 * Development/test helper: runs a real PostgreSQL server from npm binaries (embedded-postgres),
 * so neither Docker nor a system-wide PostgreSQL install is needed on developer machines.
 * Never used in production.
 */
import EmbeddedPostgres from "embedded-postgres";

export interface EmbeddedDatabase {
  stop: () => Promise<void>;
  urlFor: (database: string) => string;
}

const USER = "postgres";
const PASSWORD = "postgres";

export async function startEmbeddedPostgres(options: {
  dataDir: string;
  port: number;
  persistent: boolean;
  databases: string[];
}): Promise<EmbeddedDatabase> {
  const pg = new EmbeddedPostgres({
    databaseDir: options.dataDir,
    user: USER,
    password: PASSWORD,
    port: options.port,
    persistent: options.persistent,
    // Hebrew text requires UTF-8; on Windows initdb would otherwise default to WIN1252.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });

  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  if (!existsSync(join(options.dataDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  try {
    for (const database of options.databases) {
      const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
      if (existing.rowCount === 0) {
        await pg.createDatabase(database);
      }
    }
  } finally {
    await client.end();
  }

  return {
    stop: () => pg.stop(),
    urlFor: (database) =>
      `postgresql://${USER}:${PASSWORD}@localhost:${options.port}/${database}`,
  };
}
