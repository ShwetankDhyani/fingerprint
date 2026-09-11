import { NextResponse } from "next/server";
import {
  isCashfreeConfigured,
  isEmailConfigured,
  isSupabaseConfigured,
} from "@/lib/env";

/** Public readiness probe — booleans only, no secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    cashfree: isCashfreeConfigured(),
    supabase: isSupabaseConfigured(),
    email: isEmailConfigured(),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  });
}
