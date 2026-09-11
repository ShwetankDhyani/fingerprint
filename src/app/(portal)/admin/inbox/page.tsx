import Link from "next/link";

import {
  postMessageAction,
  startClientThreadAction,
  startTeamThreadAction,
  deleteThreadAction,
} from "@/app/actions/portal";
import {
  ChatThread,
  type ChatMessageData,
} from "@/components/portal/chat-message";
import { EmptyState } from "@/components/portal/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isSuperAdminRole, requireStaff } from "@/lib/auth/session";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";
import {
  fetchOrganizations,
  fetchStaffDirectory,
  fetchThreads,
} from "@/lib/portal/data";
import { relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages" };

type Channel = "clients" | "team";

const CHANNEL = {
  clients: {
    id: "clients" as const,
    label: "Clients",
    eyebrow: "Client channel",
    startLabel: "Message a client",
    listLabel: "Client conversations",
    emptyTitle: "No client chats yet",
    emptyBody:
      "Start a conversation with a client, or wait for a project thread.",
    pickBody: "Choose a client conversation from the list.",
    replyPlaceholder: "Reply to client…",
    accent: "#d4b45a",
    accentSoft: "rgba(212, 180, 90, 0.14)",
    accentBorder: "rgba(212, 180, 90, 0.38)",
    accentMuted: "#b08d1f",
    surface: "rgba(212, 180, 90, 0.05)",
    ring: "ring-[#d4b45a]/30",
    badge: "Visible to client",
    badgeTone: "text-[#d4b45a] bg-[#d4b45a]/12 border-[#d4b45a]/35",
    tabActive: "bg-[#d4b45a] text-[#0b1210]",
    buttonClass:
      "bg-[#d4b45a] text-[#0b1210] hover:bg-[#e0c46a] border-transparent",
  },
  team: {
    id: "team" as const,
    label: "Team",
    eyebrow: "Panel team",
    startLabel: "Message an admin",
    listLabel: "Team channels",
    emptyTitle: "No team chats yet",
    emptyBody: "Message another admin from the directory above.",
    pickBody: "Choose a teammate or an existing team channel.",
    replyPlaceholder: "Message your teammate…",
    accent: "#6eb4c8",
    accentSoft: "rgba(110, 180, 200, 0.14)",
    accentBorder: "rgba(110, 180, 200, 0.42)",
    accentMuted: "#5a9aab",
    surface: "rgba(110, 180, 200, 0.06)",
    ring: "ring-[#6eb4c8]/35",
    badge: "Staff only · internal",
    badgeTone: "text-[#6eb4c8] bg-[#6eb4c8]/12 border-[#6eb4c8]/40",
    tabActive: "bg-[#6eb4c8] text-[#071216]",
    buttonClass:
      "bg-[#6eb4c8] text-[#071216] hover:bg-[#82c4d4] border-transparent",
  },
} as const;

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff();
  const isSuperAdmin = isSuperAdminRole(profile.role);
  const sp = await searchParams;
  const channel: Channel = sp.channel === "team" ? "team" : "clients";
  const theme = CHANNEL[channel];

  const [clientThreads, teamThreads, staff, orgs] = await Promise.all([
    fetchThreads(undefined, { channel: "clients" }),
    fetchThreads(undefined, { channel: "team" }),
    fetchStaffDirectory(),
    fetchOrganizations(),
  ]);

  const threads = channel === "team" ? teamThreads : clientThreads;
  const selectedId = sp.thread || threads[0]?.id;
  const selected =
    threads.find((thread) => String(thread.id) === String(selectedId)) ?? null;

  const messages = ((selected?.messages as Array<Record<string, unknown>>) ?? [])
    .map((message) => ({
      id: String(message.id),
      body: String(message.body ?? ""),
      created_at: String(message.created_at ?? ""),
      author_id: message.author_id ? String(message.author_id) : null,
      internal_only: Boolean(message.internal_only),
      profiles: (message.profiles as ChatMessageData["profiles"]) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const teammates = staff.filter(
    (row) =>
      String(row.id) !== profile.id &&
      String(row.account_status ?? "active") !== "dormant",
  );

  const clientOrgs = orgs.filter(
    (org) => String((org as { slug?: string }).slug) !== "lynx-studio",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
            Messages
          </h2>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{
              color: theme.accent,
              borderColor: theme.accentBorder,
              background: theme.accentSoft,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: theme.accent }}
              aria-hidden
            />
            {theme.eyebrow}
          </div>
        </div>

        <div className="flex rounded-xl border border-[#24302b] bg-[#0b1210] p-1">
          {(
            [
              {
                id: "clients" as const,
                label: "Clients",
                count: clientThreads.length,
              },
              {
                id: "team" as const,
                label: "Team",
                count: teamThreads.length,
              },
            ] as const
          ).map((tab) => {
            const tabTheme = CHANNEL[tab.id];
            const active = channel === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/admin/inbox?channel=${tab.id}`}
                className={cn(
                  "rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                  active
                    ? tabTheme.tabActive
                    : "text-[#7a8a83] hover:text-[#c8d3cd]",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5",
                    active ? "opacity-70" : "text-[#5f6f68]",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          {channel === "team" ? (
            <section
              className="space-y-3 rounded-xl border p-3"
              style={{
                borderColor: theme.accentBorder,
                background: theme.surface,
              }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: theme.accentMuted }}
              >
                {theme.startLabel}
              </p>
              {teammates.length === 0 ? (
                <p className="text-xs text-[#5f6f68]">No other staff online.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto">
                  {teammates.map((peer) => (
                    <li key={String(peer.id)}>
                      <form
                        action={startTeamThreadAction}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="peerId"
                          value={String(peer.id)}
                        />
                        <button
                          type="submit"
                          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#121a17]"
                        >
                          <p className="truncate text-sm font-medium">
                            {String(peer.full_name || peer.email)}
                          </p>
                          <p className="truncate font-mono text-[10px] text-[#7a8a83]">
                            {String(peer.role)} · {String(peer.email)}
                          </p>
                        </button>
                        <Button
                          type="submit"
                          size="sm"
                          className={theme.buttonClass}
                        >
                          Message
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section
              className="space-y-3 rounded-xl border p-3"
              style={{
                borderColor: theme.accentBorder,
                background: theme.surface,
              }}
            >
              <p
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: theme.accentMuted }}
              >
                {theme.startLabel}
              </p>
              <form action={startClientThreadAction} className="space-y-2">
                <select
                  name="organizationId"
                  required
                  className="h-9 w-full rounded-md border border-[#24302b] bg-[#0b1210] px-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose client…
                  </option>
                  {clientOrgs.map((org) => (
                    <option key={String(org.id)} value={String(org.id)}>
                      {String(org.name)}
                    </option>
                  ))}
                </select>
                <Input
                  name="subject"
                  placeholder="Subject (optional)"
                  className="border-[#24302b] bg-[#0b1210]"
                />
                <Textarea
                  name="body"
                  rows={3}
                  placeholder="First message…"
                  className="border-[#24302b] bg-[#0b1210]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className={cn("w-full", theme.buttonClass)}
                >
                  Start conversation
                </Button>
              </form>
            </section>
          )}

          <section className="space-y-2">
            <p
              className="font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: theme.accentMuted }}
            >
              {theme.listLabel}
            </p>
            {threads.length === 0 ? (
              <EmptyState title={theme.emptyTitle} body={theme.emptyBody} />
            ) : (
              <ul
                className="divide-y overflow-hidden rounded-lg border"
                style={{
                  borderColor: theme.accentBorder,
                  borderLeftWidth: 3,
                  borderLeftColor: theme.accent,
                }}
              >
                {threads.map((thread) => {
                  const org = thread.organizations as { name?: string } | null;
                  const active = String(thread.id) === String(selected?.id);
                  return (
                    <li key={String(thread.id)} className="border-[#24302b]">
                      <Link
                        href={`/admin/inbox?channel=${channel}&thread=${thread.id}`}
                        className={cn(
                          "block px-3 py-2.5 transition-colors hover:bg-[#121a17]",
                          active && cn("bg-[#121a17] ring-1 ring-inset", theme.ring),
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                              theme.badgeTone,
                            )}
                          >
                            {channel === "team" ? "Team" : "Client"}
                          </span>
                          <span className="truncate font-mono text-[10px] text-[#7a8a83]">
                            {relativeTime(String(thread.updated_at))}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium">
                          {String(thread.subject)}
                        </p>
                        <p className="truncate font-mono text-[10px] text-[#9aaba2]">
                          {channel === "team"
                            ? "Panel staff"
                            : (org?.name ?? "Client")}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>

        <section
          className="space-y-3 rounded-xl border p-4"
          style={{
            borderColor: theme.accentBorder,
            background: `linear-gradient(180deg, ${theme.surface} 0%, transparent 42%)`,
          }}
        >
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{String(selected.subject)}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a8a83]">
                    {channel === "team"
                      ? "Internal channel"
                      : ((selected.organizations as { name?: string } | null)
                          ?.name ?? "Client")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                      theme.badgeTone,
                    )}
                  >
                    {theme.badge}
                  </span>
                  {isSuperAdmin ? (
                    <SuperAdminDeleteButton
                      action={deleteThreadAction}
                      entityLabel="conversation"
                      consequence="All messages in this thread are removed."
                      hidden={{
                        threadId: String(selected.id),
                        returnTo: `/admin/inbox?channel=${channel}`,
                      }}
                      buttonLabel="Delete conversation"
                    />
                  ) : null}
                </div>
              </div>
              <div className="max-h-[28rem] overflow-auto">
                <ChatThread
                  messages={messages}
                  perspective="staff"
                  currentUserId={profile.id}
                />
              </div>
              <form
                action={postMessageAction}
                className="space-y-2 rounded-lg border p-3"
                style={{
                  borderColor: theme.accentBorder,
                  background: theme.accentSoft,
                }}
              >
                <input
                  type="hidden"
                  name="threadId"
                  value={String(selected.id)}
                />
                <Textarea
                  name="body"
                  required
                  rows={3}
                  placeholder={theme.replyPlaceholder}
                  className="border-[#24302b] bg-[#0b1210]"
                />
                {channel === "clients" ? (
                  <label className="flex items-center gap-2 text-xs text-[#9aaba2]">
                    <input type="checkbox" name="internalOnly" />
                    Internal note (staff only — client won’t see this)
                  </label>
                ) : (
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: theme.accentMuted }}
                  >
                    Private to the panel — clients never see this channel
                  </p>
                )}
                <Button type="submit" size="sm" className={theme.buttonClass}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <EmptyState title="Pick a conversation" body={theme.pickBody} />
          )}
        </section>
      </div>
    </div>
  );
}
