import Link from "next/link";

import { RequestPasswordResetForm } from "@/components/portal/auth-form";
import { LynxLogo } from "@/components/brand/lynx-logo";
import { isAuthConfigured } from "@/lib/auth/session";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const configured = isAuthConfigured();
  const params = await searchParams;
  const linkInvalid = params.error === "reset-link-invalid";

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0b1210] px-4 text-[#e8eee9]">
      <div className="w-full max-w-md rounded-xl border border-[#24302b] bg-[#121a17] p-6 shadow-[0_0_0_1px_rgba(176,141,31,0.08)]">
        <LynxLogo href="/" size="md" />
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          Enter any email that appears on the Lynx client list or team list.
          If it&apos;s listed, we&apos;ll email a one-time link to set or reset
          your password — even if the old login was removed.
        </p>
        {linkInvalid ? (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-300">
            That reset link is invalid or has expired. Request a new one below.
          </p>
        ) : null}
        {!configured ? (
          <p className="mt-4 rounded-md border border-[#b08d1f]/40 bg-[#b08d1f]/10 px-3 py-2 font-mono text-xs text-[#d4b45a]">
            Auth is not configured in this environment.
          </p>
        ) : (
          <div className="mt-6">
            <RequestPasswordResetForm />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-[#9aaba2]">
          <Link href="/login" className="underline-offset-4 hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
