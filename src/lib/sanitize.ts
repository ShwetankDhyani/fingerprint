/** Strip control chars and neutralize obvious XSS payloads in free text. */
export function sanitizeText(value: string, max = 4000): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, max);
}

export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 254);
}

/** Keep E.164-ish mobile values: leading +, digits only afterwards. */
export function sanitizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`.slice(0, 20);
  }
  return digits.replace(/\D/g, "").slice(0, 20);
}
