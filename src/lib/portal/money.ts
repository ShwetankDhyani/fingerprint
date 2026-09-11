import type { EntityPeekData, PeekTone } from "@/components/portal/entity-peek";
import {
  INVOICE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { formatDate, formatDateTime, formatInr } from "@/lib/portal/utils";


function unwrapRel<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}


const ACTION_INVOICE = new Set(["sent", "partial", "overdue"]);
const SETTLED_INVOICE = new Set(["paid", "void", "refunded"]);
const ACTION_QUOTE = new Set(["sent", "opened"]);
const SETTLED_QUOTE = new Set([
  "accepted",
  "converted",
  "declined",
  "expired",
]);
const ACTIVE_PROJECT = new Set([
  "intake",
  "active",
  "review",
  "launched",
  "maintenance",
]);

export function invoiceBalance(
  total: number | null | undefined,
  paid: number | null | undefined,
) {
  return Math.max(0, Number(total ?? 0) - Number(paid ?? 0));
}

export function invoiceNeedsAction(status: string, balance: number) {
  if (balance <= 0) return false;
  return ACTION_INVOICE.has(status);
}

export function invoiceIsSettled(status: string, balance: number) {
  return balance <= 0 || SETTLED_INVOICE.has(status);
}

export function quoteNeedsAction(status: string) {
  return ACTION_QUOTE.has(status);
}

export function quoteIsSettled(status: string) {
  return SETTLED_QUOTE.has(status);
}

export function projectIsLive(status: string) {
  return ACTIVE_PROJECT.has(status);
}

export function statusTone(kind: "invoice" | "quote" | "project", status: string): PeekTone {
  if (kind === "invoice") {
    if (status === "paid") return "green";
    if (status === "overdue") return "red";
    if (status === "partial" || status === "sent") return "gold";
    return "muted";
  }
  if (kind === "quote") {
    if (status === "accepted" || status === "converted") return "green";
    if (status === "declined" || status === "expired") return "red";
    if (status === "sent" || status === "opened") return "gold";
    return "muted";
  }
  if (status === "active" || status === "launched" || status === "maintenance")
    return "green";
  if (status === "paused" || status === "archived") return "muted";
  return "gold";
}

type OrgBits = { name?: string | null; billing_email?: string | null } | null;
type ProjectBits = {
  id?: string;
  name?: string | null;
  code?: string | null;
  status?: string | null;
} | null;

export function invoicePeek(inv: {
  id?: string;
  invoice_number: string;
  status: string;
  total_minor: number;
  amount_paid_minor: number;
  due_at?: string | null;
  created_at?: string | null;
  issued_at?: string | null;
  organizations?: OrgBits;
  projects?: ProjectBits;
}): EntityPeekData {
  const balance = invoiceBalance(inv.total_minor, inv.amount_paid_minor);
  const project = unwrapRel(inv.projects as ProjectBits | ProjectBits[]);
  const org = unwrapRel(inv.organizations as OrgBits | OrgBits[]);
  const created = inv.issued_at || inv.created_at;
  return {
    eyebrow: org?.name ?? "Invoice",
    title: project?.name || inv.invoice_number,
    subtitle: project?.name
      ? `${inv.invoice_number}${project.code ? ` · ${project.code}` : ""}`
      : org?.billing_email ?? undefined,
    statusLabel: labelOf(INVOICE_STATUS_LABEL, inv.status),
    statusTone: statusTone("invoice", inv.status),
    href: inv.id ? `/admin/invoices/${inv.id}` : undefined,
    hrefLabel: "Open invoice →",
    facts: [
      { label: "Client", value: org?.name ?? "—" },
      {
        label: "Project",
        value: project?.name
          ? `${project.name}${project.code ? ` (${project.code})` : ""}`
          : "—",
      },
      { label: "Total", value: formatInr(Number(inv.total_minor)) },
      { label: "Paid", value: formatInr(Number(inv.amount_paid_minor)) },
      {
        label: "Pending",
        value: balance > 0 ? formatInr(balance) : "Settled",
      },
      ...(created ? [{ label: "Created", value: formatDateTime(created) }] : []),
      ...(inv.due_at ? [{ label: "Due", value: formatDate(inv.due_at) }] : []),
    ],
  };
}

