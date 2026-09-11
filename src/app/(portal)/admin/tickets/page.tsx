import { BoardRow } from "@/components/portal/board-row";
import { FilterBar } from "@/components/portal/filter-bar";
import {
  GlanceTile,
  Meter,
  StageStrip,
  VisualEmpty,
} from "@/components/portal/glance";
import { fetchTickets } from "@/lib/portal/data";
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";

export const metadata = { title: "Support tickets" };

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#c07060",
  high: "#d4b45a",
  normal: "#6eb4c8",
  low: "#5f6f68",
};

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tickets = await fetchTickets(undefined, {
    q: sp.q,
    status: sp.status,
    priority: sp.priority,
  });

  const open = tickets.filter((t) =>
    ["open", "pending"].includes(String(t.status)),
  ).length;
  const pending = tickets.filter((t) => String(t.status) === "pending").length;
  const urgent = tickets.filter(
    (t) => String(t.priority) === "urgent" && String(t.status) !== "closed",
  ).length;
  const high = tickets.filter(
    (t) =>
      ["high", "urgent"].includes(String(t.priority)) &&
      String(t.status) !== "closed",
  ).length;

  const byStatus = (status: string) =>
    tickets.filter((t) => String(t.status) === status).length;
  const byPriority = (priority: string) =>
    tickets.filter(
      (t) =>
        String(t.priority) === priority && String(t.status) !== "closed",
    ).length;

  const stageHref = (key: "status" | "priority", value?: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (key === "status") {
      if (value) params.set("status", value);
      if (sp.priority) params.set("priority", sp.priority);
    } else {
      if (sp.status) params.set("status", sp.status);
      if (value) params.set("priority", value);
    }
    const qs = params.toString();
    return qs ? `/admin/tickets?${qs}` : "/admin/tickets";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c4a06a]">
          Support
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">
          Tickets
        </h2>
        <p className="mt-1 text-sm text-[#9aaba2]">
          Heat first — urgent dots, then who is waiting on whom.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <GlanceTile
          href={stageHref("status", "open")}
          eyebrow="Open"
          value={String(open)}
          unit="live"
          hint={`${byStatus("open")} new · ${pending} awaiting client`}
          accent="#c4a06a"
          glow="#c4a06a55"
          meter={
            <Meter
              segments={[
                {
                  pct: byStatus("open"),
                  color: "#c07060",
                  label: `Open ${byStatus("open")}`,
                },
                {
                  pct: pending,
                  color: "#d4b45a",
                  label: `Waiting ${pending}`,
                },
                {
                  pct: byStatus("resolved"),
                  color: "#5ecf9a",
                  label: `Resolved ${byStatus("resolved")}`,
                },
              ]}
            />
          }
        />
        <GlanceTile
          href={stageHref("priority", "urgent")}
          eyebrow="Urgent"
          value={String(urgent)}
          unit="hot"
          hint={urgent === 0 ? "No fires" : "Jump these first"}
          accent="#c07060"
          glow="#c0706055"
        />
        <GlanceTile
          href={stageHref("priority", "high")}
          eyebrow="Elevated"
          value={String(high)}
          unit="prio"
          hint={`${byPriority("high")} high · ${byPriority("urgent")} urgent`}
          accent="#6eb4c8"
          glow="#6eb4c855"
          meter={
            <Meter
              segments={[
                {
                  pct: byPriority("urgent"),
                  color: "#c07060",
                  label: `Urgent ${byPriority("urgent")}`,
                },
                {
                  pct: byPriority("high"),
                  color: "#d4b45a",
                  label: `High ${byPriority("high")}`,
                },
                {
                  pct: byPriority("normal"),
                  color: "#6eb4c8",
                  label: `Normal ${byPriority("normal")}`,
                },
                {
                  pct: byPriority("low"),
                  color: "#5f6f68",
                  label: `Low ${byPriority("low")}`,
                },
              ]}
            />
          }
        />
      </div>

      <StageStrip
        stages={[
          {
            key: "all",
            label: "All",
            count: tickets.length,
            href: "/admin/tickets",
            color: "#9aaba2",
            active: !sp.status && !sp.priority,
          },
          {
            key: "open",
            label: "Open",
            count: byStatus("open"),
            href: stageHref("status", "open"),
            color: "#c07060",
            active: sp.status === "open",
          },
          {
            key: "pending",
            label: "Waiting",
            count: pending,
            href: stageHref("status", "pending"),
            color: "#d4b45a",
            active: sp.status === "pending",
          },
          {
            key: "urgent",
            label: "Urgent",
            count: byPriority("urgent"),
            href: stageHref("priority", "urgent"),
            color: "#c07060",
            active: sp.priority === "urgent",
          },
          {
            key: "resolved",
            label: "Done",
            count: byStatus("resolved") + byStatus("closed"),
            href: stageHref("status", "resolved"),
            color: "#5ecf9a",
            active: sp.status === "resolved" || sp.status === "closed",
          },
        ]}
      />

      <FilterBar
        basePath="/admin/tickets"
        placeholder="Search ticket number, subject, client, email or phone…"
        resultCount={tickets.length}
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All statuses",
            options: [
              { value: "open", label: "Open" },
              { value: "pending", label: "Awaiting client" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ],
          },
          {
            name: "priority",
            label: "Priority",
            emptyLabel: "All priorities",
            options: [
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ],
          },
        ]}
      />

      {tickets.length === 0 ? (
        <VisualEmpty
          title="Inbox is quiet"
          body="Clients raise tickets from their portal under Support. Everything lands here with an email to the team."
          steps={[
            {
              label: "Client writes",
              detail: "Portal Support form creates the thread.",
              color: "#c4a06a",
            },
            {
              label: "You see heat",
              detail: "Urgent and high light up this board.",
              color: "#c07060",
            },
            {
              label: "Reply",
              detail: "Answer in-thread — client gets the email.",
              color: "#6eb4c8",
            },
          ]}
        />
      ) : (
        <ul className="divide-y divide-[#1c2622] overflow-hidden rounded-2xl border border-[#1c2622] bg-[#0d1411]/70">
          {tickets.map((ticket) => {
            const org = ticket.organizations as { name?: string } | null;
            const project = ticket.projects as { name?: string } | null;
            const replies =
              ((ticket.messages as Array<unknown>) ?? []).length || 0;
            return (
              <BoardRow
                key={ticket.id}
                href={`/admin/tickets/${ticket.id}`}
                title={String(ticket.subject)}
                subtitle={[
                  String(ticket.ticket_number ?? "Ticket"),
                  org?.name,
                  project?.name,
                ]
                  .filter(Boolean)
                  .join(" \u00b7 ")}
                meta={`${labelOf(
                  TICKET_PRIORITY_LABEL,
                  String(ticket.priority),
                )} \u00b7 ${String(ticket.category)} \u00b7 ${replies} message${
                  replies === 1 ? "" : "s"
                }`}
                statusLabel={labelOf(
                  TICKET_STATUS_LABEL,
                  String(ticket.status),
                )}
                statusColor={
                  PRIORITY_COLOR[String(ticket.priority)] ?? "#6eb4c8"
                }
                at={
                  (ticket.last_reply_at as string) ??
                  (ticket.updated_at as string)
                }
                atLabel="last reply"
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
