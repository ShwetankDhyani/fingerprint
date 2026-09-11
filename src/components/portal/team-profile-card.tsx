import Link from "next/link";

import { ClientAvatar, clientPalette } from "@/components/portal/client-avatar";
import { relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export type TeamProfileSummary = {
  id: string;
  full_name?: string | null;
  email: string;
  role: string;
  account_status?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  isYou?: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
};

export function teamRoleLabel(role: string) {
  return ROLE_LABEL[role] ?? role;
}

export function TeamProfileCard({ member }: { member: TeamProfileSummary }) {
  const name = member.full_name?.trim() || member.email;
  const palette = clientPalette(name);
  const dormant = member.account_status === "dormant";

  return (
    <Link
      href={`/admin/team/${member.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border transition-all duration-200",
        dormant
          ? "border-[#3a3020] opacity-75"
          : "border-[#1a2a2e] hover:border-[#6eb4c8]/40 hover:bg-[#10181a]",
      )}
      style={{
        background: dormant
          ? "linear-gradient(135deg, #1a1810 0%, #0d1411 60%)"
          : `linear-gradient(135deg, ${palette.from}66, #0c1416 58%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-45"
        style={{ background: dormant ? "#b08d1f" : "#6eb4c8" }}
      />
      <div className="relative flex gap-4 p-5">
        <ClientAvatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-[family-name:var(--font-syne)] text-lg tracking-tight text-[#f0f4f1]">
              {name}
            </h3>
            <span className="rounded border border-[#6eb4c8]/35 bg-[#6eb4c8]/12 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6eb4c8]">
              {teamRoleLabel(member.role)}
            </span>
            {member.isYou ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7a8a83]">
                You
              </span>
            ) : null}
            {dormant ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#d4b45a]">
                Dormant
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-[#9aaba2]">
            {member.email}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#7a8a83]">
            <span>
              <span className="text-[#5f6f68]">Last seen</span>{" "}
              <span className="text-[#c8d3cd]">
                {member.last_login_at
                  ? relativeTime(member.last_login_at)
                  : "—"}
              </span>
            </span>
            {member.created_at ? (
              <span className="text-[#5f6f68]">
                joined {relativeTime(member.created_at)}
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 self-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors group-hover:text-[#6eb4c8]">
          Open →
        </span>
      </div>
    </Link>
  );
}
