import Link from "next/link";

import { EntityPeek } from "@/components/portal/entity-peek";
import { ProjectMark } from "@/components/portal/project-card";
import { EmptyState } from "@/components/portal/shell";
import { buttonVariants } from "@/components/ui/button";
import { requireClient } from "@/lib/auth/session";
import { fetchClientDashboard } from "@/lib/portal/data";
import { PROJECT_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import {
  invoiceBalance,
  invoiceNeedsAction,
  invoicePeek,
  projectPeek,
  quoteNeedsAction,
  quotePeek,
} from "@/lib/portal/money";
import { resolveProjectTheme } from "@/lib/portal/project-theme";
import { formatInr, relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

export default async function ClientHomePage() {
  const profile = await requireClient();
  const data = await fetchClientDashboard(
    profile.organization_ids,
    profile.email,
  );

  const openQuotes = data.quotes.filter((q: { status?: string | null }) =>
    quoteNeedsAction(String(q.status)) && String(q.status) !== "draft",
  );
  const openBills = data.invoices.filter(
    (inv: {
      status?: string | null;
      total_minor?: number | null;
      amount_paid_minor?: number | null;
    }) =>
      invoiceNeedsAction(
        String(inv.status),
        invoiceBalance(inv.total_minor, inv.amount_paid_minor),
      ),
  );
  const openTickets = data.tickets.filter((t: { status?: string | null }) =>
    ["open", "pending"].includes(String(t.status)),
  );

  const firstName = profile.full_name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b08d1f]">
          Your Lynx space
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl md:text-3xl">
          Hello{firstName ? `, ${firstName}` : ""}
        </h2>
        </div>

      {!data.configured ? (
        <EmptyState
          title="Portal not connected yet"
          body="Your Lynx team is finishing setup. Projects, bills and progress will appear here."
        />
      ) : null}

      {(data.nextPayment || openQuotes.length > 0 || openTickets.length > 0) && (
        <section className="space-y-3">
          <h3 className="font-[family-name:var(--font-syne)] text-lg">
            Needs you
          </h3>
          <div className="space-y-2">
            {data.nextPayment ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#b08d1f]/45 bg-[#b08d1f]/10 px-4 py-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d4b45a]">
                    Bill to pay
                  </p>
                  <p className="mt-1 text-base">
                    {data.nextPayment.number} · {data.nextPayment.amount}
                    {data.nextPayment.due
                      ? ` · due ${data.nextPayment.due}`
                      : ""}
                  </p>
                </div>
                <Link href="/client/billing" className={cn(buttonVariants())}>
                  Pay now
                </Link>
              </div>
            ) : null}

            {openQuotes.slice(0, 3).map(
              (q: {
                id: string;
                quote_number: string;
                title: string;
                status: string;
                total_minor: number;
                share_token?: string | null;
              }) => {
                const href = `/q/${encodeURIComponent(String(q.quote_number))}`;
                return (
                  <EntityPeek key={q.id} data={quotePeek(q as never)}>
                    <Link
                      href={href}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#24302b] px-4 py-3 hover:bg-[#121a17]"
                    >
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
                          Quote to review
                        </p>
                        <p className="text-base font-medium">{q.title}</p>
                      </div>
                      <span className="font-mono text-sm text-[#d4b45a]">
                        {formatInr(Number(q.total_minor))}
                      </span>
                    </Link>
                  </EntityPeek>
                );
              },
            )}

            {openTickets.length > 0 ? (
              <Link
                href="/client/support"
                className="flex items-center justify-between rounded-lg border border-[#24302b] px-4 py-3 hover:bg-[#121a17]"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
                    Support
                  </p>
                  <p className="text-base">
                    {openTickets.length} open ticket
                    {openTickets.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-mono text-xs text-[#d4b45a]">
                  View →
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h3 className="font-[family-name:var(--font-syne)] text-lg">
            Your projects
          </h3>
          <Link
            href="/client/projects"
            className="font-mono text-xs text-[#9aaba2] underline-offset-4 hover:underline"
          >
            See all
          </Link>
        </div>
        {data.projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="When kickoff starts, your builds show up here."
          />
        ) : (
          <ul className="space-y-2">
            {data.projects.slice(0, 6).map((p: any) => {
              const theme = resolveProjectTheme(p);
              return (
                <li key={p.id} className="relative z-0 hover:z-20">
                  <EntityPeek data={projectPeek(p as never)}>
                    <Link
                      href={`/client/projects/${p.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-[#121a17]"
                      style={{
                        borderColor: `${theme.accent}40`,
                        background: `linear-gradient(135deg, ${theme.wash}, transparent 65%)`,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProjectMark
                          name={p.name}
                          code={p.code}
                          theme={theme}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium">
                            {p.name}
                          </p>
                          <p className="font-mono text-xs text-[#9aaba2]">
                            {p.code ?? "Project"}
                          </p>
                        </div>
                      </div>
                      <p
                        className="shrink-0 font-mono text-xs"
                        style={{ color: theme.accent }}
                      >
                        {labelOf(PROJECT_STATUS_LABEL, p.status)}
                      </p>
                    </Link>
                  </EntityPeek>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {openBills.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-[family-name:var(--font-syne)] text-lg">
            Open bills
          </h3>
          <ul className="space-y-2">
            {openBills.slice(0, 4).map(
              (inv: {
                id: string;
                invoice_number: string;
                status: string;
                total_minor: number;
                amount_paid_minor: number;
                due_at?: string | null;
                projects?: { name?: string | null } | null;
              }) => {
                const due = invoiceBalance(
                  inv.total_minor,
                  inv.amount_paid_minor,
                );
                return (
                  <li key={inv.id} className="relative z-0 hover:z-20">
                    <EntityPeek data={invoicePeek(inv as never)}>
                      <Link
                        href={`/client/billing/${inv.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#24302b] px-4 py-3 hover:bg-[#121a17]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {inv.projects?.name || inv.invoice_number}
                          </p>
                          <p className="font-mono text-xs text-[#9aaba2]">
                            {inv.invoice_number}
                          </p>
                        </div>
                        <p className="font-mono text-sm text-[#d4b45a]">
                          {formatInr(due)}
                        </p>
                      </Link>
                    </EntityPeek>
                  </li>
                );
              },
            )}
          </ul>
          <Link
            href="/client/billing"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Go to Pay bills
          </Link>
        </section>
      ) : null}

      {data.snapshots.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-[family-name:var(--font-syne)] text-lg">
            What's new
          </h3>
          <ul className="space-y-2">
            {data.snapshots.slice(0, 4).map((snapshot: any) => (
                <li key={snapshot.id}>
                  <Link
                    href={`/client/projects/${snapshot.project_id}`}
                    className="block rounded-lg border border-[#24302b] px-4 py-3 hover:bg-[#121a17]"
                  >
                    <p className="font-medium">{snapshot.title}</p>
                    <p className="font-mono text-xs text-[#9aaba2]">
                      {(Array.isArray(snapshot.projects) ? snapshot.projects[0]?.name : snapshot.projects?.name) ?? "Project"} ·{" "}
                      {relativeTime(snapshot.created_at)}
                    </p>
                    {snapshot.changelog ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[#9aaba2]">
                        {snapshot.changelog}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      <div className="rounded-lg border border-[#24302b] bg-[#121a17] p-5">
        <Link
          href="/client/support"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Get help
        </Link>
      </div>
    </div>
  );
}
