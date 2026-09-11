import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { siteConfig } from "@/lib/site";

/** Treat empty/placeholder strings as unset so optional URL secrets never crash boot. */
const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[SENSITIVE]" || !/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}, z.string().url().optional());

const optionalSecret = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[SENSITIVE]") return undefined;
  return trimmed;
}, z.string().min(1).optional());

/**
 * Server secrets never reach the client.
 * Optional vars enable graceful local/mock fallbacks when unset.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    RESEND_API_KEY: optionalSecret,
    /** Full SMTP URL fallback, e.g. smtps://user:pass@smtp.zoho.in:465 */
    SMTP_URL: optionalSecret,
    // Allow "Name <email@domain>" as well as bare emails.
    EMAIL_FROM: optionalSecret,
    EMAIL_REPLY_TO: optionalSecret,
    EMAIL_TO_TEAM: optionalSecret,
    SUPABASE_URL: optionalUrl,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    CASHFREE_APP_ID: optionalSecret,
    CASHFREE_SECRET_KEY: optionalSecret,
    CASHFREE_ENV: z.enum(["sandbox", "production"]).optional(),
    CRON_SECRET: optionalSecret,
    WHATSAPP_ACCESS_TOKEN: optionalSecret,
    WHATSAPP_PHONE_NUMBER_ID: optionalSecret,
    WHATSAPP_PAYMENT_TEMPLATE: optionalSecret,
    WHATSAPP_TEMPLATE_LANG: optionalSecret,
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
    NEXT_PUBLIC_CASHFREE_MODE: z.enum(["sandbox", "production"]).optional(),
    NEXT_PUBLIC_WHATSAPP_NUMBER: optionalSecret,
    NEXT_PUBLIC_SITE_URL: optionalUrl,
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_URL: process.env.SMTP_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    EMAIL_TO_TEAM: process.env.EMAIL_TO_TEAM,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CASHFREE_APP_ID: process.env.CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
    CASHFREE_ENV: process.env.CASHFREE_ENV as
      | "sandbox"
      | "production"
      | undefined,
    CRON_SECRET: process.env.CRON_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_PAYMENT_TEMPLATE: process.env.WHATSAPP_PAYMENT_TEMPLATE,
    WHATSAPP_TEMPLATE_LANG: process.env.WHATSAPP_TEMPLATE_LANG,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CASHFREE_MODE: process.env.NEXT_PUBLIC_CASHFREE_MODE as
      | "sandbox"
      | "production"
      | undefined,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});

const DEFAULT_FROM = `${siteConfig.name} <noreply@lynxweb.in>`;

export type EmailSettings = {
  provider: "resend" | "smtp" | "none";
  from: string;
  replyTo: string;
  teamInbox: string;
  resendApiKey?: string;
  smtpUrl?: string;
};

/**
 * Resolves the outbound mail configuration.
 * A sender address always exists; only the transport can be missing.
 */
export function emailSettings(): EmailSettings {
  const resendApiKey = env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const smtpUrl = env.SMTP_URL ?? process.env.SMTP_URL;
  const provider = resendApiKey ? "resend" : smtpUrl ? "smtp" : "none";

  return {
    provider,
    from: env.EMAIL_FROM ?? process.env.EMAIL_FROM ?? DEFAULT_FROM,
    replyTo:
      env.EMAIL_REPLY_TO ?? process.env.EMAIL_REPLY_TO ?? siteConfig.email,
    teamInbox:
      env.EMAIL_TO_TEAM ?? process.env.EMAIL_TO_TEAM ?? siteConfig.email,
    resendApiKey: resendApiKey ?? undefined,
    smtpUrl: smtpUrl ?? undefined,
  };
}

export function isEmailConfigured() {
  return emailSettings().provider !== "none";
}

export function siteUrl() {
  const configured =
    env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  let url = (configured || siteConfig.url).replace(/\/$/, "");
  // Never emit localhost recovery links from production / Vercel builds
  // (Supabase dashboard Site URL is often still http://localhost:3000).
  if (
    (process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production") &&
    /localhost|127\.0\.0\.1/i.test(url)
  ) {
    url = siteConfig.url.replace(/\/$/, "");
  }
  return url;
}

export function isSupabaseConfigured() {
  // Prefer validated env, but also accept raw process.env in case values were
  // added after a stale build artifact / edge cold-start quirk.
  return Boolean(
    (env.SUPABASE_URL || process.env.SUPABASE_URL) &&
      (env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export function isCashfreeConfigured() {
  return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}
