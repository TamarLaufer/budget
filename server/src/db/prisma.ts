import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../generated/prisma/client.js";

/** Either the root client or an interactive-transaction client. Repositories accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;

let client: PrismaClient | undefined;

/** Lazily creates the process-wide Prisma client from DATABASE_URL. */
export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
