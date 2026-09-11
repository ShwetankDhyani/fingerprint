import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createQuoteAction,
  updateLeadStatusAction,
} from "@/app/actions/portal";
import { CustomerTimeline } from "@/components/portal/customer-timeline";
import { PortalSelect } from "@/components/portal/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchLead } from "@/lib/portal/data";
import {
  LEAD_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { fetchCustomerTimeline } from "@/lib/portal/timeline";
import { formatDateTime, formatInr } from "@/lib/portal/utils";

export const metadata = { title: "Lead" };

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await fetchLead(id);
  if (!lead) notFound();

  const quotes = lead.quotes ?? [];
  const organizations = lead.organizations ?? [];
  const converted = String(lead.status) === "converted";
  const phone =
    ((lead.meta as { phone?: string | null } | null)?.phone as
      | string
      | null
      | undefined) ?? null;

  const timeline = await fetchCustomerTimeline({
    leadId: String(lead.id),
    email: lead.email ? String(lead.email) : null,
    organizationId: organizations[0]?.id ? String(organizations[0].id) : null,
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div>
          <Link
            href="/admin/leads"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6f68] hover:text-[#d4b45a]"
          >
            ← Leads
          </Link>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {labelOf(LEAD_STATUS_LABEL, String(lead.status))}
            {lead.source ? ` · ${lead.source}` : ""}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
            {lead.name}
          </h2>
          <p className="mt-1 text-sm text-[#9aaba2]">
            {lead.company || "No company listed"}
            {lead.email ? ` · ${lead.email}` : ""}
            {phone ? ` · ${phone}` : ""}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Fact label="Project type" value={lead.project_type || "—"} />
          <Fact label="Budget" value={lead.budget || "—"} />
          <Fact label="Timeline" value={lead.timeline || "—"} />
          <Fact label="Plan" value={lead.selected_plan || "—"} />
          <Fact label="Received" value={formatDateTime(lead.created_at)} />
          <Fact
            label="Client status"
            value={
              converted
                ? "Advance paid — on Clients"
                : "Lead until advance is paid"
            }
          />
        </div>

        <div className="rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            Scope
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#d4dcd6]">
            {lead.scope || "No scope notes."}
          </p>
        </div>

        <CustomerTimeline
          events={timeline}
          subtitle="Enquiry, quotes, emails, WhatsApp and payments for this lead."
          emptyBody="Nothing logged yet — send a quote or reply to start the thread."
        />

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h3 className="font-[family-name:var(--font-syne)] text-lg">
              Quotes
            </h3>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68]">
              {quotes.length} linked
            </p>
          </div>
          {quotes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#5f6f68]">
              No quotes yet — create one on the right.
            </p>
          ) : (
            <ul className="divide-y divide-[#24302b] overflow-hidden rounded-xl border border-[#24302b]">
              {quotes.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/admin/quotes/${q.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#121a17]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{q.title}</p>
                      <p className="truncate font-mono text-xs text-[#9aaba2]">
                        {q.quote_number}
                        {" · "}
                        {labelOf(QUOTE_STATUS_LABEL, String(q.status))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs">
                      <p className="text-[#d4b45a]">
                        {formatInr(Number(q.total_minor ?? 0))}
                      </p>
                      {Number(q.paid_advance_minor ?? 0) > 0 ? (
                        <p className="text-[#5ecf9a]">
                          {formatInr(Number(q.paid_advance_minor))} paid
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {organizations.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-[family-name:var(--font-syne)] text-lg">
              Client record
            </h3>
            <ul className="space-y-2">
              {organizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/admin/clients/${org.id}`}
                    className="block rounded-xl border border-[#1c2622] bg-[#0d1411]/80 px-4 py-3 transition-colors hover:border-[#d4b45a]/35"
                  >
                    <p className="font-medium">{org.name}</p>
                    <p className="font-mono text-xs text-[#9aaba2]">
                      {org.billing_email || org.slug || "Open client →"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <form
          action={updateLeadStatusAction}
          className="space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4"
        >
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Lead status
          </h3>
          <input type="hidden" name="leadId" value={lead.id} />
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <PortalSelect
              id="status"
              name="status"
              label="Status"
              defaultValue={String(lead.status)}
              options={[
                { value: "new", label: "New enquiry" },
                { value: "contacted", label: "In conversation" },
                { value: "converted", label: "Became a client" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
          <p className="text-xs text-[#5f6f68]">
            Conversion to Client is automatic when they pay the advance. Use
            Converted only to mark it by hand if needed.
          </p>
          <Button type="submit" variant="outline" className="w-full">
            Update status
          </Button>
        </form>

        {!converted ? (
          <form
            action={createQuoteAction}
            className="space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4"
          >
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
              Create quotation
            </h3>
            <p className="text-xs text-[#9aaba2]">
              Stays a lead until the advance is paid — no Clients entry yet.
            </p>
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="recipientName" value={lead.name} />
            <input type="hidden" name="recipientEmail" value={lead.email} />
            {phone ? (
              <input type="hidden" name="recipientPhone" value={phone} />
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={
                  lead.project_type
                    ? `${lead.project_type} for ${lead.company || lead.name}`
                    : `Project for ${lead.company || lead.name}`
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lineLabel">Line item</Label>
              <Input
                id="lineLabel"
                name="lineLabel"
                required
                defaultValue={lead.project_type || "Project work"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lineDescription">Description</Label>
              <Textarea
                id="lineDescription"
                name="lineDescription"
                rows={3}
                defaultValue={lead.scope || ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="lineAmountInr">Amount (INR)</Label>
                <Input
                  id="lineAmountInr"
                  name="lineAmountInr"
                  type="number"
                  min={1}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="advanceInr">Advance (INR)</Label>
                <Input
                  id="advanceInr"
                  name="advanceInr"
                  type="number"
                  min={0}
                  placeholder="40% default"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="sendNow" defaultChecked />
              Send now — email the quote
            </label>
            <Button type="submit" className="w-full">
              Create quote
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-[#1c3830] bg-[#0d1814] p-4 text-sm text-[#9aaba2]">
            This lead already paid and is a client. Open their client record to
            manage projects and invoices.
          </div>
        )}
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1c2622] bg-[#0d1411]/70 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[#e8eee9]">{value}</p>
    </div>
  );
}
