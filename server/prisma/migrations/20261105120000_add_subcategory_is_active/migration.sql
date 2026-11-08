-- AlterTable
-- Additive: existing subcategories get the default and stay active.
ALTER TABLE "SubCategory" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
