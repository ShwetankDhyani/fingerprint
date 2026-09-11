/** Digits-only E.164 without leading +. Empty string if unusable. */
export function normalizeWhatsAppPhone(
  input: string | null | undefined,
): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}
