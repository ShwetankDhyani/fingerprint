import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createProjectAction,
  deleteUserAction,
  inviteClientAction,
  resendInviteAction,
  revokeInviteAction,
  setMemberDormantAction,
  startClientThreadAction,
  deleteOrganizationAction,
} from "@/app/actions/portal";
import { ClientAvatar } from "@/components/portal/client-avatar";
import { ClientNotesPanel } from "@/components/portal/client-notes";
import { CopyField } from "@/components/portal/copy-field";
import { BoardRow } from "@/components/portal/board-row";
import { CustomerTimeline } from "@/components/portal/customer-timeline";
import { DetailTabs } from "@/components/portal/detail-tabs";
import { HealthBadge } from "@/components/portal/health-badge";
import { MoneySummaryCard } from "@/components/portal/money-summary";
import { ProjectMark } from "@/components/portal/project-card";
import { PortalSelect } from "@/components/portal/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPortalProfile, isSuperAdminRole } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { fetchOrganization } from "@/lib/portal/data";
import {
  INVOICE_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { getClientFinancialSummary } from "@/lib/portal/finance";
import { resolveProjectTheme } from "@/lib/portal/project-theme";
import { fetchCustomerTimeline } from "@/lib/portal/timeline";
import { formatDate, formatDateTime } from "@/lib/portal/utils";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";

const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft: "#5f6f68",
  sent: "#d4b45a",
  opened: "#c4a06a",
  accepted: "#5ecf9a",
  converted: "#6eb4c8",
  declined: "#c07060",
  expired: "#c07060",
};

const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "#5f6f68",
  sent: "#d4b45a",
  partial: "#c4a06a",
  paid: "#5ecf9a",
  overdue: "#c07060",
  void: "#5f6f68",
  refunded: "#5f6f68",
};

const quoteStatusColor = (status: string) =>
  QUOTE_STATUS_COLOR[status] ?? "#9aaba2";
