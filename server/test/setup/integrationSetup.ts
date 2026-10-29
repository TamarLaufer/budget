import { afterAll, beforeEach, inject } from "vitest";

// Must run before any module calls getPrisma().
process.env.DATABASE_URL = inject("databaseUrl");

const { disconnectPrisma, getPrisma } = await import("../../src/db/prisma.js");

/** Every test starts from an empty database. */
beforeEach(async () => {
  await getPrisma().$executeRawUnsafe(
    `TRUNCATE TABLE "Transaction", "MonthlyBudget", "SubCategory", "Category", "PaymentMethod",
       "Invitation", "HouseholdMember", "Household", "User", "PushDevice", "BudgetAlert" RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await disconnectPrisma();
});
