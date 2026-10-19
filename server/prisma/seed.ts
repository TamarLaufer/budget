/**
 * Development seed: adds the sample categories to every household that has none yet.
 * It creates no users, households, budgets or transactions, and production never depends on it.
 *
 *   npm run db:seed
 */
import { disconnectPrisma, getPrisma } from "../src/db/prisma.js";
import { DEFAULT_CATEGORY_NAMES } from "../src/services/defaultCategories.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const prisma = getPrisma();
const households = await prisma.household.findMany({
  where: { categories: { none: {} } },
  select: { id: true, name: true },
});

for (const household of households) {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORY_NAMES.map((name) => ({ householdId: household.id, name })),
    skipDuplicates: true,
  });
  console.log(`Seeded categories for household "${household.name}"`);
}
console.log(`Done (${households.length} household(s) seeded).`);
await disconnectPrisma();
