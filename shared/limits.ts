/**
 * Validation limits shared by the mobile app and the server, so client-side checks match what the
 * server enforces. Plain constants with no imports, so either package can use them at runtime.
 */

/** ₪10,000,000. Fits comfortably in PostgreSQL INTEGER (max 2,147,483,647). */
export const MAX_AMOUNT_AGOROT = 1_000_000_000;
export const MAX_NAME_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 300;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
