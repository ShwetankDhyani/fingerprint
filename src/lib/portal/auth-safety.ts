/**
 * Auth safety helpers for scripts and ops tooling.
 * Import from agent scripts — never rotate protected human accounts.
 */

export const PROTECTED_PORTAL_EMAILS = [
  "setu.dhyani@gmail.com",
  "raghudhyani@gmail.com",
] as const;

export function isProtectedPortalEmail(email?: string | null) {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (PROTECTED_PORTAL_EMAILS.includes(normalized as (typeof PROTECTED_PORTAL_EMAILS)[number])) {
    return true;
  }
  const fromEnv = String(process.env.PORTAL_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  return Boolean(fromEnv && normalized === fromEnv);
}

export function assertNotProtectedPortalEmail(email?: string | null) {
  if (isProtectedPortalEmail(email)) {
    throw new Error(
      `Refusing auth mutation for protected portal account: ${email}. Use qa.panel@lynxweb.in via scripts/ensure-qa-panel-user.cjs instead.`,
    );
  }
}
