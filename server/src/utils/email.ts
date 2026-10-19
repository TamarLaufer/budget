/** Emails are compared case-insensitively; store and compare the normalized form only. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
