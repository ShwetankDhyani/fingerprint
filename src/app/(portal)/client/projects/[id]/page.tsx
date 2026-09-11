import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectHero } from "@/components/portal/project-card";
import { ProgressUpdateCard } from "@/components/portal/progress-update";
import { EmptyState } from "@/components/portal/shell";
import { buttonVariants } from "@/components/ui/button";
import { requireClient } from "@/lib/auth/session";
import { fetchProject } from "@/lib/portal/data";
import {
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { resolveProjectTheme } from "@/lib/portal/project-theme";
import { formatInr } from "@/lib/portal/utils";
import {
  PaymentSplit,
  moneySplit,
  paymentLine,
} from "@/components/portal/payment-split";
import { cn } from "@/lib/utils";

export default async function ClientProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireClient();
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) notFound();
  if (!profile.organization_ids.includes(project.organization_id as string)) {
    notFound();
  }

  const milestones =
    (project.milestones as Array<Record<string, unknown>>) ?? [];
  const updates = ((project.snapshots as Array<Record<string, unknown>>) ?? [])
    .filter((s) => s.status !== "draft")
    .sort(
      (a, b) =>
        new Date(String(b.published_at ?? b.created_at)).getTime() -
        new Date(String(a.published_at ?? a.created_at)).getTime(),
    );

  const theme = resolveProjectTheme({
    id: String(project.id),
    name: String(project.name),
    code: project.code as string | null,
    summary: project.summary as string | null,
    meta: project.meta,
  });

  const invoices =
    ((project as {
      invoices?: Array<{
        id: string;
        invoice_number?: string;
        total_minor?: number | null;
        amount_paid_minor?: number | null;
        status?: string | null;
      }>;
    }).invoices ?? []);
  const invoiced = invoices.reduce((s, i) => s + Number(i.total_minor ?? 0), 0);
  const paidIn = invoices.reduce(
    (s, i) => s + Number(i.amount_paid_minor ?? 0),
    0,
  );
  const money = moneySplit(invoiced, paidIn);

  return (
    <div className="space-y-8">
      <ProjectHero
        project={{
          id: String(project.id),
          name: String(project.name),
          code: project.code as string | null,
          summary: project.summary as string | null,
          meta: project.meta,
        }}
        statusLabel={labelOf(PROJECT_STATUS_LABEL, String(project.status))}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: theme.accent }}
            >
              Payments
            </h3>
            <p className="mt-1 text-xs text-[#7a8a83]">
              What you&apos;ve paid and what&apos;s still open on this project.
            </p>
          </div>
          <p className="font-mono text-[11px] text-[#9aaba2]">
            {paymentLine(money.paid, money.pending)}
          </p>
        </div>
        <PaymentSplit
          total={money.total}
          paid={money.paid}
          pending={money.pending}
          totalLabel="Invoiced"
        />
        {invoices.length > 0 ? (
          <ul className="divide-y divide-[#24302b] overflow-hidden rounded-xl border border-[#24302b]">
            {invoices.map((inv) => {
              const split = moneySplit(inv.total_minor, inv.amount_paid_minor);
              return (
                <li key={inv.id}>
                  <Link
                    href={`/client/billing/${inv.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#121a17]"
                  >
                    <p className="truncate font-mono text-xs text-[#9aaba2]">
                      {inv.invoice_number}
                    </p>
                    <div className="shrink-0 text-right font-mono text-[11px]">
                      <p className="text-emerald-400">
                        {formatInr(split.paid)} paid
                      </p>
                      <p
                        className={
                          split.pending > 0 ? "text-[#d4b45a]" : "text-[#5f6f68]"
                        }
                      >
                        {split.pending > 0
                          ? `${formatInr(split.pending)} pending`
                          : "Settled"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: theme.accent }}
        >
          Timeline
        </h3>
        <ol className="space-y-2">
          {milestones
            .filter((m) => m.client_visible !== false)
            .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
            .map((m) => (
              <li
                key={String(m.id)}
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: `${theme.accent}33`,
                  background: `linear-gradient(135deg, ${theme.wash}, transparent 70%)`,
                }}
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{String(m.title)}</p>
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: theme.accent }}
                  >
                    {labelOf(MILESTONE_STATUS_LABEL, String(m.status))}
                  </span>
                </div>
                <p className="font-mono text-xs text-[#9aaba2]">
                  due {String(m.due_at ?? "—")}
                </p>
              </li>
            ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: theme.accent }}
          >
            What&apos;s new
          </h3>
          <span className="font-mono text-[10px] text-[#5f6f68]">
            screenshots and notes from the build
          </span>
        </div>
        {updates.length === 0 ? (
          <EmptyState
            title="Nothing posted yet"
            body="As soon as build work starts, your Lynx team shares screenshots and short notes here — so you can see progress without chasing links."
          />
        ) : (
          <ul className="space-y-3">
            {updates.map((s) => (
              <li key={String(s.id)}>
                <ProgressUpdateCard
                  snapshotId={String(s.id)}
                  title={String(s.title)}
                  changelog={
                    s.changelog != null ? String(s.changelog) : null
                  }
                  createdAt={
                    s.created_at != null ? String(s.created_at) : null
                  }
                  publishedAt={
                    s.published_at != null ? String(s.published_at) : null
                  }
                  stagingUrl={
                    s.staging_url != null ? String(s.staging_url) : null
                  }
                  media={s.media}
                  autoGenerated={Boolean(s.auto_generated)}
                  remarks={
                    ((s.snapshot_remarks as Array<Record<string, unknown>>) ??
                      []).map((remark) => ({
                      id: String(remark.id),
                      body: String(remark.body ?? ""),
                      created_at: String(remark.created_at ?? ""),
                      author_id: remark.author_id
                        ? String(remark.author_id)
                        : null,
                      resolved: Boolean(remark.resolved),
                      profiles:
                        (remark.profiles as {
                          full_name?: string | null;
                          email?: string | null;
                          role?: string | null;
                        } | null) ?? null,
                    }))
                  }
                  canComment
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[#24302b] bg-[#121a17] p-4">
        <p className="text-sm text-[#9aaba2]">
          Leave feedback on any progress update above, or open a support ticket
          if you need a tracked fix.
        </p>
        <Link
          href="/client/support"
          className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
        >
          Open a ticket
        </Link>
      </section>
    </div>
  );
}
