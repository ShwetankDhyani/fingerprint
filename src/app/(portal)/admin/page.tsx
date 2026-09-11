import Link from "next/link";
import type { ReactNode } from "react";

import { ActivityPanel } from "@/components/portal/activity-panel";
import { GlanceTile, Meter } from "@/components/portal/glance";
import { EmptyState } from "@/components/portal/shell";
import { buttonVariants } from "@/components/ui/button";
import { fetchAdminDashboard } from "@/lib/portal/data";
import { fetchAdminTriage, type TriageItem } from "@/lib/portal/triage";
import { formatDateTime, formatInr } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

const SEVERITY: Record<TriageItem["severity"], { dot: string; text: string }> = {
  hot: { dot: "#c07060", text: "text-[#e08a78]" },
  warn: { dot: "#d4b45a", text: "text-[#d4b45a]" },
  calm: { dot: "#6eb4c8", text: "text-[#9aaba2]" },
};

function TriageRow({ item }: { item: TriageItem }) {
  const tone = SEVERITY[item.severity];
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#121a17]"
      >
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ background: tone.dot }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#e8eee9]">{item.who}</p>
          <p className="truncate text-xs text-[#9aaba2]">{item.what}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f6f68]">
            {item.at ? formatDateTime(item.at) : "No date"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {item.amountMinor ? (
            <p className="font-mono text-sm text-[#d4b45a]">
              {formatInr(Number(item.amountMinor))}
            </p>
          ) : null}
          {item.badge ? (
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.1em]",
                tone.text,
              )}
            >
              {item.badge}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function TriageLane({
  title,
  hint,
  accent,
  items,
  emptyBody,
  href,
  hrefLabel,
  limit = 6,
}: {
  title: string;
  hint: string;
  accent: string;
  items: TriageItem[];
  emptyBody: string;
  href: string;
  hrefLabel: string;
  limit?: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#1c2622] bg-[#0d1411]/80">
      <div className="flex items-start justify-between gap-3 border-b border-[#1c2622] px-4 py-3">
        <div className="min-w-0">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            {title}
            <span className="ml-2 text-[#9aaba2]">{items.length}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#7a8a83]">{hint}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
        >
          {hrefLabel} →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#5f6f68]">{emptyBody}</p>
      ) : (
        <ul className="divide-y divide-[#1c2622]">
          {items.slice(0, limit).map((item) => (
            <TriageRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      {items.length > limit ? (
        <Link
          href={href}
          className="block border-t border-[#1c2622] px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] hover:text-[#d4b45a]"
        >
          {items.length - limit} more
        </Link>
      ) : null}
    </section>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      {children}
    </header>
  );
}

export default async function AdminHomePage() {
  const [data, triage] = await Promise.all([
    fetchAdminDashboard(),
    fetchAdminTriage(),
  ]);

  const attention =
    triage.totals.replies + triage.totals.decisions + triage.moneyDue.length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Header>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d4b45a]">
            Admin
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
            Today
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[#9aaba2]">
            {attention === 0
              ? "Nothing is waiting on you. Delivery is the only thing moving."
              : `${attention} thing${attention === 1 ? "" : "s"} need you — replies first, then decisions, then money.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/leads?status=new"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            New leads
          </Link>
          <Link
            href="/admin/invoices?status=overdue"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Overdue
          </Link>
          <Link href="/admin/tickets" className={cn(buttonVariants())}>
            Tickets
          </Link>
        </div>
      </Header>

      {!data.configured ? (
        <EmptyState
          title="Portal database not connected"
          body="Run the portal schema in Supabase and set SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY."
        />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <GlanceTile
          href="/admin/invoices?status=overdue"
          eyebrow="Money coming due"
          value={formatInr(triage.totals.moneyMinor)}
          hint={`${triage.moneyDue.length} invoice${
            triage.moneyDue.length === 1 ? "" : "s"
          } due or overdue`}
          accent="#d4b45a"
          glow="#d4b45a55"
          meter={
            <Meter
              segments={[
                {
                  pct: triage.moneyDue.filter((i) => i.severity === "hot").length,
                  color: "#c07060",
                  label: `Overdue ${triage.moneyDue.filter((i) => i.severity === "hot").length}`,
                },
                {
                  pct: triage.moneyDue.filter((i) => i.severity !== "hot").length,
                  color: "#d4b45a",
                  label: `Due soon ${triage.moneyDue.filter((i) => i.severity !== "hot").length}`,
                },
              ]}
            />
          }
        />
        <GlanceTile
          href="/admin/tickets"
          eyebrow="Needs a reply"
          value={String(triage.totals.replies)}
          unit="waiting"
          hint="Leads, tickets and client messages with the ball in our court"
          accent="#c4a06a"
          glow="#c4a06a55"
        />
        <GlanceTile
          href="/admin/projects"
          eyebrow="In delivery"
          value={String(triage.totals.live)}
          unit="live"
          hint={`${
            triage.inDelivery.filter((i) => i.severity === "hot").length
          } with overdue milestones`}
          accent="#6eb4c8"
          glow="#6eb4c855"
        />
      </div>

      {data.needsAttention.length > 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
            Delivery problems
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.needsAttention.slice(0, 3).map((item) => (
              <li key={item.title} className="text-sm text-[#d4dcd6]">
                <span className="font-medium">{item.title}</span>
                <span className="text-[#9aaba2]"> — {item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TriageLane
          title="Needs a reply"
          hint="New enquiries and conversations where the client spoke last."
          accent="#c4a06a"
          items={triage.needsReply}
          emptyBody="Every enquiry and message has been answered."
          href="/admin/leads"
          hrefLabel="Leads"
        />
        <TriageLane
          title="Needs a decision"
          hint="Quotes sitting in draft, going stale, or accepted without an invoice."
          accent="#7eb8a8"
          items={triage.needsDecision}
          emptyBody="No quotes are waiting on us."
          href="/admin/quotes"
          hrefLabel="Quotes"
        />
        <TriageLane
          title="Money coming due"
          hint="Balances past their date or landing within a week."
          accent="#d4b45a"
          items={triage.moneyDue}
          emptyBody="Nothing due in the next seven days."
          href="/admin/invoices?status=overdue"
          hrefLabel="Invoices"
        />
        <TriageLane
          title="In delivery"
          hint="Live projects, loudest first when milestones slip."
          accent="#6eb4c8"
          items={triage.inDelivery}
          emptyBody="No projects are currently in delivery."
          href="/admin/projects"
          hrefLabel="Projects"
        />
      </div>

      <ActivityPanel
        lines={data.activity.map((row) => ({
          ts: row.ts,
          text: row.text,
          action: row.action,
          entityType: row.entityType,
        }))}
      />
    </div>
  );
}
