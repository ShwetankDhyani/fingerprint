import Link from "next/link";

import { SignInForm } from "@/components/portal/auth-form";
import { LynxLogo } from "@/components/brand/lynx-logo";
import { isAuthConfigured } from "@/lib/auth/session";

export const metadata = { title: "Portal login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const params = await searchParams;
  const configured = isAuthConfigured();

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0b1210] px-4 text-[#e8eee9]">
      <div className="w-full max-w-md rounded-xl border border-[#24302b] bg-[#121a17] p-6 shadow-[0_0_0_1px_rgba(176,141,31,0.08)]">
        <LynxLogo href="/" size="md" />
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl">
          Portal access
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          One login for Lynx staff and client organizations.
        </p>
        {params.reason === "dormant" ? (
          <p className="mt-4 rounded-md border border-[#b08d1f]/40 bg-[#b08d1f]/10 px-3 py-2 font-mono text-xs text-[#d4b45a]">
            This login is dormant. Project and billing records are kept — contact
            Lynx if you need access restored.
          </p>
        ) : null}
        {!configured || params.reason === "auth-unconfigured" ? (
          <p className="mt-4 rounded-md border border-[#b08d1f]/40 bg-[#b08d1f]/10 px-3 py-2 font-mono text-xs text-[#d4b45a]">
            Auth is not configured in this environment. Set
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run
            supabase/portal_schema.sql.
          </p>
        ) : (
          <div className="mt-6">
            <SignInForm />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-[#9aaba2]">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Back to lynxweb.in
          </Link>
        </p>
      </div>
    </div>
  );
}
