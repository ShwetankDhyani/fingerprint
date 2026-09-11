import Link from "next/link";

import { inviteStaffAction } from "@/app/actions/portal";
import { FilterBar } from "@/components/portal/filter-bar";
import { EmptyState } from "@/components/portal/shell";
import { TeamProfileCard } from "@/components/portal/team-profile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPortalProfile, isAdminRole } from "@/lib/auth/session";
import { fetchStaffDirectory } from "@/lib/portal/data";

export const metadata = { title: "Team" };

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const me = await getPortalProfile();
  const canInvite = me ? isAdminRole(me.role) : false;
  const staff = await fetchStaffDirectory();

  const q = (sp.q ?? "").trim().toLowerCase();
  const roleFilter = sp.role ?? "";

  const profiles = staff.filter((row) => {
    if (roleFilter && String(row.role) !== roleFilter) return false;
    if (!q) return true;
    const hay = `${row.full_name ?? ""} ${row.email} ${row.role}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6eb4c8]">
            Panel team
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
            Team
          </h2>
        </div>
        <Link
          href="/admin/inbox?channel=team"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6eb4c8] transition-colors hover:text-[#9ad0de]"
        >
          Team messages →
        </Link>
      </header>

      {canInvite ? (
        <section className="space-y-3 rounded-xl border border-[#1a2a2e] bg-[#0e1618]/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6eb4c8]">
            Invite teammate
          </p>
          <form
            action={inviteStaffAction}
            className="grid gap-2 sm:grid-cols-4"
          >
            <Input name="email" type="email" required placeholder="Email" />
            <Input name="fullName" placeholder="Full name" />
            <select
              name="role"
              defaultValue="ADMIN"
              className="h-9 rounded-md border border-[#24302b] bg-[#0b1210] px-2 text-sm"
            >
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
            <Button
              type="submit"
              size="sm"
              className="bg-[#6eb4c8] text-[#071216] hover:bg-[#82c4d4]"
            >
              Send invite
            </Button>
          </form>
        </section>
      ) : null}

      <FilterBar
        basePath="/admin/team"
        placeholder="Search name, email, role…"
        resultCount={profiles.length}
        selects={[
          {
            name: "role",
            label: "Role",
            emptyLabel: "All roles",
            options: [
              { value: "SUPER_ADMIN", label: "Super Admin" },
              { value: "ADMIN", label: "Admin" },
              { value: "STAFF", label: "Staff" },
            ],
          },
        ]}
      />

      {profiles.length === 0 ? (
        <EmptyState
          title="No teammates found"
          body={
            q || roleFilter
              ? "Try a different search or role filter."
              : "Invite an admin or staff member to build the panel team."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {profiles.map((member) => (
            <li key={String(member.id)}>
              <TeamProfileCard
                member={{
                  id: String(member.id),
                  full_name: member.full_name as string | null,
                  email: String(member.email),
                  role: String(member.role),
                  account_status: member.account_status as string | null,
                  last_login_at: member.last_login_at as string | null,
                  created_at: member.created_at as string | null,
                  isYou: me?.id === String(member.id),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