export function quotePeek(q: {
  id?: string;
  quote_number: string;
  title: string;
  status: string;
  total_minor: number;
  advance_minor?: number | null;
  paid_advance_minor?: number | null;
  valid_until?: string | null;
  created_at?: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  organizations?: OrgBits;
  projects?: ProjectBits;
}): EntityPeekData {
  const project = unwrapRel(q.projects as ProjectBits | ProjectBits[]);
  const org = unwrapRel(q.organizations as OrgBits | OrgBits[]);
  const advance = Number(q.advance_minor ?? 0);
  const paidAdvance = Number(q.paid_advance_minor ?? 0);
  const contact =
    q.recipient_name ||
    q.recipient_email ||
    org?.billing_email ||
    undefined;
  return {
    eyebrow: org?.name ?? "Quote",
    title: project?.name || q.title,
    subtitle: `${q.quote_number}${project?.name ? ` · ${q.title}` : ""}`,
    statusLabel: labelOf(QUOTE_STATUS_LABEL, q.status),
    statusTone: statusTone("quote", q.status),
    href: q.id ? `/admin/quotes/${q.id}` : undefined,
    hrefLabel: "Open quote →",
    facts: [
      { label: "Client", value: org?.name ?? "—" },
      {
        label: "Project",
        value: project?.name
          ? `${project.name}${project.code ? ` (${project.code})` : ""}`
          : "—",
      },
      ...(contact ? [{ label: "Contact", value: contact }] : []),
      { label: "Quote", value: formatInr(Number(q.total_minor)) },
      {
        label: "Advance",
        value: formatInr(advance || Number(q.total_minor)),
      },
      {
        label: "Paid",
        value: formatInr(paidAdvance),
      },
      {
        label: "Pending",
        value:
          Math.max(0, (advance || Number(q.total_minor)) - paidAdvance) > 0
            ? formatInr(
                Math.max(0, (advance || Number(q.total_minor)) - paidAdvance),
              )
            : "Settled",
      },
      ...(q.created_at
        ? [{ label: "Created", value: formatDate(q.created_at) }]
        : []),
      ...(q.valid_until
        ? [{ label: "Valid until", value: formatDate(q.valid_until) }]
        : []),
    ],
  };
}

export function projectPeek(p: {
  id?: string;
  name: string;
  code?: string | null;
  status: string;
  updated_at?: string | null;
  organizations?: OrgBits;
  invoices?: Array<{
    total_minor?: number | null;
    amount_paid_minor?: number | null;
    status?: string | null;
  }> | null;
}): EntityPeekData {
  const invoices = p.invoices ?? [];
  const total = invoices.reduce((s, i) => s + Number(i.total_minor ?? 0), 0);
  const paid = invoices.reduce(
    (s, i) => s + Number(i.amount_paid_minor ?? 0),
    0,
  );
  const due = Math.max(0, total - paid);
  const org = unwrapRel(p.organizations as OrgBits | OrgBits[]);
  return {
    eyebrow: org?.name ?? "Project",
    title: p.name,
    subtitle: p.code ?? undefined,
    statusLabel: labelOf(PROJECT_STATUS_LABEL, p.status),
    statusTone: statusTone("project", p.status),
    href: p.id ? `/admin/projects/${p.id}` : undefined,
    hrefLabel: "Open project →",
    facts: [
      { label: "Client", value: org?.name ?? "—" },
      {
        label: "Stage",
        value: labelOf(PROJECT_STATUS_LABEL, p.status),
      },
      { label: "Invoiced", value: total ? formatInr(total) : "—" },
      { label: "Paid", value: paid ? formatInr(paid) : "—" },
      {
        label: "Pending",
        value: due > 0 ? formatInr(due) : total ? "Settled" : "—",
      },
      ...(p.updated_at
        ? [{ label: "Updated", value: formatDateTime(p.updated_at) }]
        : []),
    ],
  };
}
