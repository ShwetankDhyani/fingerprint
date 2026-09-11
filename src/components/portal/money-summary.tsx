import Link from "next/link";

import { PaymentSplit } from "@/components/portal/payment-split";
import type { FinancialSummary } from "@/lib/portal/finance";
import { formatDate, formatDateTime, formatInr } from "@/lib/portal/format";
import { cn } from "@/lib/utils";

/**
 * The money answer, always in the same place at the top of the page: what was
 * agreed, what was invoiced, what came in, what is still open.
 */
export function MoneySummaryCard({
  summary,
  title = "Money",
  invoicesHref,
  totalLabel = "Invoiced",
  className,
}: {
  summary: FinancialSummary;
  title?: string;
  invoicesHref?: string;
  totalLabel?: string;
  className?: string;
}) {
  const nothingYet = summary.total === 0 && summary.contracted === 0;

  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-[#1c2622] bg-[#0d1411]/80 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            {title}
          </p>
          <p className="mt-1 text-xs text-[#7a8a83]">
            {nothingYet
              ? "Nothing billed yet."
              : `${formatInr(summary.paid)} received · ${
                  summary.pending > 0
                    ? `${formatInr(summary.pending)} still open`
                    : "fully settled"
                }${
                  summary.uninvoiced > 0
                    ? ` · ${formatInr(summary.uninvoiced)} not yet invoiced`
                    : ""
                }`}
          </p>
        </div>
        {invoicesHref ? (
          <Link
            href={invoicesHref}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
          >
            Invoices →
          </Link>
        ) : null}
      </div>

      <PaymentSplit
        total={summary.total}
        paid={summary.paid}
        pending={summary.pending}
        totalLabel={
          totalLabel === "Invoiced" && summary.contracted > summary.invoiced
            ? "Agreed"
            : totalLabel
        }
        className="border-[#24302b]/70 bg-[#0b1210]"
      />

      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Contracted"
          value={summary.contracted > 0 ? formatInr(summary.contracted) : "—"}
          hint="Accepted quotations"
        />
        <Stat
          label="Advance pending"
          value={
            summary.advancePending > 0
              ? formatInr(summary.advancePending)
              : "Settled"
          }
          hint="Owed before work starts"
          tone={summary.advancePending > 0 ? "warn" : "good"}
        />
        <Stat
          label="Overdue"
          value={
            summary.overdueCount > 0
              ? `${formatInr(summary.overdueMinor)} · ${summary.overdueCount}`
              : "None"
          }
          hint="Past the due date"
          tone={summary.overdueCount > 0 ? "bad" : "good"}
        />
        <Stat
          label="Last payment"
          value={
            summary.lastPaymentAt ? formatDateTime(summary.lastPaymentAt) : "—"
          }
          hint={summary.lastPaymentAt ? "Received" : "No payments yet"}
        />
      </dl>

      {summary.nextDue ? (
        <Link
          href={`/admin/invoices/${summary.nextDue.invoiceId}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#24302b] bg-[#0b1210] px-3 py-2.5 transition-colors hover:border-[#d4b45a]/40"
        >
          <span className="font-mono text-[11px] text-[#9aaba2]">
            Next payment · {summary.nextDue.invoiceNumber}
            {summary.nextDue.dueAt
              ? ` · due ${formatDate(summary.nextDue.dueAt)}`
              : " · no due date set"}
          </span>
          <span className="font-mono text-sm text-[#d4b45a]">
            {formatInr(summary.nextDue.amountMinor)}
          </span>
        </Link>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "bad"
      ? "text-[#e08a78]"
      : tone === "warn"
        ? "text-[#d4b45a]"
        : tone === "good"
          ? "text-emerald-400"
          : "text-[#e8eee9]";
  return (
    <div className="rounded-xl border border-[#1c2622] bg-[#0b1210] px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
        {label}
      </dt>
      <dd className={cn("mt-1 font-mono text-sm", color)}>{value}</dd>
      <p className="mt-0.5 text-[11px] text-[#5f6f68]">{hint}</p>
    </div>
  );
}
