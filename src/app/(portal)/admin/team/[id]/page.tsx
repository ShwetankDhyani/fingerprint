import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteUserAction,
  setMemberDormantAction,
  startTeamThreadAction,
} from "@/app/actions/portal";
import { ActivityFeed } from "@/components/portal/activity-feed";
import { ClientAvatar } from "@/components/portal/client-avatar";
import { CopyField } from "@/components/portal/copy-field";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";
import { teamRoleLabel } from "@/components/portal/team-profile-card";
import { Button } from "@/components/ui/button";
import {
  getPortalProfile,
  isAdminRole,
  isSuperAdminRole,
} from "@/lib/auth/session";
import { fetchStaffMemberProfile } from "@/lib/portal/data";
import { formatDate, formatInr, relativeTime } from "@/lib/portal/utils";

export const metadata = { title: "Teammate" };

const QUOTE_STATUS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  opened: "Opened",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export default async function AdminTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await fetchStaffMemberProfile(id);
  const member = profile.member;
  if (!member) redirect("/admin/team");

  const me = await getPortalProfile();
  const isYou = me?.id === String(member.id);
  const canManage = me ? isAdminRole(me.role) : false;
  const isSuperAdmin = me ? isSuperAdminRole(me.role) : false;
  const dormant = member.account_status === "dormant";
  const name = String(member.full_name || member.email);
  const phone = member.phone ? String(member.phone) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#1a2a2e] bg-[#0e1618]/90 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-[#6eb4c8]/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-4">
          <ClientAvatar name={name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
                {name}
              </h2>
              <span className="rounded border border-[#6eb4c8]/35 bg-[#6eb4c8]/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6eb4c8]">
                {teamRoleLabel(String(member.role))}
              </span>
              {isYou ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a8a83]">
                  You
                </span>
              ) : null}
              {dormant ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#d4b45a]">
                  Dormant
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <CopyField value={String(member.email)} label="Email" />
              {phone ? <CopyField value={phone} label="Phone" /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#7a8a83]">
              <span>
                <span className="text-[#5f6f68]">Last seen</span>{" "}
                <span className="text-[#c8d3cd]">
                  {member.last_login_at
                    ? relativeTime(String(member.last_login_at))
                    : "—"}
                </span>
              </span>
              <span>
                <span className="text-[#5f6f68]">Joined</span>{" "}
                <span className="text-[#c8d3cd]">
                  {member.created_at
                    ? formatDate(String(member.created_at))
                    : "—"}
                </span>
              </span>
              {dormant && member.dormant_at ? (
                <span>
                  <span className="text-[#5f6f68]">Dormant since</span>{" "}
                  <span className="text-[#d4b45a]">
                    {formatDate(String(member.dormant_at))}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/admin/team"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors hover:text-[#6eb4c8]"
            >
              ← Team
            </Link>
            {!isYou ? (
              <form action={startTeamThreadAction}>
                <input type="hidden" name="peerId" value={String(member.id)} />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#6eb4c8] text-[#071216] hover:bg-[#82c4d4]"
                >
                  Message
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Actions · 30d",
            value: String(profile.stats.actions30d),
            hint: "Logged panel actions",
          },
          {
            label: "Quotes",
            value: String(profile.stats.quotes),
            hint: "Authored",
          },
          {
            label: "Messages",
            value: String(profile.stats.messages),
            hint: "Sent in threads",
          },
          {
            label: "Invites",
            value: String(profile.stats.invites),
            hint: "People invited",
          },
          {
            label: "Snapshots",
            value: String(profile.stats.snapshots),
            hint: "Project previews",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#1a2a2e] bg-[#0e1618]/70 px-3 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
              {stat.label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-syne)] text-2xl tracking-tight text-[#e8f0ec]">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px] text-[#7a8a83]">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-[#1a2a2e] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6eb4c8]">
          Panel access
        </p>
        <p className="text-sm text-[#9aaba2]">
          {String(member.role) === "SUPER_ADMIN"
            ? "Full control — including hard deletes across the portal."
            : String(member.role) === "ADMIN"
              ? "Full panel ops except hard deletes. Can invite teammates and message clients."
              : "Panel staff access — projects, quotes, invoices, and client messaging."}
        </p>
        {dormant && member.dormant_reason ? (
          <p className="rounded-lg border border-[#3a3020] bg-[#1a1810]/60 px-3 py-2 text-xs text-[#d4b45a]">
            Dormant reason: {String(member.dormant_reason)}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h3 className="font-[family-name:var(--font-syne)] text-lg tracking-tight">
              Recent actions
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68]">
              {profile.activity.length} shown
            </span>
          </div>
          <ActivityFeed
            accent="teal"
            lines={profile.activity.map((row) => ({
              ts: row.ts,
              text: row.text,
              action: row.action,
              entityType: row.entityType,
              href: row.href,
            }))}
          />
        </section>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="font-[family-name:var(--font-syne)] text-lg tracking-tight">
                Quotes authored
              </h3>
              <Link
                href="/admin/quotes"
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] hover:text-[#6eb4c8]"
              >
                All quotes →
              </Link>
            </div>
            {profile.quotes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1a2a2e] px-4 py-6 text-center text-sm text-[#7a8a83]">
                No quotes authored yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#1a2a2e] overflow-hidden rounded-xl border border-[#1a2a2e]">
                {profile.quotes.map((quote) => {
                  const org = quote.organizations as { name?: string } | null;
                  return (
                    <li key={quote.id}>
                      <Link
                        href={`/admin/quotes/${quote.id}`}
                        className="flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-[#10181a]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[#e8f0ec]">
                            {quote.title}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[#7a8a83]">
                            {quote.quote_number}
                            {org?.name ? ` · ${org.name}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs text-[#c8d3cd]">
                            {formatInr(Number(quote.total_minor))}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f6f68]">
                            {QUOTE_STATUS[String(quote.status)] ??
                              String(quote.status)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="font-[family-name:var(--font-syne)] text-lg tracking-tight">
                Conversations
              </h3>
              <Link
                href="/admin/inbox"
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] hover:text-[#6eb4c8]"
              >
                Inbox →
              </Link>
            </div>
            {profile.threads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1a2a2e] px-4 py-6 text-center text-sm text-[#7a8a83]">
                No messages from this teammate yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#1a2a2e] overflow-hidden rounded-xl border border-[#1a2a2e]">
                {profile.threads.map((thread) => {
                  const href =
                    thread.channel === "tickets"
                      ? `/admin/tickets/${thread.id}`
                      : `/admin/inbox?channel=${thread.channel}&thread=${thread.id}`;
                  return (
                    <li key={thread.id}>
                      <Link
                        href={href}
                        className="block px-3 py-2.5 transition-colors hover:bg-[#10181a]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm text-[#e8f0ec]">
                            {thread.subject}
                          </p>
                          <span className="rounded border border-[#6eb4c8]/30 bg-[#6eb4c8]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6eb4c8]">
                            {thread.channel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#7a8a83]">
                          {thread.lastBody || "—"}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-[#5f6f68]">
                          {relativeTime(thread.updated_at)} · {thread.status}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {profile.invites.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-[family-name:var(--font-syne)] text-lg tracking-tight">
            Invites sent
          </h3>
          <ul className="divide-y divide-[#1a2a2e] overflow-hidden rounded-xl border border-[#1a2a2e]">
            {profile.invites.map((invite) => {
              const pending = !invite.accepted_at;
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#e8f0ec]">
                      {invite.full_name || invite.email}
                    </p>
                    <p className="font-mono text-[11px] text-[#7a8a83]">
                      {invite.email} · {invite.role}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[10px] uppercase tracking-[0.1em]">
                    {pending ? (
                      <span className="text-[#d4b45a]">Pending</span>
                    ) : (
                      <span className="text-[#6eb4c8]">Accepted</span>
                    )}
                    <p className="mt-0.5 normal-case tracking-normal text-[#5f6f68]">
                      {formatDate(
                        String(invite.accepted_at || invite.created_at),
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canManage && !isYou ? (
        <section className="flex flex-wrap gap-2 border-t border-[#1a2a2e] pt-4">
          <form action={setMemberDormantAction}>
            <input type="hidden" name="userId" value={String(member.id)} />
            <input
              type="hidden"
              name="dormant"
              value={dormant ? "false" : "true"}
            />
            {!dormant ? (
              <input
                type="hidden"
                name="reason"
                value="Panel access paused."
              />
            ) : null}
            <Button type="submit" size="sm" variant="outline">
              {dormant ? "Reactivate" : "Mark dormant"}
            </Button>
          </form>
          {isSuperAdmin && String(member.role) !== "SUPER_ADMIN" ? (
            <SuperAdminDeleteButton
              action={deleteUserAction}
              entityLabel="teammate"
              consequence={`Permanently deletes ${name} (${member.email}).`}
              hidden={{
                userId: String(member.id),
                returnTo: "/admin/team",
              }}
              buttonLabel="Delete user"
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
