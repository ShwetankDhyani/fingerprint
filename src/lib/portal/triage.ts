import "server-only";

import { formatInr } from "@/lib/portal/format";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type TriageItem = {
  id: string;
  /** Who this is about — client or lead name, first thing an admin reads. */
  who: string;
  what: string;
  /** Exact IST timestamp is rendered by the page from this ISO value. */
  at: string | null;
  href: string;
  amountMinor?: number | null;
  badge?: string | null;
  severity: "calm" | "warn" | "hot";
};

export type TriageBoard = {
  needsReply: TriageItem[];
  needsDecision: TriageItem[];
  moneyDue: TriageItem[];
  inDelivery: TriageItem[];
  totals: {
    replies: number;
    decisions: number;
    moneyMinor: number;
    live: number;
  };
};

const EMPTY: TriageBoard = {
  needsReply: [],
  needsDecision: [],
  moneyDue: [],
  inDelivery: [],
  totals: { replies: 0, decisions: 0, moneyMinor: 0, live: 0 },
};

const DAY = 24 * 60 * 60 * 1000;

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / (60 * 60 * 1000);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.round((time - Date.now()) / DAY);
}

function newest<T extends { created_at?: string | null }>(rows: T[] | null | undefined) {
  return (rows ?? [])
    .slice()
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}

/**
 * What needs a human right now, grouped by the decision the admin has to make
 * rather than by which table the row lives in.
 */
