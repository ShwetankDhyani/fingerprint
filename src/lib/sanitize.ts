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
