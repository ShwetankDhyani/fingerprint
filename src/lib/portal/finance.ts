import "server-only";

import { moneySplit, type MoneySplit } from "@/components/portal/payment-split";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FinancialSummary = MoneySplit & {
  /** Sum of quote totals the client has agreed to (accepted or converted). */
  contracted: number;
  /** Sum of live invoice totals. */
  invoiced: number;
  /**
   * Still collectible: max(contracted, invoiced) − paid.
   * Includes the uninvoiced remainder after an advance invoice is settled.
   * Same value as `pending`.
   */
  outstanding: number;
  /** Contracted amount not yet covered by any live invoice. */
  uninvoiced: number;
  /** Advance still owed on accepted quotes. */
  advancePending: number;
  overdueCount: number;
  overdueMinor: number;
  nextDue: {
    invoiceId: string;
    invoiceNumber: string;
    dueAt: string | null;
    amountMinor: number;
  } | null;
  lastPaymentAt: string | null;
  invoiceCount: number;
};

const AGREED_QUOTE = ["accepted", "converted"];
const DEAD_INVOICE = new Set(["void", "refunded", "draft"]);

const EMPTY: FinancialSummary = {
  total: 0,
  paid: 0,
  pending: 0,
  contracted: 0,
  invoiced: 0,
  outstanding: 0,
  uninvoiced: 0,
  advancePending: 0,
  overdueCount: 0,
  overdueMinor: 0,
  nextDue: null,
  lastPaymentAt: null,
  invoiceCount: 0,
};

export type FinanceInvoiceRow = {
  id?: string;
  invoice_number?: string;
  status: string;
  total_minor?: number | null;
  amount_paid_minor?: number | null;
  due_at?: string | null;
  paid_at?: string | null;
};

export type FinanceQuoteRow = {
  status: string;
  total_minor?: number | null;
  advance_minor?: number | null;
  paid_advance_minor?: number | null;
};

/**
 * Shared money math for client cards, project handover, and money summaries.
 *
 * Advance settlement only invoices the deposit. Once that invoice is paid,
 * invoice pending is zero — but the rest of the agreed quote is still owed.
 * Billable total is therefore max(contracted, invoiced), not invoiced alone.
 */
export function summarizeFinancials(
  invoices: FinanceInvoiceRow[],
  quotes: FinanceQuoteRow[],
): FinancialSummary {
  const live = invoices.filter((inv) => !DEAD_INVOICE.has(String(inv.status)));

  const invoiced = live.reduce(
    (sum, inv) => sum + Number(inv.total_minor ?? 0),
    0,
  );
  const paid = live.reduce(
    (sum, inv) => sum + Number(inv.amount_paid_minor ?? 0),
    0,
  );

  const contracted = quotes
    .filter((q) => AGREED_QUOTE.includes(String(q.status)))
    .reduce((sum, q) => sum + Number(q.total_minor ?? 0), 0);

  const uninvoiced = Math.max(0, contracted - invoiced);
  const billable = Math.max(contracted, invoiced);
  const split = moneySplit(billable, paid);
  const outstanding = split.pending;

  const advancePending = quotes.reduce((sum, q) => {
    if (!AGREED_QUOTE.includes(String(q.status))) return sum;
    const target = Number(q.advance_minor ?? 0) || Number(q.total_minor ?? 0);
    const advancePaid = Number(q.paid_advance_minor ?? 0);
    return sum + Math.max(0, target - advancePaid);
  }, 0);

  const today = new Date().toISOString().slice(0, 10);
  const open = live.filter(
    (inv) => Number(inv.total_minor ?? 0) > Number(inv.amount_paid_minor ?? 0),
  );
  const overdue = open.filter(
    (inv) => inv.due_at && String(inv.due_at) < today,
  );

  const nextInvoice =
    [...open]
      .filter((inv) => inv.due_at)
      .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))[0] ??
    open[0] ??
    null;

  const lastPaymentAt =
    live
      .map((inv) => inv.paid_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    ...split,
    contracted,
    invoiced,
    outstanding,
    uninvoiced,
    advancePending,
    overdueCount: overdue.length,
    overdueMinor: overdue.reduce(
      (sum, inv) =>
        sum +
        Math.max(
          0,
          Number(inv.total_minor ?? 0) - Number(inv.amount_paid_minor ?? 0),
        ),
      0,
    ),
    nextDue: nextInvoice
      ? {
          invoiceId: String(nextInvoice.id ?? ""),
          invoiceNumber: String(nextInvoice.invoice_number ?? ""),
          dueAt: nextInvoice.due_at ?? null,
          amountMinor: Math.max(
            0,
            Number(nextInvoice.total_minor ?? 0) -
              Number(nextInvoice.amount_paid_minor ?? 0),
          ),
        }
      : null,
    lastPaymentAt,
    invoiceCount: live.length,
  };
}

/**
 * One answer to "how much has this client paid us, and what's still open."
 * Every money surface reads this instead of re-deriving totals per page.
 */
export async function getClientFinancialSummary(
  organizationId: string,
): Promise<FinancialSummary> {
  const admin = getSupabaseAdmin();
  if (!admin || !organizationId) return EMPTY;

  const [invoicesRes, quotesRes] = await Promise.all([
    admin
      .from("invoices")
      .select(
        "id, invoice_number, status, total_minor, amount_paid_minor, due_at, paid_at",
      )
      .eq("organization_id", organizationId),
    admin
      .from("quotes")
      .select("status, total_minor, advance_minor, paid_advance_minor")
      .eq("organization_id", organizationId),
  ]);

  return summarizeFinancials(
    (invoicesRes.data ?? []) as FinanceInvoiceRow[],
    (quotesRes.data ?? []) as FinanceQuoteRow[],
  );
}

export async function getProjectFinancialSummary(
  projectId: string,
): Promise<FinancialSummary> {
  const admin = getSupabaseAdmin();
  if (!admin || !projectId) return EMPTY;

  const [invoicesRes, quotesRes] = await Promise.all([
    admin
      .from("invoices")
      .select(
        "id, invoice_number, status, total_minor, amount_paid_minor, due_at, paid_at",
      )
      .eq("project_id", projectId),
    admin
      .from("quotes")
      .select("status, total_minor, advance_minor, paid_advance_minor")
      .eq("project_id", projectId),
  ]);

  return summarizeFinancials(
    (invoicesRes.data ?? []) as FinanceInvoiceRow[],
    (quotesRes.data ?? []) as FinanceQuoteRow[],
  );
}