const invoiceStatusColor = (status: string) =>
  INVOICE_STATUS_COLOR[status] ?? "#9aaba2";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await fetchOrganization(id);
  if (!org) notFound();
  const actor = await getPortalProfile();
  const isSuperAdmin = actor ? isSuperAdminRole(actor.role) : false;

  const [timeline, money] = await Promise.all([
    fetchCustomerTimeline({
      organizationId: String(org.id),
      leadId: (org.lead_id as string | null) ?? null,
      email: (org.billing_email as string | null) ?? null,
    }),
    getClientFinancialSummary(String(org.id)),
  ]);

  const projects = (org.projects as Array<Record<string, string>>) ?? [];
  const quotes = (org.quotes as Array<Record<string, unknown>>) ?? [];
  const invoices = (org.invoices as Array<Record<string, unknown>>) ?? [];
  const members = (
    (org.organization_members as Array<Record<string, unknown>>) ?? []
  ).filter((member) => {
    const profile = member.profiles as { role?: string } | null;
    const role = String(profile?.role ?? "");
    // Studio staff/admins are never shown as client contacts — one email, one role.
    return role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "STAFF";
  });
  const invites = (
    (org.invites as Array<Record<string, unknown>>) ?? []
  ).filter((invite) => !invite.accepted_at);
  const tickets = (
    (org.threads as Array<Record<string, unknown>>) ?? []
  ).filter((thread) => thread.kind === "support");

  const contactName =
    (org.primary_contact_name as string | null) ||
    (org.billing_email as string | null) ||
    null;

  const projectsPanel = (
    <section className="space-y-3">
      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#24302b] px-3 py-4 text-sm text-[#5f6f68]">
          No projects yet. Create the first one below.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const theme = resolveProjectTheme(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-[#121a17]"
                  style={{
                    borderColor: `${theme.accent}40`,
                    background: `linear-gradient(135deg, ${theme.wash}, transparent 70%)`,
                  }}
                >
                  <ProjectMark
                    name={p.name}
                    code={p.code}
                    theme={theme}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <p className="font-mono text-xs text-[#9aaba2]">
                      {p.code} · {p.status}
                      {p.updated_at
                        ? ` · updated ${formatDateTime(p.updated_at)}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <form
        action={createProjectAction}
        className="space-y-2 rounded-lg border border-[#24302b] p-3"
      >
        <input type="hidden" name="organizationId" value={org.id} />
        <Label htmlFor="projectName">New project</Label>
        <Input id="projectName" name="name" required placeholder="Project name" />
        <Input name="summary" placeholder="One-line summary" />
        <Button type="submit" size="sm">
          Create project
        </Button>
      </form>
    </section>
  );

  const quotesPanel =
    quotes.length === 0 ? (
      <p className="rounded-lg border border-dashed border-[#24302b] px-3 py-4 text-sm text-[#5f6f68]">
        No quotes yet.
      </p>
    ) : (
      <ul className="divide-y divide-[#24302b] overflow-hidden rounded-lg border border-[#24302b]">
        {quotes.map((q) => {
          const project = q.projects as
            | { id?: string; name?: string | null; code?: string | null }
            | null;
          const advance =
            Number(q.advance_minor ?? 0) || Number(q.total_minor ?? 0);
          const paid = Number(q.paid_advance_minor ?? 0);
          return (
            <BoardRow
              key={String(q.id)}
              href={`/admin/quotes/${q.id}`}
              title={project?.name || String(q.title)}
              subtitle={String(q.quote_number)}
              meta={
                q.valid_until
                  ? `Valid until ${formatDate(String(q.valid_until))}`
                  : "No expiry set"
              }
              statusLabel={labelOf(QUOTE_STATUS_LABEL, String(q.status))}
              statusColor={quoteStatusColor(String(q.status))}
              money={{
                headline: Number(q.total_minor),
                paid,
                pending: Math.max(0, advance - paid),
                settledLabel: "Advance settled",
              }}
              at={q.created_at ? String(q.created_at) : null}
              atLabel="created"
            />
          );
        })}
      </ul>
    );

  const invoicesPanel =
    invoices.length === 0 ? (
      <p className="rounded-lg border border-dashed border-[#24302b] px-3 py-4 text-sm text-[#5f6f68]">
        No invoices yet.
      </p>
    ) : (
      <ul className="divide-y divide-[#24302b] overflow-hidden rounded-lg border border-[#24302b]">
        {invoices.map((inv) => {
          const project = inv.projects as
            | { id?: string; name?: string | null; code?: string | null }
            | null;
          const paid = Number(inv.amount_paid_minor ?? 0);
          return (
            <BoardRow
              key={String(inv.id)}
              href={`/admin/invoices/${inv.id}`}
              title={project?.name || String(inv.invoice_number)}
              subtitle={String(inv.invoice_number)}
              meta={
                inv.due_at
                  ? `Due ${formatDate(String(inv.due_at))}`
                  : "No due date set"
              }
              statusLabel={labelOf(INVOICE_STATUS_LABEL, String(inv.status))}
              statusColor={invoiceStatusColor(String(inv.status))}
              money={{
                headline: Number(inv.total_minor),
                paid,
                pending: Math.max(0, Number(inv.total_minor ?? 0) - paid),
              }}
              at={inv.created_at ? String(inv.created_at) : null}
              atLabel="raised"
            />
          );
        })}
      </ul>
    );

  const ticketsPanel =
    tickets.length === 0 ? (
      <p className="rounded-lg border border-dashed border-[#24302b] px-3 py-4 text-sm text-[#5f6f68]">
        No support tickets from this client.
      </p>
    ) : (
      <ul className="space-y-2">
        {tickets.map((ticket) => (
          <li key={String(ticket.id)}>
            <Link
              href={`/admin/tickets/${ticket.id}`}
              className="flex justify-between rounded-lg border border-[#24302b] px-3 py-2 text-sm hover:bg-[#121a17]"
            >
              <span>
                {String(ticket.ticket_number ?? "Ticket")} ·{" "}
                {String(ticket.subject)}
              </span>
              <span className="font-mono text-xs text-[#9aaba2]">
                {String(ticket.priority)} · {String(ticket.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );

  const peoplePanel = (
    <section className="space-y-3">
      <ul className="space-y-2">
        {members.map((m) => {
          const profile = m.profiles as
            | {
                id?: string;
                full_name?: string;
                email?: string;
                role?: string;
                account_status?: string;
              }
            | null;
          const dormant = profile?.account_status === "dormant";
          return (
            <li
              key={String(m.id)}
              className="space-y-2 rounded-lg border border-[#24302b] px-3 py-2"
            >
              <div>
                <p className="text-sm">
                  {profile?.full_name || "Member"} · {String(m.member_role)}
                  {dormant ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[#d4b45a]">
                      dormant
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-[#9aaba2]">
                  {profile?.email}
                </p>
              </div>
              {profile?.id ? (
                <div className="flex flex-wrap gap-2">
                  <form action={setMemberDormantAction}>
                    <input type="hidden" name="userId" value={profile.id} />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={String(org.id)}
                    />
                    <input
                      type="hidden"
                      name="dormant"
                      value={dormant ? "false" : "true"}
                    />
                    {!dormant ? (
                      <input
                        type="hidden"
                        name="reason"
                        value="Engagement complete — login paused, records retained."
                      />
                    ) : null}
                    <Button type="submit" size="sm" variant="outline">
                      {dormant ? "Reactivate login" : "Mark dormant"}
                    </Button>
                  </form>
                  {isSuperAdmin ? (
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={profile.id} />
                      <input
                        type="hidden"
                        name="organizationId"
                        value={String(org.id)}
                      />
                      <Button type="submit" size="sm" variant="ghost">
                        Delete user
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <form
        action={inviteClientAction}
        className="space-y-2 rounded-lg border border-[#24302b] p-3"
      >
        <input type="hidden" name="organizationId" value={org.id} />
        <Label>Invite teammate</Label>
        <Input name="email" type="email" required placeholder="Email" />
        <Input name="fullName" placeholder="Full name" />
        <Input name="phone" type="tel" placeholder="Mobile (optional)" />
        <PortalSelect
          name="role"
          label="Role"
          defaultValue="CLIENT"
          options={[
            { value: "CLIENT", label: "Client — can approve and pay" },
            { value: "CLIENT_VIEWER", label: "Viewer — read only" },
          ]}
        />
        <Button type="submit" size="sm">
          Send invite
        </Button>
      </form>

      {invites.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-[#24302b] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Pending invites
          </p>
          {invites.map((invite) => {
            const token = invite.token_plain as string | null;
            const url = token ? `${siteUrl()}/invite/${token}` : null;
            return (
              <div key={String(invite.id)} className="space-y-2">
                <p className="text-sm">
                  {String(invite.email)}
                  <span className="ml-2 font-mono text-[11px] text-[#9aaba2]">
                    {invite.last_sent_at
                      ? `emailed ${formatDateTime(String(invite.last_sent_at))}`
                      : "not emailed"}
                  </span>
                </p>
                {invite.send_error ? (
                  <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                    Email failed: {String(invite.send_error)} — share the link
                    below directly.
                  </p>
                ) : null}
                {url ? (
                  <CopyField
                    value={url}
                    label="Invite link"
                    whatsappMessage={`Hi${
                      invite.full_name
                        ? ` ${String(invite.full_name).split(" ")[0]}`
                        : ""
                    }, here is your Lynx client portal access. Set a password using this link:`}
                  />
                ) : (
                  <p className="text-xs text-[#9aaba2]">
                    Legacy invite — press resend to mint a fresh link.
                  </p>
                )}
                <div className="flex gap-2">
                  <form action={resendInviteAction}>
                    <input
                      type="hidden"
                      name="inviteId"
                      value={String(invite.id)}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Resend
                    </Button>
                  </form>
                  <form action={revokeInviteAction}>
                    <input
                      type="hidden"
                      name="inviteId"
                      value={String(invite.id)}
                    />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={String(org.id)}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Revoke
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-[#d4b45a]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-4">
          <ClientAvatar name={String(org.name)} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
                {org.name}
              </h2>
              <HealthBadge score={org.health_score as string} />
            </div>
            <p className="mt-1 text-sm text-[#9aaba2]">
              {contactName || org.slug}
              {contactName && org.billing_email
                ? ` · ${org.billing_email}`
                : ""}
              {org.phone ? ` · ${org.phone}` : ""}
              {org.website ? ` · ${org.website}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#7a8a83]">
              <span>
                <span className="text-[#5f6f68]">Client since</span>{" "}
                <span className="text-[#c8d3cd]">
                  {formatDateTime(org.created_at as string)}
                </span>
              </span>
              {org.lead_id ? (
                <Link
                  href={`/admin/leads/${org.lead_id}`}
                  className="text-[#d4b45a] hover:underline"
                >
                  Original enquiry →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/admin/clients"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
            >
              ← Clients
            </Link>
            <form action={startClientThreadAction}>
              <input type="hidden" name="organizationId" value={String(org.id)} />
              <input type="hidden" name="subject" value={`Lynx ↔ ${org.name}`} />
              <Button type="submit" size="sm" variant="outline">
                Message client
              </Button>
            </form>
          </div>
        </div>
      </header>

      <MoneySummaryCard
        summary={money}
        title={`Money · ${org.name}`}
        invoicesHref={`/admin/invoices?org=${org.id}`}
      />

      <CustomerTimeline
        events={timeline}
        subtitle="Everything on this relationship — quotes, payments, emails, messages and delivery."
        emptyBody="No activity recorded for this client yet."
      />

      <DetailTabs
        tabs={[
          { id: "projects", label: "Projects", count: projects.length, content: projectsPanel },
          { id: "quotes", label: "Quotes", count: quotes.length, content: quotesPanel },
          { id: "invoices", label: "Invoices", count: invoices.length, content: invoicesPanel },
          { id: "tickets", label: "Tickets", count: tickets.length, content: ticketsPanel },
          { id: "people", label: "People", count: members.length, content: peoplePanel },
        ]}
      />

      <ClientNotesPanel
        organizationId={String(org.id)}
        initialNotes={String(org.notes_internal ?? "")}
      />

      {isSuperAdmin ? (
        <section className="space-y-3 rounded-xl border border-[#5a2020]/70 bg-[#1a0e0e]/50 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d48080]">
              Super Admin · absolute control
            </p>
            <p className="mt-1 text-sm text-[#9aaba2]">
              Wipe this client and every operational record — projects, invoices,
              quotes, tickets, messages, payments, invites, and orphaned client
              logins. Activity, email, and WhatsApp logs are kept (unlinked) so
              the audit trail survives.
            </p>
          </div>
          <SuperAdminDeleteButton
            action={deleteOrganizationAction}
            entityLabel="client"
            consequence={`Permanently deletes ${String(org.name)} and all related records. Logs are kept.`}
            hidden={{ organizationId: String(org.id) }}
            buttonLabel="Delete entire client"
          />
        </section>
      ) : null}
    </div>
  );
}
