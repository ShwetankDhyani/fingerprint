import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteInvoiceAction } from "@/app/actions/portal";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";
import { getPortalProfile, isSuperAdminRole } from "@/lib/auth/session";
import { fetchInvoice } from "@/lib/portal/data";
import {
  INVOICE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { formatDate, formatDateTime, formatInr } from "@/lib/portal/utils";
import {
  PaymentSplit,
} from "@/components/portal/payment-split";

type LineItem = {
  id?: string;
  label?: string;
  description?: string | null;
  quantity?: number | null;
  unit_amount_minor?: number | null;
  amount_minor?: number | null;
  sort_order?: number | null;
};

type PaymentRow = {
  id?: string;
  amount_minor?: number | null;
  method?: string | null;
  note?: string | null;
  proof_url?: string | null;
  created_at?: string | null;
  transaction_id?: string | null;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1c2622] bg-[#0d1411]/70 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-[#e8eee9]">{value}</p>
    </div>
  );
}

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await fetchInvoice(id);
  if (!invoice) notFound();
  const actor = await getPortalProfile();
  const isSuperAdmin = actor ? isSuperAdminRole(actor.role) : false;

  const lines = (
    ((invoice as { invoice_line_items?: LineItem[] }).invoice_line_items ??
      []) as LineItem[]
  )
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  const payments = (
    ((invoice as { invoice_payments?: PaymentRow[] }).invoice_payments ??
      []) as PaymentRow[]
  )
    .slice()
    .sort(
      (a, b) =>
        new Date(String(b.created_at ?? 0)).getTime() -
        new Date(String(a.created_at ?? 0)).getTime(),
    );

  const org = invoice.organizations as {
    id?: string;
    name?: string | null;
    slug?: string | null;
    billing_email?: string | null;
    phone?: string | null;
    website?: string | null;
    primary_contact_name?: string | null;
    notes_internal?: string | null;
  } | null;

  const project = invoice.projects as {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
    summary?: string | null;
  } | null;

  const quote = invoice.quotes as {
    id?: string;
    quote_number?: string | null;
    title?: string | null;
    status?: string | null;
    total_minor?: number | null;
    recipient_name?: string | null;
    recipient_email?: string | null;
    recipient_phone?: string | null;
  } | null;

  const total = Number(invoice.total_minor ?? 0);
  const paid = Number(invoice.amount_paid_minor ?? 0);
  const balance = Math.max(0, total - paid);
  const subtotal = Number(invoice.subtotal_minor ?? total);
  const tax = Number(invoice.tax_minor ?? 0);
  const statusLabel = labelOf(INVOICE_STATUS_LABEL, String(invoice.status));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/admin/invoices"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6f68] hover:text-[#d4b45a]"
            >
              ← Invoices
            </Link>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
              {String(invoice.invoice_number)} · {statusLabel}
            </p>
            <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
              {project?.name || org?.name || "Invoice"}
            </h2>
            <p className="mt-1 text-sm text-[#9aaba2]">
              {org?.name ?? "No client linked"}
              {org?.billing_email ? ` · ${org.billing_email}` : ""}
              {balance > 0
                ? ` · ${formatInr(balance)} still due`
                : " · settled"}
            </p>
          </div>
          {isSuperAdmin ? (
            <SuperAdminDeleteButton
              action={deleteInvoiceAction}
              entityLabel="invoice"
              consequence="Line items and payment records for this invoice are removed."
              hidden={{ invoiceId: String(invoice.id) }}
              buttonLabel="Delete invoice"
            />
          ) : null}
        </div>

        <PaymentSplit
          total={total}
          paid={paid}
          pending={balance}
          totalLabel="Invoice total"
          paidLabel="Paid"
          pendingLabel="Pending"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Status" value={statusLabel} />
          <Fact label="Total" value={formatInr(total)} />
          <Fact label="Paid" value={formatInr(paid)} />
          <Fact
            label="Pending"
            value={balance > 0 ? formatInr(balance) : "Settled"}
          />
          <Fact
            label="Issued"
            value={formatDate(invoice.issued_at as string | null)}
          />
          <Fact
            label="Due"
            value={formatDate(invoice.due_at as string | null)}
          />
          <Fact
            label="Paid at"
            value={formatDateTime(invoice.paid_at as string | null)}
          />
          <Fact
            label="Created"
            value={formatDateTime(invoice.created_at as string | null)}
          />
          <Fact
            label="Updated"
            value={formatDateTime(invoice.updated_at as string | null)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#24302b]">
          <div className="border-b border-[#24302b] bg-[#121a17] px-4 py-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
              Line items
            </h3>
          </div>
          {lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#5f6f68]">
              No line items on this invoice.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68]">
                <tr>
                  <th className="px-4 py-2 font-normal">Item</th>
                  <th className="px-4 py-2 font-normal">Qty</th>
                  <th className="px-4 py-2 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={String(line.id ?? line.label)}
                    className="border-t border-[#24302b]"
                  >
                    <td className="px-4 py-3">
                      <p>{String(line.label ?? "Item")}</p>
                      {line.description ? (
                        <p className="mt-0.5 text-xs text-[#7a8a83]">
                          {String(line.description)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#9aaba2]">
                      {String(line.quantity ?? 1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#d4b45a]">
                      {formatInr(Number(line.amount_minor ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="space-y-1 border-t border-[#24302b] bg-[#0d1411]/80 px-4 py-3 text-right font-mono text-xs text-[#9aaba2]">
            <p>Subtotal {formatInr(subtotal)}</p>
            {tax > 0 ? <p>Tax {formatInr(tax)}</p> : null}
            <p className="text-sm text-[#d4b45a]">Total {formatInr(total)}</p>
            <p>Paid {formatInr(paid)}</p>
            <p className={balance > 0 ? "text-[#d4b45a]" : "text-emerald-400"}>
              Pending {balance > 0 ? formatInr(balance) : "Settled"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-[family-name:var(--font-syne)] text-lg">
            Payments
          </h3>
          {payments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#5f6f68]">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#24302b] overflow-hidden rounded-xl border border-[#24302b]">
              {payments.map((payment) => (
                <li
                  key={String(payment.id)}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatInr(Number(payment.amount_minor ?? 0))}
                    </p>
                    <p className="font-mono text-xs text-[#9aaba2]">
                      {String(payment.method ?? "payment")}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                    {payment.transaction_id ? (
                      <p className="mt-0.5 font-mono text-[10px] text-[#5f6f68]">
                        tx {String(payment.transaction_id)}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs text-[#7a8a83]">
                    <p>{formatDateTime(payment.created_at ?? null)}</p>
                    {payment.proof_url ? (
                      <a
                        href={String(payment.proof_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#d4b45a] hover:underline"
                      >
                        Proof
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {invoice.notes ? (
          <div className="rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#d4dcd6]">
              {String(invoice.notes)}
            </p>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Client
          </h3>
          {org?.id ? (
            <>
              <p className="text-sm font-medium">{org.name ?? "—"}</p>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#5f6f68]">Contact</dt>
                  <dd className="text-right text-[#c8d3cd]">
                    {org.primary_contact_name || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#5f6f68]">Email</dt>
                  <dd className="break-all text-right text-[#c8d3cd]">
                    {org.billing_email || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#5f6f68]">Phone</dt>
                  <dd className="text-right text-[#c8d3cd]">
                    {org.phone || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#5f6f68]">Website</dt>
                  <dd className="break-all text-right text-[#c8d3cd]">
                    {org.website ? (
                      <a
                        href={
                          org.website.startsWith("http")
                            ? org.website
                            : `https://${org.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#d4b45a] hover:underline"
                      >
                        {org.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
              {org.notes_internal ? (
                <p className="border-t border-[#24302b] pt-3 text-xs text-[#7a8a83]">
                  {org.notes_internal}
                </p>
              ) : null}
              <Link
                href={`/admin/clients/${org.id}`}
                className="inline-flex font-mono text-[11px] text-[#d4b45a] hover:underline"
              >
                Open client →
              </Link>
            </>
          ) : (
            <p className="text-sm text-[#5f6f68]">No client linked.</p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Project
          </h3>
          {project?.id ? (
            <>
              <p className="text-sm font-medium">{project.name}</p>
              <p className="font-mono text-xs text-[#9aaba2]">
                {project.code || "—"} ·{" "}
                {labelOf(PROJECT_STATUS_LABEL, String(project.status))}
              </p>
              {project.summary ? (
                <p className="text-xs text-[#7a8a83]">{project.summary}</p>
              ) : null}
              <Link
                href={`/admin/projects/${project.id}`}
                className="inline-flex font-mono text-[11px] text-[#d4b45a] hover:underline"
              >
                Open project →
              </Link>
            </>
          ) : (
            <p className="text-sm text-[#5f6f68]">
              No project linked yet — projects appear after advance payment.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Quote
          </h3>
          {quote?.id ? (
            <>
              <p className="text-sm font-medium">
                {quote.title || quote.quote_number}
              </p>
              <p className="font-mono text-xs text-[#9aaba2]">
                {quote.quote_number} ·{" "}
                {labelOf(QUOTE_STATUS_LABEL, String(quote.status))}
              </p>
              <p className="font-mono text-xs text-[#d4b45a]">
                {formatInr(Number(quote.total_minor ?? 0))}
              </p>
              {quote.recipient_name ||
              quote.recipient_email ||
              quote.recipient_phone ? (
                <p className="text-xs text-[#7a8a83]">
                  {[
                    quote.recipient_name,
                    quote.recipient_email,
                    quote.recipient_phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <Link
                href={`/admin/quotes/${quote.id}`}
                className="inline-flex font-mono text-[11px] text-[#d4b45a] hover:underline"
              >
                Open quote →
              </Link>
            </>
          ) : (
            <p className="text-sm text-[#5f6f68]">No source quote linked.</p>
          )}
        </div>

        <p className="text-xs text-[#5f6f68]">
          Card payments continue through Cashfree checkout — no raw card data is
          stored in the portal.
        </p>

        {isSuperAdmin ? (
          <section className="space-y-3 rounded-xl border border-[#5a2020]/70 bg-[#1a0e0e]/50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d48080]">
              Super Admin · absolute control
            </p>
            <p className="text-sm text-[#9aaba2]">
              Hard-delete this invoice. Related line items and payment rows go
              with it.
            </p>
            <SuperAdminDeleteButton
              action={deleteInvoiceAction}
              entityLabel="invoice"
              consequence="This invoice will be permanently removed."
              hidden={{ invoiceId: String(invoice.id) }}
              buttonLabel="Delete invoice permanently"
            />
          </section>
        ) : null}
      </aside>
    </div>
  );
}