export async function fetchAdminTriage(): Promise<TriageBoard> {
  const admin = getSupabaseAdmin();
  if (!admin) return EMPTY;

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);

  const [leadsRes, ticketsRes, threadsRes, quotesRes, invoicesRes, projectsRes, milestonesRes] =
    await Promise.all([
      admin
        .from("leads")
        .select("id, name, company, email, status, created_at, updated_at, project_type")
        .in("status", ["new", "contacted"])
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("threads")
        .select(
          "id, ticket_number, subject, status, priority, updated_at, last_reply_at, organizations(name), messages(id, created_at, internal_only, profiles(role, full_name))",
        )
        .eq("kind", "support")
        .in("status", ["open", "pending"])
        .order("updated_at", { ascending: false })
        .limit(40),
      admin
        .from("threads")
        .select(
          "id, subject, kind, status, updated_at, organizations(name), messages(id, created_at, internal_only, profiles(role, full_name))",
        )
        .in("kind", ["project", "general"])
        .not("status", "in", "(closed,resolved)")
        .order("updated_at", { ascending: false })
        .limit(40),
      admin
        .from("quotes")
        .select(
          "id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor, valid_until, sent_at, created_at, updated_at, recipient_name, organizations(name)",
        )
        .in("status", ["draft", "sent", "opened", "accepted"])
        .order("created_at", { ascending: false })
        .limit(60),
      admin
        .from("invoices")
        .select(
          "id, invoice_number, status, total_minor, amount_paid_minor, due_at, created_at, organizations(name), projects(name)",
        )
        .in("status", ["sent", "partial", "overdue"])
        .order("due_at", { ascending: true })
        .limit(60),
      admin
        .from("projects")
        .select("id, name, code, status, updated_at, organizations(name)")
        .in("status", ["intake", "active", "review"])
        .order("updated_at", { ascending: false })
        .limit(40),
      admin
        .from("milestones")
        .select("id, title, due_at, status, project_id, projects(id, name, organizations(name))")
        .lt("due_at", today)
        .neq("status", "done")
        .order("due_at", { ascending: true })
        .limit(30),
    ]);

  const needsReply: TriageItem[] = [];
  const needsDecision: TriageItem[] = [];
  const moneyDue: TriageItem[] = [];
  const inDelivery: TriageItem[] = [];

  for (const lead of leadsRes.data ?? []) {
    const isNew = String(lead.status) === "new";
    const idleHours = hoursSince(String(lead.updated_at ?? lead.created_at));
    if (!isNew && idleHours < 48) continue;
    needsReply.push({
      id: `lead:${lead.id}`,
      who: String(lead.company || lead.name),
      what: isNew
        ? `New enquiry — ${lead.project_type || "project"}`
        : `No contact for ${Math.floor(idleHours / 24)} days`,
      at: String(lead.created_at),
      href: `/admin/leads/${lead.id}`,
      badge: isNew ? "New lead" : "Going cold",
      severity: isNew ? "hot" : "warn",
    });
  }

  for (const ticket of ticketsRes.data ?? []) {
    const messages = (ticket.messages ?? []) as Array<{
      created_at?: string | null;
      internal_only?: boolean;
      profiles?: { role?: string } | null;
    }>;
    const last = newest(messages.filter((m) => !m.internal_only));
    const lastRole = String(last?.profiles?.role ?? "");
    const awaitingUs = !lastRole || lastRole.startsWith("CLIENT");
    if (!awaitingUs) continue;
    const org = ticket.organizations as { name?: string } | null;
    needsReply.push({
      id: `ticket:${ticket.id}`,
      who: org?.name ?? "Client",
      what: `${ticket.ticket_number ?? "Ticket"} · ${ticket.subject}`,
      at: String(last?.created_at ?? ticket.last_reply_at ?? ticket.updated_at),
      href: `/admin/tickets/${ticket.id}`,
      badge: String(ticket.priority ?? "normal"),
      severity:
        String(ticket.priority) === "urgent" || String(ticket.priority) === "high"
          ? "hot"
          : "warn",
    });
  }

  for (const thread of threadsRes.data ?? []) {
    const messages = (thread.messages ?? []) as Array<{
      created_at?: string | null;
      internal_only?: boolean;
      profiles?: { role?: string } | null;
    }>;
    const last = newest(messages.filter((m) => !m.internal_only));
    if (!last) continue;
    const lastRole = String(last.profiles?.role ?? "");
    if (!lastRole.startsWith("CLIENT")) continue;
    const org = thread.organizations as { name?: string } | null;
    needsReply.push({
      id: `thread:${thread.id}`,
      who: org?.name ?? "Client",
      what: `Message · ${thread.subject}`,
      at: String(last.created_at ?? thread.updated_at),
      href: `/admin/inbox?channel=clients&thread=${thread.id}`,
      badge: "Unanswered",
      severity: hoursSince(String(last.created_at)) > 24 ? "hot" : "warn",
    });
  }

  for (const quote of quotesRes.data ?? []) {
    const org = quote.organizations as { name?: string } | null;
    const who = org?.name || String(quote.recipient_name || "Prospect");
    const status = String(quote.status);
    const expiresIn = daysUntil(quote.valid_until as string | null);

    if (status === "draft") {
      needsDecision.push({
        id: `quote:${quote.id}`,
        who,
        what: `Draft quote not sent — ${quote.title}`,
        at: String(quote.created_at),
        href: `/admin/quotes/${quote.id}`,
        amountMinor: Number(quote.total_minor ?? 0),
        badge: "Send it",
        severity: hoursSince(String(quote.created_at)) > 48 ? "hot" : "warn",
      });
      continue;
    }

    if (status === "accepted" && Number(quote.paid_advance_minor ?? 0) === 0) {
      needsDecision.push({
        id: `quote:${quote.id}`,
        who,
        what: `Accepted but advance unpaid — ${quote.quote_number}`,
        at: String(quote.updated_at ?? quote.created_at),
        href: `/admin/quotes/${quote.id}`,
        amountMinor:
          Number(quote.advance_minor ?? 0) || Number(quote.total_minor ?? 0),
        badge: "Raise invoice",
        severity: "hot",
      });
      continue;
    }

    if (status === "sent" || status === "opened") {
      const waiting = hoursSince(String(quote.sent_at ?? quote.created_at));
      const expiring = expiresIn !== null && expiresIn <= 3;
      if (waiting < 72 && !expiring) continue;
      needsDecision.push({
        id: `quote:${quote.id}`,
        who,
        what: expiring
          ? `Quote expires ${expiresIn === 0 ? "today" : `in ${expiresIn} days`} — ${quote.quote_number}`
          : `Waiting ${Math.floor(waiting / 24)} days for a reply — ${quote.quote_number}`,
        at: String(quote.sent_at ?? quote.created_at),
        href: `/admin/quotes/${quote.id}`,
        amountMinor: Number(quote.total_minor ?? 0),
        badge: expiring ? "Expiring" : "Chase",
        severity: expiring ? "hot" : "warn",
      });
    }
  }

  for (const invoice of invoicesRes.data ?? []) {
    const balance = Math.max(
      0,
      Number(invoice.total_minor ?? 0) - Number(invoice.amount_paid_minor ?? 0),
    );
    if (balance <= 0) continue;
    const dueAt = invoice.due_at as string | null;
    const overdue = Boolean(dueAt && dueAt < today);
    const dueSoon = Boolean(dueAt && dueAt >= today && dueAt <= soon);
    if (!overdue && !dueSoon && String(invoice.status) !== "overdue") continue;

    const org = invoice.organizations as { name?: string } | null;
    const project = invoice.projects as { name?: string } | null;
    moneyDue.push({
      id: `invoice:${invoice.id}`,
      who: org?.name ?? "Client",
      what: `${invoice.invoice_number}${project?.name ? ` · ${project.name}` : ""}`,
      at: dueAt,
      href: `/admin/invoices/${invoice.id}`,
      amountMinor: balance,
      badge: overdue ? "Overdue" : "Due soon",
      severity: overdue ? "hot" : "warn",
    });
  }

  const overdueByProject = new Map<string, number>();
  for (const milestone of milestonesRes.data ?? []) {
    const projectId = String(milestone.project_id);
    overdueByProject.set(projectId, (overdueByProject.get(projectId) ?? 0) + 1);
  }

  for (const project of projectsRes.data ?? []) {
    const org = project.organizations as { name?: string } | null;
    const overdueCount = overdueByProject.get(String(project.id)) ?? 0;
    const idleDays = Math.floor(hoursSince(String(project.updated_at)) / 24);
    inDelivery.push({
      id: `project:${project.id}`,
      who: org?.name ?? "Client",
      what: `${project.name}${project.code ? ` · ${project.code}` : ""}`,
      at: String(project.updated_at),
      href: `/admin/projects/${project.id}`,
      badge:
        overdueCount > 0
          ? `${overdueCount} milestone${overdueCount === 1 ? "" : "s"} overdue`
          : idleDays >= 7
            ? `Quiet ${idleDays} days`
            : String(project.status),
      severity: overdueCount > 0 ? "hot" : idleDays >= 7 ? "warn" : "calm",
    });
  }

  const bySeverity = (a: TriageItem, b: TriageItem) => {
    const rank = { hot: 0, warn: 1, calm: 2 };
    if (rank[a.severity] !== rank[b.severity]) {
      return rank[a.severity] - rank[b.severity];
    }
    return String(a.at ?? "").localeCompare(String(b.at ?? ""));
  };

  needsReply.sort(bySeverity);
  needsDecision.sort(bySeverity);
  moneyDue.sort(bySeverity);
  inDelivery.sort(bySeverity);

  return {
    needsReply,
    needsDecision,
    moneyDue,
    inDelivery,
    totals: {
      replies: needsReply.length,
      decisions: needsDecision.length,
      moneyMinor: moneyDue.reduce((sum, item) => sum + Number(item.amountMinor ?? 0), 0),
      live: inDelivery.length,
    },
  };
}

/** Human money line for a triage row. */
export function triageAmount(item: TriageItem) {
  return item.amountMinor ? formatInr(Number(item.amountMinor)) : null;
}
