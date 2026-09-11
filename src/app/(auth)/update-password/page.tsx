import Link from "next/link";

import { UpdatePasswordForm } from "@/components/portal/auth-form";
import { LynxLogo } from "@/components/brand/lynx-logo";

export const metadata = { title: "Choose a new password" };

export default function UpdatePasswordPage() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0b1210] px-4 text-[#e8eee9]">
      <div className="w-full max-w-md rounded-xl border border-[#24302b] bg-[#121a17] p-6 shadow-[0_0_0_1px_rgba(176,141,31,0.08)]">
        <LynxLogo href="/" size="md" />
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          You&apos;re signed in via the reset link. Set a password you&apos;ll
          remember — at least 8 characters.
        </p>
        <div className="mt-6">
          <UpdatePasswordForm />
        </div>
        <p className="mt-6 text-center text-xs text-[#9aaba2]">
          <Link href="/login" className="underline-offset-4 hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
