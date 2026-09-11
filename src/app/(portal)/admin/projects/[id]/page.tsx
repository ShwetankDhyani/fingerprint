import { notFound } from "next/navigation";

import {
  completeProjectAction,
  createMilestoneAction,
  publishSnapshotAction,
  deleteProjectAction,
  setMilestoneStatusAction,
  updateProjectAction,
} from "@/app/actions/portal";
import { MoneySummaryCard } from "@/components/portal/money-summary";
import { ProjectHero } from "@/components/portal/project-card";
import { ProgressUpdateCard } from "@/components/portal/progress-update";
import { PortalSelect } from "@/components/portal/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchProject } from "@/lib/portal/data";
import { getProjectFinancialSummary } from "@/lib/portal/finance";
import {
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { resolveProjectTheme } from "@/lib/portal/project-theme";
import { formatDate, formatDateTime, formatInr } from "@/lib/portal/utils";
import { getPortalProfile, isSuperAdminRole } from "@/lib/auth/session";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";
import { moneySplit } from "@/components/portal/payment-split";
import Link from "next/link";
import { INVOICE_STATUS_LABEL, QUOTE_STATUS_LABEL } from "@/lib/portal/labels";

const MILESTONE_STATUS_OPTIONS = Object.entries(MILESTONE_STATUS_LABEL).map(
  ([value, label]) => ({ value, label }),
);

export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) notFound();
  const actor = await getPortalProfile();
  const isSuperAdmin = actor ? isSuperAdminRole(actor.role) : false;

  const org = project.organizations as { name?: string; id?: string } | null;
  const milestones =
    (project.milestones as Array<Record<string, unknown>>) ?? [];
  const updates = (
    (project.snapshots as Array<Record<string, unknown>>) ?? []
  )
    .slice()
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
        status?: string;
        total_minor?: number | null;
        amount_paid_minor?: number | null;
        due_at?: string | null;
      }>;
    }).invoices ?? []);
  const quotes =
    ((project as {
      quotes?: Array<{
        id: string;
        quote_number?: string;
        title?: string;
        status?: string;
        total_minor?: number | null;
        advance_minor?: number | null;
        paid_advance_minor?: number | null;
      }>;
    }).quotes ?? []);

  const money = await getProjectFinancialSummary(String(project.id));
  const outstanding = money.outstanding;
  const isDelivered = String(project.status) === "completed";

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
        orgName={org?.name}
      />

      <section className="space-y-3">
        <MoneySummaryCard
          summary={money}
          title="Money on this project"
          invoicesHref={
            org?.id ? `/admin/invoices?org=${org.id}` : "/admin/invoices"
          }
        />
        {(invoices.length > 0 || quotes.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {invoices.length > 0 ? (
              <ul className="divide-y divide-[#24302b] overflow-hidden rounded-xl border border-[#24302b]">
                {invoices.map((inv) => {
                  const split = moneySplit(
                    inv.total_minor,
                    inv.amount_paid_minor,
                  );
                  return (
                    <li key={inv.id}>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#121a17]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {inv.invoice_number}
                          </p>
                          <p className="font-mono text-[10px] text-[#7a8a83]">
                            {labelOf(INVOICE_STATUS_LABEL, String(inv.status))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11px]">
                          <p className="text-emerald-400">
                            {formatInr(split.paid)} paid
                          </p>
                          <p
                            className={
                              split.pending > 0
                                ? "text-[#d4b45a]"
                                : "text-[#5f6f68]"
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
            ) : (
              <p className="rounded-xl border border-dashed border-[#24302b] px-3 py-4 text-sm text-[#5f6f68]">
                No invoices on this project yet.
              </p>
            )}
            {quotes.length > 0 ? (
              <ul className="divide-y divide-[#24302b] overflow-hidden rounded-xl border border-[#24302b]">
                {quotes.map((q) => {
                  const advance =
                    Number(q.advance_minor ?? 0) || Number(q.total_minor ?? 0);
                  const split = moneySplit(advance, q.paid_advance_minor);
                  return (
                    <li key={q.id}>
                      <Link
                        href={`/admin/quotes/${q.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-[#121a17]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {q.title || q.quote_number}
                          </p>
                          <p className="font-mono text-[10px] text-[#7a8a83]">
                            {q.quote_number} ·{" "}
                            {labelOf(QUOTE_STATUS_LABEL, String(q.status))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11px]">
                          <p className="text-emerald-400">
                            {formatInr(split.paid)} paid
                          </p>
                          <p
                            className={
                              split.pending > 0
                                ? "text-[#d4b45a]"
                                : "text-[#5f6f68]"
                            }
                          >
                            {split.pending > 0
                              ? `${formatInr(split.pending)} pending`
                              : "Advance settled"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      <form
        action={updateProjectAction}
        className="grid gap-3 rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            Edit project
          </p>
          <p className="mt-1 text-xs text-[#7a8a83]">
            After advance payment, rename the project, code, status or summary
            anytime.
          </p>
        </div>
        <input type="hidden" name="projectId" value={project.id} />
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={String(project.name)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            defaultValue={String(project.code ?? "")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <PortalSelect
            id="status"
            name="status"
            label="Status"
            defaultValue={String(project.status)}
            options={[
              { value: "intake", label: "Getting started" },
              { value: "active", label: "In progress" },
              { value: "review", label: "In review" },
              { value: "launched", label: "Live" },
              { value: "maintenance", label: "Maintenance" },
              { value: "paused", label: "Paused" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            name="summary"
            rows={3}
            defaultValue={String(project.summary ?? "")}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Save project details
          </Button>
        </div>
      </form>

      {isDelivered ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-400">
            Delivered
          </p>
          <p className="mt-1 text-sm text-[#c8d3cd]">
            Handed over {formatDateTime(project.completed_at as string | null)}
            {project.handover_sent_at
              ? ` · handover email sent ${formatDateTime(String(project.handover_sent_at))}`
              : " · handover email did not send"}
          </p>
          {project.handover_note ? (
            <p className="mt-2 whitespace-pre-line rounded-lg border border-[#24302b] bg-[#0b1210]/60 px-3 py-2 text-xs leading-relaxed text-[#9aaba2]">
              {String(project.handover_note)}
            </p>
          ) : null}
        </section>
      ) : (
        <form
          action={completeProjectAction}
          className="space-y-3 rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-4"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
              Close the project
            </p>
            <p className="mt-1 text-xs text-[#7a8a83]">
              Marks the project delivered, sends the handover email with support
              terms, and moves it into the client&apos;s Delivered section.
              {outstanding > 0
                ? ` ${formatInr(outstanding)} is still unpaid — clear it first, or agree the write-off below.`
                : " The balance on this project is settled."}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="handoverNote">Handover note</Label>
            <Textarea
              id="handoverNote"
              name="handoverNote"
              rows={3}
              placeholder="What was delivered, where it lives, anything they need to run it."
            />
          </div>
          {outstanding > 0 ? (
            <label className="flex items-start gap-2 text-xs text-[#c8d3cd]">
              <input
                type="checkbox"
                name="balanceWaived"
                className="mt-0.5"
              />
              Balance agreed as settled — close with {formatInr(outstanding)}{" "}
              outstanding
            </label>
          ) : null}
          <Button type="submit" size="sm">
            Mark delivered
          </Button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: theme.accent }}
          >
            Milestones
          </h3>
          <ol className="space-y-2">
            {milestones
              .slice()
              .sort(
                (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
              )
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
                    due {formatDate(m.due_at as string | null)}
                    {m.payment_amount_minor
                      ? ` · ${formatInr(Number(m.payment_amount_minor))}`
                      : ""}
                    {m.client_visible ? " · visible to client" : " · internal"}
                    {m.completed_at
                      ? ` · done ${formatDateTime(String(m.completed_at))}`
                      : ""}
                  </p>
                  <form
                    action={setMilestoneStatusAction}
                    className="mt-2 flex items-center gap-2"
                  >
                    <input
                      type="hidden"
                      name="milestoneId"
                      value={String(m.id)}
                    />
                    <PortalSelect
                      name="status"
                      defaultValue={String(m.status)}
                      options={MILESTONE_STATUS_OPTIONS}
                      className="max-w-40"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </form>
                  {m.client_notified_at ? (
                    <p className="mt-1 font-mono text-[10px] text-[#5f6f68]">
                      client emailed{" "}
                      {formatDateTime(String(m.client_notified_at))}
                    </p>
                  ) : null}
                </li>
              ))}
          </ol>
          <form
            action={createMilestoneAction}
            className="space-y-2 rounded-lg border border-[#24302b] p-3"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <Label>Add milestone</Label>
            <Input name="title" required placeholder="Title" />
            <Input name="dueAt" type="date" />
            <Input
              name="paymentInr"
              type="number"
              min={0}
              placeholder="Payment trigger (INR)"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="clientVisible" defaultChecked />
              Visible to client
            </label>
            <Button type="submit" size="sm">
              Add milestone
            </Button>
          </form>
        </section>

        <section className="space-y-3">
          <h3
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: theme.accent }}
          >
            What&apos;s new
          </h3>
          <p className="text-xs text-[#5f6f68]">
            Upload a screenshot so the client sees progress in their portal —
            not a link that breaks.
          </p>
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
          <form
            action={publishSnapshotAction}
            className="space-y-2 rounded-lg border border-[#24302b] p-3"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <Label>Share a progress update</Label>
            <Input name="title" required placeholder="What moved" />
            <Textarea
              name="changelog"
              placeholder="Short note for the client"
              rows={3}
            />
            <div className="space-y-1">
              <Label htmlFor="screenshot">Screenshot</Label>
              <Input
                id="screenshot"
                name="screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
              />
              <p className="font-mono text-[10px] text-[#5f6f68]">
                JPG, PNG, WEBP or GIF · under 8 MB
              </p>
            </div>
            <Input
              name="stagingUrl"
              placeholder="Optional live preview URL"
            />
            <Input
              name="screenshotUrl"
              placeholder="Or paste an image URL (fallback)"
            />
            <Button type="submit" size="sm">
              Publish to client
            </Button>
          </form>
        </section>
      </div>

      {isSuperAdmin ? (
        <section className="space-y-3 rounded-xl border border-[#5a2020]/70 bg-[#1a0e0e]/50 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d48080]">
            Super Admin · absolute control
          </p>
          <p className="text-sm text-[#9aaba2]">
            Permanently delete this project, its milestones, and progress snapshots.
          </p>
          <SuperAdminDeleteButton
            action={deleteProjectAction}
            entityLabel="project"
            consequence={`Deletes ${String(project.name)} and delivery history.`}
            hidden={{ projectId: String(project.id) }}
            buttonLabel="Delete project"
          />
        </section>
      ) : null}
    </div>
  );
}
