import Link from "next/link";
import { Suspense } from "react";

import { CashfreeReturnHandler } from "@/components/payments/cashfree-return-handler";
import { InvoiceCheckout } from "@/components/payments/invoice-checkout";
import { EntityPeek } from "@/components/portal/entity-peek";
import { FilterBar } from "@/components/portal/filter-bar";
import { EmptyState } from "@/components/portal/shell";
import {
  ActionLane,
  LaneList,
  SettledLane,
} from "@/components/portal/work-lanes";
import { requireClient } from "@/lib/auth/session";
import { fetchInvoices, fetchPayments } from "@/lib/portal/data";
import {
  INVOICE_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import {
  invoiceBalance,
  invoiceIsSettled,
  invoiceNeedsAction,
  invoicePeek,
} from "@/lib/portal/money";
import { formatDate, formatInr } from "@/lib/portal/utils";

export const metadata = { title: "Pay bills" };

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_minor: number;
  amount_paid_minor: number;
  due_at: string | null;
  organizations?: { name?: string | null } | null;
  projects?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;
};

type PaymentRow = {
  id: string;
  plan_name: string | null;
  plan_slug: string | null;
  invoice_number: string | null;
  created_at: string;
  provider_order_id: string | null;
  amount_minor: number;
  status: string;
};

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await requireClient();
  const [invoices, payments] = await Promise.all([
    fetchInvoices(profile.organization_ids, {
      q: sp.q,
      status: sp.status,
      clientEmail: profile.email,
    }) as Promise<InvoiceRow[]>,
    fetchPayments(profile.organization_ids, profile.email) as Promise<
      PaymentRow[]
    >,
  ]);

  const toPay = invoices.filter((inv) =>
    invoiceNeedsAction(
      String(inv.status),
      invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    ),
  );
  const paid = invoices.filter((inv) =>
    invoiceIsSettled(
      String(inv.status),
      invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    ),
  );
  const pendingTotal = toPay.reduce(
    (sum, inv) =>
      sum + invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    0,
  );
  const paidTotal = invoices.reduce(
    (sum, inv) => sum + Number(inv.amount_paid_minor),
    0,
  );

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <CashfreeReturnHandler />
      </Suspense>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          Simple billing
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">
          Pay bills
        </h2>
        </div>

      {pendingTotal > 0 ? (
        <div className="rounded-lg border border-[#b08d1f]/40 bg-[#b08d1f]/10 px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d4b45a]">
            Still to pay
          </p>
          <p className="mt-1 font-[family-name:var(--font-syne)] text-3xl text-[#e8eee9]">
            {formatInr(pendingTotal)}
          </p>
          <p className="mt-1 text-sm text-[#9aaba2]">
            {toPay.length} open bill{toPay.length === 1 ? "" : "s"} ·{" "}
            {formatInr(paidTotal)} already paid
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-5">
          <p className="font-[family-name:var(--font-syne)] text-xl text-emerald-300">
            You are all paid up
          </p>
        </div>
      )}

      <FilterBar
        basePath="/client/billing"
        placeholder="Search a bill number…"
        resultCount={invoices.length}
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All bills",
            options: [
              { value: "sent", label: "Unpaid" },
              { value: "partial", label: "Partly paid" },
              { value: "paid", label: "Paid" },
              { value: "overdue", label: "Overdue" },
            ],
          },
        ]}
      />

      {invoices.length === 0 ? (
        <EmptyState
          title="No bills yet"
          body="When Lynx sends an advance or milestone bill, it shows up here with a Pay button."
        />
      ) : (
        <div className="space-y-6">
          <ActionLane
            title="Please pay these"
            count={toPay.length}
          >
            {toPay.length === 0 ? (
              <EmptyState
                title="Nothing waiting"
                body="No open bills in this filter."
              />
            ) : (
              <LaneList>
                {toPay.map((inv) => {
                  const due = invoiceBalance(
                    inv.total_minor,
                    inv.amount_paid_minor,
                  );
                  const project = inv.projects;
                  return (
                    <li
                      key={inv.id}
                      className="relative z-0 overflow-visible hover:z-20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                        <EntityPeek
                          data={invoicePeek(inv)}
                          className="min-w-0 flex-1"
                        >
                          <Link
                            href={`/client/billing/${inv.id}`}
                            className="block min-w-0 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-[#d4b45a]/40"
                          >
                            <p className="text-base font-medium">
                              {project?.name || inv.invoice_number}
                            </p>
                            <p className="mt-0.5 text-sm text-[#9aaba2]">
                              {inv.invoice_number}
                              {" · "}
                              {labelOf(INVOICE_STATUS_LABEL, inv.status)}
                              {" · due "}
                              {formatDate(inv.due_at)}
                            </p>
                            <p className="mt-1 font-[family-name:var(--font-syne)] text-2xl text-[#d4b45a]">
                              {formatInr(due)} pending
                            </p>
                            <p className="font-mono text-[11px] text-emerald-400">
                              {formatInr(Number(inv.amount_paid_minor))} paid
                            </p>
                          </Link>
                        </EntityPeek>
                        <InvoiceCheckout
                          invoiceId={String(inv.id)}
                          amountLabel={formatInr(due)}
                        />
                      </div>
                    </li>
                  );
                })}
              </LaneList>
            )}
          </ActionLane>

          <SettledLane
            title="Already paid"
            count={paid.length}
          >
            {paid.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#5f6f68]">
                No paid bills in this view yet.
              </p>
            ) : (
              <LaneList>
                {paid.map((inv) => (
                  <li
                    key={inv.id}
                    className="relative z-0 overflow-visible hover:z-20"
                  >
                    <EntityPeek data={invoicePeek(inv)}>
                      <Link
                        href={`/client/billing/${inv.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#121a17]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {inv.projects?.name || inv.invoice_number}
                          </p>
                          <p className="font-mono text-xs text-[#9aaba2]">
                            {inv.invoice_number} ·{" "}
                            {labelOf(INVOICE_STATUS_LABEL, inv.status)}
                          </p>
                        </div>
                        <p className="font-mono text-xs text-emerald-400">
                          {formatInr(Number(inv.amount_paid_minor))} paid
                        </p>
                      </Link>
                    </EntityPeek>
                  </li>
                ))}
              </LaneList>
            )}
          </SettledLane>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5f6f68]">
          Payment history
        </h3>
        {payments.length === 0 ? (
          <p className="text-sm text-[#5f6f68]">
            Successful online payments will list here.
          </p>
        ) : (
          <ul className="divide-y divide-[#24302b] rounded-lg border border-[#1c2622]">
            {payments.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {tx.plan_name || tx.plan_slug || "Payment"}
                    {tx.invoice_number ? ` · ${tx.invoice_number}` : ""}
                  </p>
                  <p className="font-mono text-xs text-[#5f6f68]">
                    {formatDate(tx.created_at)}
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <p className="text-[#c8d3cd]">
                    {formatInr(Number(tx.amount_minor))}
                  </p>
                  <p className="text-[#5f6f68]">
                    {labelOf(PAYMENT_STATUS_LABEL, String(tx.status))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-[#5f6f68]">
        Need help paying?{" "}
        <Link
          href="/client/support"
          className="text-[#d4b45a] underline-offset-4 hover:underline"
        >
          Message Lynx support
        </Link>
        . We never store card numbers.
      </p>
    </div>
  );
}
