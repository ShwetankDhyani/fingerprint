import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createServerSupabase } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/update-password";
  }
  return raw;
}

/**
 * Completes Supabase recovery / magic-link redirects.
 * Prefer Lynx-owned `token_hash` links so redirects never fall back to
 * Supabase's Site URL (often localhost in the dashboard).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));
  const origin = siteUrl() || url.origin;

  const supabase = await createServerSupabase();
  if (supabase) {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) {
        const fail = new URL("/forgot-password", origin);
        fail.searchParams.set("error", "reset-link-invalid");
        return NextResponse.redirect(fail);
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const fail = new URL("/forgot-password", origin);
        fail.searchParams.set("error", "reset-link-invalid");
        return NextResponse.redirect(fail);
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
