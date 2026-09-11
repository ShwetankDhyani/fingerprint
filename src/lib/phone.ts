import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

export type PhoneCountryOption = {
  code: CountryCode;
  dial: string;
  name: string;
  label: string;
};

const PRIORITY_COUNTRIES: CountryCode[] = [
  "IN",
  "US",
  "GB",
  "AE",
  "SG",
  "AU",
  "CA",
  "DE",
  "NL",
  "SA",
];

function regionName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Flag emoji for an ISO country code (🇺🇸, 🇮🇳, …). */
export function countryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0)),
    );
}

let cachedOptions: PhoneCountryOption[] | null = null;

/** Countries for the dial-code picker, India and common markets first. */
export function phoneCountryOptions(): PhoneCountryOption[] {
  if (cachedOptions) return cachedOptions;

  const priority = new Set(PRIORITY_COUNTRIES);
  const rest = (getCountries() as CountryCode[])
    .filter((code) => !priority.has(code))
    .map((code) => {
      const name = regionName(code);
      const dial = `+${getCountryCallingCode(code)}`;
      return {
        code,
        dial,
        name,
        label: `${countryFlag(code)} ${name} (${dial})`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedOptions = [
    ...PRIORITY_COUNTRIES.filter((code) => isSupportedCountry(code)).map(
      (code) => {
        const name = regionName(code);
        const dial = `+${getCountryCallingCode(code)}`;
        return {
          code,
          dial,
          name,
          label: `${countryFlag(code)} ${name} (${dial})`,
        };
      },
    ),
    ...rest,
  ];

  return cachedOptions;
}

export function normalizeCountryCode(
  value?: string | null,
): CountryCode | null {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!code || code === "XX" || code === "T1") return null;
  return isSupportedCountry(code) ? (code as CountryCode) : null;
}

/**
 * Prefer edge geo headers (Vercel / Cloudflare / CloudFront).
 * Falls back to India — Lynx's home market — when the country is unknown.
 */
export function resolveDefaultPhoneCountry(
  headerStore: Headers | { get(name: string): string | null },
): CountryCode {
  const candidates = [
    headerStore.get("x-vercel-ip-country"),
    headerStore.get("cf-ipcountry"),
    headerStore.get("cloudfront-viewer-country"),
  ];
  for (const raw of candidates) {
    const code = normalizeCountryCode(raw);
    if (code) return code;
  }
  return "IN";
}

export function isValidInternationalPhone(value: string) {
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(parsed?.isValid());
}

export function toE164(
  nationalNumber: string,
  country: CountryCode,
): string | null {
  const parsed = parsePhoneNumberFromString(nationalNumber, country);
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

export function formatPhoneDisplay(value: string) {
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.isValid()) return value;
  return parsed.formatInternational();
}
