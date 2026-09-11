import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatInr } from "@/lib/portal/utils";

export type TimelineKind =
  | "lead"
  | "quote"
  | "invoice"
  | "money"
  | "project"
  | "milestone"
  | "ticket"
  | "message"
  | "email"
  | "whatsapp"
  | "system";

export type TimelineEvent = {
  id: string;
  /** ISO timestamp — rendered as exact IST, never relative. */
  at: string;
  kind: TimelineKind;
  title: string;
  /** One quiet line under the title: who, where, how much. */
  detail?: string | null;
  /** Long-form content (email/WhatsApp/message body) shown when expanded. */
  body?: string | null;
  href?: string | null;
  /** Short chips: amount, status, delivery result. */
  chips?: string[];
  tone?: "good" | "warn" | "bad" | null;
};

export type TimelineScope = {
  organizationId?: string | null;
  leadId?: string | null;
  email?: string | null;
  limit?: number;
};

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function iso(value: unknown): string | null {
  const raw = typeof value === "string" ? value : null;
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : raw;
}

function trim(value: unknown, max = 400) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Ids of everything that belongs to this customer, across both shapes. */
async function resolveScopeIds(admin: Admin, scope: TimelineScope) {
  const orgId = scope.organizationId ?? null;
  const leadId = scope.leadId ?? null;
  const email = scope.email?.trim().toLowerCase() || null;

  const quoteQueries = [];
  if (orgId) {
    quoteQueries.push(
      admin.from("quotes").select("id").eq("organization_id", orgId).limit(200),
    );
  }
  if (leadId) {
    quoteQueries.push(
      admin.from("quotes").select("id").contains("meta", { lead_id: leadId }).limit(200),
    );
  }
  if (email) {
    quoteQueries.push(
      admin.from("quotes").select("id").ilike("recipient_email", email).limit(200),
    );
  }

  const [quoteResults, projectRes, threadRes] = await Promise.all([
    Promise.all(quoteQueries),
    orgId
      ? admin.from("projects").select("id").eq("organization_id", orgId).limit(200)
      : Promise.resolve({ data: [] as { id: string }[] }),
    orgId
      ? admin.from("threads").select("id").eq("organization_id", orgId).limit(200)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const quoteIds = [
    ...new Set(
      quoteResults.flatMap((res) => (res.data ?? []).map((row) => String(row.id))),
    ),
  ];
  const projectIds = (projectRes.data ?? []).map((row) => String(row.id));
  const threadIds = (threadRes.data ?? []).map((row) => String(row.id));

  const invoiceQueries = [];
  if (orgId) {
    invoiceQueries.push(
      admin.from("invoices").select("id").eq("organization_id", orgId).limit(200),
    );
  }
  if (quoteIds.length) {
    invoiceQueries.push(
      admin.from("invoices").select("id").in("quote_id", quoteIds).limit(200),
    );
  }
  const invoiceResults = await Promise.all(invoiceQueries);
  const invoiceIds = [
    ...new Set(
      invoiceResults.flatMap((res) => (res.data ?? []).map((row) => String(row.id))),
    ),
  ];

  const entityIds = [
    ...new Set(
      [leadId, orgId, ...quoteIds, ...invoiceIds, ...projectIds, ...threadIds].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  return { orgId, leadId, email, quoteIds, invoiceIds, projectIds, threadIds, entityIds };
}

function hrefForEntity(entityType?: string | null, entityId?: string | null) {
  if (!entityId) return null;
  switch (String(entityType ?? "").toLowerCase()) {
    case "quote":
      return `/admin/quotes/${entityId}`;
    case "invoice":
      return `/admin/invoices/${entityId}`;
    case "project":
      return `/admin/projects/${entityId}`;
    case "organization":
      return `/admin/clients/${entityId}`;
    case "lead":
      return `/admin/leads/${entityId}`;
    case "ticket":
      return `/admin/tickets/${entityId}`;
    case "thread":
    case "message":
      return `/admin/inbox?thread=${entityId}`;
    default:
      return null;
  }
}

function kindForActivity(entityType?: string | null, action?: string | null): TimelineKind {
  const entity = String(entityType ?? "").toLowerCase();
  const verb = String(action ?? "").toLowerCase();
  if (verb === "paid" || entity === "payment") return "money";
  if (entity === "invoice") return "invoice";
  if (entity === "quote") return "quote";
  if (entity === "lead") return "lead";
  if (entity === "milestone" || entity === "snapshot") return "milestone";
  if (entity === "project") return "project";
  if (entity === "ticket") return "ticket";
  if (entity === "thread" || entity === "message") return "message";
  return "system";
}

/**
 * One chronological thread per customer — lead enquiry, every quote, payment,
 * email, WhatsApp, message, milestone and ticket, newest first.
 *
 * Reads only: nothing here writes, so it is safe to call from any page.
 */
export async function fetchCustomerTimeline(
  scope: TimelineScope,
): Promise<TimelineEvent[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  if (!scope.organizationId && !scope.leadId && !scope.email) return [];

  const limit = scope.limit ?? 120;
  const ids = await resolveScopeIds(admin, scope);
  const events: TimelineEvent[] = [];

  const activityQueries = [];
  if (ids.orgId) {
    activityQueries.push(
      admin
        .from("activity_log")
        .select("id, created_at, action, entity_type, entity_id, summary, meta, profiles(full_name, email)")
        .eq("organization_id", ids.orgId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }
  if (ids.entityIds.length) {
    activityQueries.push(
      admin
        .from("activity_log")
        .select("id, created_at, action, entity_type, entity_id, summary, meta, profiles(full_name, email)")
        .in("entity_id", ids.entityIds)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }

  const emailQueries = [];
  if (ids.orgId) {
    emailQueries.push(
      admin
        .from("email_log")
        .select("id, created_at, template, to_email, subject, status, error, entity_type, entity_id")
        .eq("organization_id", ids.orgId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }
  if (ids.entityIds.length) {
    emailQueries.push(
      admin
        .from("email_log")
        .select("id, created_at, template, to_email, subject, status, error, entity_type, entity_id")
        .in("entity_id", ids.entityIds)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }
  if (ids.email) {
    emailQueries.push(
      admin
        .from("email_log")
        .select("id, created_at, template, to_email, subject, status, error, entity_type, entity_id")
        .ilike("to_email", ids.email)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }

  const whatsappQueries = [];
  if (ids.orgId) {
    whatsappQueries.push(
      admin
        .from("whatsapp_log")
        .select("id, created_at, template, to_phone, body, status, error")
        .eq("organization_id", ids.orgId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }
  if (ids.entityIds.length) {
    whatsappQueries.push(
      admin
        .from("whatsapp_log")
        .select("id, created_at, template, to_phone, body, status, error")
        .in("entity_id", ids.entityIds)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
  }

  const [
    activityResults,
    emailResults,
    whatsappResults,
    quoteEventsRes,
    paymentsRes,
    messagesRes,
    milestonesRes,
    leadRes,
    orgRes,
  ] = await Promise.all([
    Promise.all(activityQueries),
    Promise.all(emailQueries),
    Promise.all(whatsappQueries),
    ids.quoteIds.length
      ? admin
          .from("quote_events")
          .select("id, created_at, quote_id, event_type, summary, quotes(quote_number, title)")
          .in("quote_id", ids.quoteIds)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.invoiceIds.length
      ? admin
          .from("invoice_payments")
          .select("id, created_at, invoice_id, amount_minor, method, note, invoices(invoice_number, total_minor, amount_paid_minor)")
          .in("invoice_id", ids.invoiceIds)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.threadIds.length
      ? admin
          .from("messages")
          .select("id, created_at, body, internal_only, thread_id, threads(subject, kind, ticket_number), profiles(full_name, email, role)")
          .in("thread_id", ids.threadIds)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.projectIds.length
      ? admin
          .from("milestones")
          .select("id, title, completed_at, project_id, projects(name, code)")
          .in("project_id", ids.projectIds)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.leadId
      ? admin
          .from("leads")
          .select("id, created_at, name, email, company, project_type, budget, timeline, selected_plan, scope, source")
          .eq("id", ids.leadId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ids.orgId
      ? admin
          .from("organizations")
          .select("id, created_at, name, lead_id")
          .eq("id", ids.orgId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  for (const result of activityResults) {
    for (const row of result.data ?? []) {
      const at = iso(row.created_at);
      if (!at) continue;
      const actor = row.profiles as { full_name?: string; email?: string } | null;
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const amount = Number(meta.amountMinor ?? 0);
      events.push({
        id: `activity:${row.id}`,
        at,
        kind: kindForActivity(row.entity_type as string, row.action as string),
        title: String(row.summary),
        detail: actor?.full_name || actor?.email || "System",
        href: hrefForEntity(row.entity_type as string, row.entity_id as string),
        chips: amount > 0 ? [formatInr(amount)] : undefined,
      });
    }
  }

  for (const result of emailResults) {
    for (const row of result.data ?? []) {
      const at = iso(row.created_at);
      if (!at) continue;
      const failed = String(row.status) !== "sent";
      events.push({
        id: `email:${row.id}`,
        at,
        kind: "email",
        title: String(row.subject || row.template),
        detail: `Email to ${row.to_email}`,
        body: failed ? `Delivery ${row.status}: ${row.error ?? "no provider error"}` : null,
        chips: [String(row.template), String(row.status)],
        tone: failed ? "bad" : "good",
      });
    }
  }

  for (const result of whatsappResults) {
    for (const row of result.data ?? []) {
      const at = iso(row.created_at);
      if (!at) continue;
      const failed = String(row.status) !== "sent";
      events.push({
        id: `whatsapp:${row.id}`,
        at,
        kind: "whatsapp",
        title: `WhatsApp to ${row.to_phone}`,
        detail: String(row.template),
        body: trim(row.body, 1200) ?? (failed ? String(row.error ?? "") : null),
        chips: [String(row.status)],
        tone: failed ? "bad" : "good",
      });
    }
  }

  for (const row of (quoteEventsRes.data ?? []) as Record<string, unknown>[]) {
    const at = iso(row.created_at);
    if (!at) continue;
    const quote = row.quotes as { quote_number?: string; title?: string } | null;
    events.push({
      id: `quote-event:${row.id}`,
      at,
      kind: "quote",
      title: String(row.summary),
      detail: quote?.quote_number
        ? `${quote.quote_number}${quote.title ? ` · ${quote.title}` : ""}`
        : "Quotation",
      href: `/admin/quotes/${row.quote_id}`,
      chips: [String(row.event_type)],
    });
  }

  for (const row of (paymentsRes.data ?? []) as Record<string, unknown>[]) {
    const at = iso(row.created_at);
    if (!at) continue;
    const invoice = row.invoices as
      | { invoice_number?: string; total_minor?: number; amount_paid_minor?: number }
      | null;
    const pending = Math.max(
      0,
      Number(invoice?.total_minor ?? 0) - Number(invoice?.amount_paid_minor ?? 0),
    );
    events.push({
      id: `payment:${row.id}`,
      at,
      kind: "money",
      title: `Payment received — ${formatInr(Number(row.amount_minor))}`,
      detail: `${invoice?.invoice_number ?? "Invoice"} · ${String(row.method)}${
        row.note ? ` · ${row.note}` : ""
      }`,
      href: `/admin/invoices/${row.invoice_id}`,
      chips: [pending > 0 ? `${formatInr(pending)} pending` : "Settled"],
      tone: pending > 0 ? "warn" : "good",
    });
  }

  for (const row of (messagesRes.data ?? []) as Record<string, unknown>[]) {
    const at = iso(row.created_at);
    if (!at) continue;
    const thread = row.threads as
      | { subject?: string; kind?: string; ticket_number?: string }
      | null;
    const author = row.profiles as { full_name?: string; email?: string; role?: string } | null;
    const isTicket = thread?.kind === "support";
    events.push({
      id: `message:${row.id}`,
      at,
      kind: isTicket ? "ticket" : "message",
      title: thread?.subject
        ? `${isTicket ? thread.ticket_number ?? "Ticket" : "Message"} · ${thread.subject}`
        : "Message",
      detail: `${author?.full_name || author?.email || "Someone"}${
        row.internal_only ? " · internal note" : ""
      }`,
      body: trim(row.body, 2000),
      href: isTicket
        ? `/admin/tickets/${row.thread_id}`
        : `/admin/inbox?thread=${row.thread_id}`,
    });
  }

  for (const row of (milestonesRes.data ?? []) as Record<string, unknown>[]) {
    const at = iso(row.completed_at);
    if (!at) continue;
    const project = row.projects as { name?: string; code?: string } | null;
    events.push({
      id: `milestone:${row.id}`,
      at,
      kind: "milestone",
      title: `Milestone done — ${row.title}`,
      detail: project?.name ?? "Project",
      href: `/admin/projects/${row.project_id}`,
      tone: "good",
    });
  }

  const lead = leadRes.data as Record<string, unknown> | null;
  if (lead) {
    const at = iso(lead.created_at);
    if (at) {
      const facts = [
        lead.company ? `Company ${lead.company}` : null,
        lead.project_type ? `Type ${lead.project_type}` : null,
        lead.budget ? `Budget ${lead.budget}` : null,
        lead.timeline ? `Timeline ${lead.timeline}` : null,
        lead.selected_plan ? `Plan ${lead.selected_plan}` : null,
      ].filter(Boolean) as string[];
      events.push({
        id: `lead:${lead.id}`,
        at,
        kind: "lead",
        title: `Enquiry from ${lead.name}`,
        detail: `${lead.email ?? "no email"} · via ${String(lead.source ?? "contact form").replaceAll("_", " ")}`,
        body: [trim(lead.scope, 2000), facts.join(" · ")].filter(Boolean).join("\n\n"),
        href: `/admin/leads/${lead.id}`,
      });
    }
  }

  const org = orgRes.data as Record<string, unknown> | null;
  if (org) {
    const at = iso(org.created_at);
    if (at) {
      events.push({
        id: `org:${org.id}`,
        at,
        kind: "project",
        title: `${org.name} became a client`,
        detail: org.lead_id ? "Converted from lead after advance payment" : "Client record created",
        href: `/admin/clients/${org.id}`,
        tone: "good",
      });
    }
  }

  const seen = new Set<string>();
  return events
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
