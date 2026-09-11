import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceCheckout } from "@/components/payments/invoice-checkout";
import { EmptyState } from "@/components/portal/shell";
import { requireClient } from "@/lib/auth/session";
import { fetchInvoice } from "@/lib/portal/data";
import { INVOICE_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import { formatDate, formatDateTime, formatInr } from "@/lib/portal/utils";

type LineItem = {
  id?: string;
  label?: string;
  description?: string | null;
  quantity?: number | null;
  amount_minor?: number | null;
};

type PaymentRow = {
  id?: string;
  amount_minor?: number | null;
  method?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireClient();
  const invoice = await fetchInvoice(id);
  if (!invoice) notFound();

  const orgId = String(invoice.organization_id ?? "");
  const org = invoice.organizations as {
    name?: string;
    billing_email?: string | null;
    phone?: string | null;
    website?: string | null;
    primary_contact_name?: string | null;
  } | null;
  const billingEmail = String(org?.billing_email ?? "").toLowerCase();
  const allowed =
    profile.organization_ids.includes(orgId) ||
    (billingEmail !== "" && billingEmail === profile.email.toLowerCase());
  if (!allowed) notFound();

  const project = invoice.projects as {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;

  const lines =
    ((invoice as { invoice_line_items?: LineItem[] }).invoice_line_items ??
      []) as LineItem[];
  const payments =
    ((invoice as { invoice_payments?: PaymentRow[] }).invoice_payments ??
      []) as PaymentRow[];

  const total = Number(invoice.total_minor ?? 0);
  const paid = Number(invoice.amount_paid_minor ?? 0);
  const due = Math.max(0, total - paid);
  const statusLabel = labelOf(INVOICE_STATUS_LABEL, String(invoice.status));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {String(invoice.invoice_number)}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl">
            {project?.name || org?.name || "Invoice"}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#9aaba2]">
            {statusLabel}
            {org?.name ? ` · ${org.name}` : ""}
            {invoice.due_at
              ? ` · due ${formatDate(invoice.due_at as string | null)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {due > 0 ? (
            <InvoiceCheckout
              invoiceId={String(invoice.id)}
              amountLabel={formatInr(due)}
            />
          ) : (
            <span className="font-mono text-xs text-emerald-400">Settled</span>
          )}
          <Link
            href="/client/billing"
            className="font-mono text-xs text-[#9aaba2] underline-offset-4 hover:underline"
          >
            All invoices
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#24302b] bg-[#121a17] px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
            Total
          </p>
          <p className="mt-1 font-mono text-sm text-[#d4b45a]">
            {formatInr(total)}
          </p>
        </div>
        <div className="rounded-xl border border-[#24302b] bg-[#121a17] px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
            Paid
          </p>
          <p className="mt-1 font-mono text-sm">{formatInr(paid)}</p>
        </div>
        <div className="rounded-xl border border-[#24302b] bg-[#121a17] px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
            Pending
          </p>
          <p
            className={`mt-1 font-mono text-sm ${due > 0 ? "text-[#d4b45a]" : "text-emerald-400"}`}
          >
            {due > 0 ? formatInr(due) : "Settled"}
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-[#24302b] bg-[#0d1411]/70 px-4 py-3 font-mono text-xs text-[#9aaba2] sm:grid-cols-2">
        <p>Issued {formatDate(invoice.issued_at as string | null)}</p>
        <p>Due {formatDate(invoice.due_at as string | null)}</p>
        <p>Created {formatDateTime(invoice.created_at as string | null)}</p>
        <p>Paid at {formatDateTime(invoice.paid_at as string | null)}</p>
        {project?.name ? (
          <p className="sm:col-span-2">
            Project {project.name}
            {project.code ? ` (${project.code})` : ""}
          </p>
        ) : null}
        {org?.billing_email || org?.phone || org?.website ? (
          <p className="sm:col-span-2">
            {[org.billing_email, org.phone, org.website]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="No line items"
          body="This invoice has no breakdown yet — the total above is still payable."
        />
      ) : (
        <ul className="divide-y divide-[#24302b] rounded-lg border border-[#24302b]">
          {lines.map((line) => (
            <li
              key={String(line.id ?? line.label)}
              className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p>{String(line.label ?? line.description ?? "Item")}</p>
                {line.description && line.label ? (
                  <p className="mt-0.5 text-xs text-[#7a8a83]">
                    {String(line.description)}
                  </p>
                ) : null}
                {line.quantity != null ? (
                  <p className="mt-0.5 font-mono text-[10px] text-[#5f6f68]">
                    qty {String(line.quantity)}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-xs text-[#d4b45a]">
                {formatInr(Number(line.amount_minor ?? 0))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            Payment history
          </h3>
          <ul className="divide-y divide-[#24302b] rounded-lg border border-[#24302b]">
            {payments.map((payment) => (
              <li
                key={String(payment.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-[#d4b45a]">
                    {formatInr(Number(payment.amount_minor ?? 0))}
                  </p>
                  <p className="font-mono text-[10px] text-[#7a8a83]">
                    {String(payment.method ?? "payment")}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>
                </div>
                <p className="font-mono text-[10px] text-[#5f6f68]">
                  {formatDateTime(payment.created_at ?? null)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {invoice.notes ? (
        <div className="rounded-lg border border-[#24302b] bg-[#121a17] px-4 py-3 text-sm text-[#9aaba2]">
          {String(invoice.notes)}
        </div>
      ) : null}
    </div>
  );
}
