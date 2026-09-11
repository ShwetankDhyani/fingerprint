import { formatInr } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export type MoneySplit = {
  total: number;
  paid: number;
  pending: number;
};

/** Paid vs still-due for any billable document. */
export function moneySplit(
  totalMinor: number | null | undefined,
  paidMinor: number | null | undefined,
): MoneySplit {
  const total = Math.max(0, Number(totalMinor ?? 0));
  const paid = Math.max(0, Math.min(total, Number(paidMinor ?? 0)));
  return { total, paid, pending: Math.max(0, total - paid) };
}

export function quoteAdvanceSplit(input: {
  total_minor?: number | null;
  advance_minor?: number | null;
  paid_advance_minor?: number | null;
}): MoneySplit & { quoteTotal: number } {
  const quoteTotal = Math.max(0, Number(input.total_minor ?? 0));
  const advanceTarget =
    Number(input.advance_minor ?? 0) > 0
      ? Number(input.advance_minor)
      : quoteTotal;
  const split = moneySplit(advanceTarget, input.paid_advance_minor);
  return { ...split, quoteTotal };
}

/**
 * Compact paid / pending strip — always shows both sides so partial payments
 * are obvious on projects, invoices, and quotations.
 */
export function PaymentSplit({
  total,
  paid,
  pending,
  className,
  totalLabel = "Total",
  paidLabel = "Paid",
  pendingLabel = "Pending",
  compact = false,
}: MoneySplit & {
  className?: string;
  totalLabel?: string;
  paidLabel?: string;
  pendingLabel?: string;
  compact?: boolean;
}) {
  const pct =
    total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : paid > 0 ? 100 : 0;
  const settled = pending <= 0 && total > 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#24302b] bg-[#0d1411]/90",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        <SplitCell
          label={totalLabel}
          value={formatInr(total)}
          tone="muted"
          compact={compact}
        />
        <SplitCell
          label={paidLabel}
          value={formatInr(paid)}
          tone="paid"
          compact={compact}
        />
        <SplitCell
          label={pendingLabel}
          value={settled ? "Settled" : formatInr(pending)}
          tone={settled ? "paid" : "pending"}
          compact={compact}
        />
      </div>
      <div className={cn("mt-3 h-1.5 overflow-hidden rounded-full bg-[#18201c]", compact && "mt-2")}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${pct}%`,
            background: settled ? "#5ecf9a" : "#d4b45a",
          }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-[#5f6f68]">
        {settled
          ? "Fully paid"
          : total > 0
            ? `${pct}% paid · ${formatInr(pending)} still open`
            : "No amount set"}
      </p>
    </div>
  );
}

function SplitCell({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: string;
  tone: "muted" | "paid" | "pending";
  compact?: boolean;
}) {
  const color =
    tone === "paid"
      ? "text-emerald-400"
      : tone === "pending"
        ? "text-[#d4b45a]"
        : "text-[#e8eee9]";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono tracking-tight",
          compact ? "text-sm" : "text-lg",
          color,
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** One-line paid · pending for list rows. */
export function paymentLine(paid: number, pending: number) {
  if (paid <= 0 && pending <= 0) return "No payments yet";
  if (pending <= 0) return `${formatInr(paid)} paid · settled`;
  if (paid <= 0) return `${formatInr(pending)} pending`;
  return `${formatInr(paid)} paid · ${formatInr(pending)} pending`;
}
