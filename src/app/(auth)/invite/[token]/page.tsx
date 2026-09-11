import Link from "next/link";

import { AcceptInviteForm } from "@/components/portal/auth-form";
import { LynxLogo } from "@/components/brand/lynx-logo";

export const metadata = { title: "Accept invite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0b1210] px-4 text-[#e8eee9]">
      <div className="w-full max-w-md rounded-xl border border-[#24302b] bg-[#121a17] p-6">
        <LynxLogo href="/" size="md" />
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl">
          Activate your portal
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          Set a password to join your organization workspace.
        </p>
        <div className="mt-6">
          <AcceptInviteForm token={token} />
        </div>
        <p className="mt-6 text-center text-xs text-[#9aaba2]">
          <Link href="/login" className="underline-offset-4 hover:underline">
            Already activated? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
