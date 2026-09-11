import "server-only";

import { cliTime, formatInr } from "@/lib/portal/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function fetchAdminDashboard() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      configured: false as const,
      kpis: [
        { label: "Outstanding", value: "—", hint: "DB offline", href: "/admin/invoices", heat: 0 },
        { label: "Active projects", value: "—", hint: "DB offline", href: "/admin/projects", heat: 0 },
        { label: "Overdue milestones", value: "—", hint: "DB offline", href: "/admin/projects", heat: 0 },
        { label: "Open tickets", value: "—", hint: "DB offline", href: "/admin/tickets", heat: 0 },
        { label: "Quotes waiting", value: "—", hint: "DB offline", href: "/admin/quotes", heat: 0 },
      ],
      activity: [] as { ts: string; text: string; action?: string | null; entityType?: string | null }[],
      needsAttention: [] as { title: string; detail: string; href?: string }[],
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [
    orgs,
    projects,
    overdueMilestones,
    openThreads,
    waitingQuotes,
    unpaidInvoices,
    activity,
  ] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["intake", "active", "review"]),
    admin
      .from("milestones")
      .select("id", { count: "exact", head: true })
      .lt("due_at", today)
      .neq("status", "done"),
    admin
      .from("threads")
      .select("id", { count: "exact", head: true })
      .eq("kind", "support")
      .in("status", ["open", "pending"]),
    admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "opened"]),
    admin
      .from("invoices")
      .select(
        "id, total_minor, amount_paid_minor, status, invoice_number, organizations(name)",
      )
      .in("status", ["sent", "partial", "overdue"])
      .limit(20),
    admin
      .from("activity_log")
      .select("created_at, summary, action, entity_type, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const { data: failedEmails } = await admin
    .from("email_log")
    .select("to_email, template, error, created_at")
    .neq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(3);

  const outstanding = (unpaidInvoices.data ?? []).reduce((sum, row) => {
    return (
      sum +
      Math.max(0, Number(row.total_minor) - Number(row.amount_paid_minor))
    );
  }, 0);

  return {
    configured: true as const,
    kpis: [
      {
        label: "Outstanding",
        value: formatInr(outstanding),
        hint: `${unpaidInvoices.data?.length ?? 0} open invoices`,
        href: "/admin/invoices",
        heat: Math.min(1, outstanding / 50000000),
      },
      {
        label: "Active projects",
        value: String(projects.count ?? 0),
        hint: `${orgs.count ?? 0} orgs`,
        href: "/admin/projects",
        heat: Math.min(1, (projects.count ?? 0) / 8),
      },
      {
        label: "Overdue milestones",
        value: String(overdueMilestones.count ?? 0),
        hint: "past due",
        href: "/admin/projects",
        heat: Math.min(1, (overdueMilestones.count ?? 0) / 3),
      },
      {
        label: "Open tickets",
        value: String(openThreads.count ?? 0),
        hint: "support queue",
        href: "/admin/tickets",
        heat: Math.min(1, (openThreads.count ?? 0) / 5),
      },
      {
        label: "Quotes waiting",
        value: String(waitingQuotes.count ?? 0),
        hint: "sent / opened",
        href: "/admin/quotes",
        heat: Math.min(1, (waitingQuotes.count ?? 0) / 4),
      },
    ],
    activity: (activity.data ?? []).map((row) => {
      const org = row.organizations as { name?: string } | null;
      return {
        ts: cliTime(row.created_at as string),
        text: org?.name
          ? `${org.name} → ${row.summary}`
          : String(row.summary),
        action: (row.action as string | null) ?? null,
        entityType: (row.entity_type as string | null) ?? null,
      };
    }),
    needsAttention: (failedEmails ?? []).map((row) => ({
      title: `Email not delivered · ${row.template}`,
      detail: `${row.to_email} — ${row.error ?? "unknown error"}`,
    })),
  };
}

export type ListFilters = {
  /** When set (client portal), also include rows addressed to this email. */
  clientEmail?: string;
  /** Free text: name, email, phone, quote/invoice/ticket number. */
  q?: string;
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
  org?: string;
};

function like(value: string) {
  return `%${value.replace(/[%,()]/g, " ").trim()}%`;
}

/** Deduplicate rows from parallel org/email queries, newest first. */
function mergeByCreatedAt<T extends { id: string | number; created_at?: string | null }>(
  results: Array<{ data: T[] | null }>,
): T[] {
  const byId = new Map<string, T>();
  for (const result of results) {
    for (const row of result.data ?? []) {
      byId.set(String(row.id), row);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
}

/**
 * Organizations (and their members) matching a free-text term.
 * Used so a search for a person's email or phone also finds their quotes,
 * invoices, projects and tickets.
 */
async function matchingOrganizationIds(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  term: string,
): Promise<string[]> {
  const pattern = like(term);
  const [orgs, profiles] = await Promise.all([
    admin
      .from("organizations")
      .select("id")
      .or(
        [
          `name.ilike.${pattern}`,
          `slug.ilike.${pattern}`,
          `billing_email.ilike.${pattern}`,
          `phone.ilike.${pattern}`,
          `primary_contact_name.ilike.${pattern}`,
        ].join(","),
      )
      .limit(50),
    admin
      .from("profiles")
      .select("id")
      .in("role", ["CLIENT", "CLIENT_VIEWER"])
      .or(
        [
          `full_name.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `phone.ilike.${pattern}`,
        ].join(","),
      )
      .limit(50),
  ]);

  const ids = new Set((orgs.data ?? []).map((row) => row.id as string));
  const userIds = (profiles.data ?? []).map((row) => row.id as string);
  if (userIds.length) {
    const { data: memberships } = await admin
      .from("organization_members")
      .select("organization_id")
      .in("user_id", userIds);
    for (const row of memberships ?? []) {
      ids.add(row.organization_id as string);
    }
  }
  return [...ids];
}

export async function fetchOrganizations(filters: ListFilters = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  let query = admin
    .from("organizations")
    .select(
      "id, name, slug, billing_email, phone, primary_contact_name, health_score, website, notes_internal, created_at, updated_at, projects(id, status), invoices(id, status, total_minor, amount_paid_minor), quotes(id, status, total_minor, advance_minor, paid_advance_minor)",
    )
    .order("created_at", { ascending: false });

  if (filters.q?.trim()) {
    const ids = await matchingOrganizationIds(admin, filters.q.trim());
    if (!ids.length) return [];
    query = query.in("id", ids);
  }
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  const { data } = await query;
  const studioSlugs = new Set(["lynx-studio"]);
  return (data ?? []).filter((org) => !studioSlugs.has(String(org.slug ?? "")));
}

export async function fetchOrganization(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("organizations")
    .select(
      "*, organization_members(id, member_role, can_comment, can_approve, can_pay, user_id, profiles(id, full_name, email, phone, role, account_status, dormant_at)), projects(id, name, code, status, updated_at, meta), quotes(id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor, valid_until, recipient_name, recipient_email, share_token, created_at, projects(id, name, code)), invoices(id, invoice_number, status, total_minor, amount_paid_minor, due_at, issued_at, created_at, projects(id, name, code)), invites(id, email, full_name, role, token_plain, expires_at, accepted_at, last_sent_at, send_error, created_at), threads(id, ticket_number, subject, status, priority, kind)"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function fetchProjects(
  organizationIds?: string[],
  filters: ListFilters = {},
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  let q = admin
    .from("projects")
    .select(
      "id, name, code, status, summary, meta, organization_id, organizations(name, billing_email), invoices(total_minor, amount_paid_minor, status), completed_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (organizationIds) {
    if (!organizationIds.length) return [];
    q = q.in("organization_id", organizationIds);
  }
  if (filters.org) q = q.eq("organization_id", filters.org);
  if (filters.status) q = q.eq("status", filters.status);

  const term = filters.q?.trim();
  if (term) {
    const pattern = like(term);
    const clauses = [`name.ilike.${pattern}`, `code.ilike.${pattern}`];
    const orgIds = await matchingOrganizationIds(admin, term);
    if (orgIds.length) clauses.push(`organization_id.in.(${orgIds.join(",")})`);
    q = q.or(clauses.join(","));
  }

  const { data } = await q;
  return data ?? [];
}

export async function fetchProject(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("projects")
    .select(
      "*, organizations(name, id, billing_email), milestones(*), snapshots(*, snapshot_remarks(*, profiles(full_name, email, role))), threads(id, subject, kind, status), invoices(id, invoice_number, status, total_minor, amount_paid_minor, due_at, paid_at, created_at), quotes(id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function fetchQuotes(
  organizationIds?: string[],
  filters: ListFilters = {},
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const selectCols =
    "id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor, valid_until, recipient_email, recipient_name, recipient_phone, share_token, organization_id, project_id, organizations(name, billing_email, phone), projects(id, name, code, status), created_at";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    if (filters.org) q = q.eq("organization_id", filters.org);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
    const term = filters.q?.trim();
    if (term) {
      const pattern = like(term);
      q = q.or(
        [
          `quote_number.ilike.${pattern}`,
          `title.ilike.${pattern}`,
          `recipient_email.ilike.${pattern}`,
          `recipient_name.ilike.${pattern}`,
          `recipient_phone.ilike.${pattern}`,
        ].join(","),
      );
    }
    return q;
  };

  const clientEmail = filters.clientEmail?.trim().toLowerCase();

  if (organizationIds === undefined) {
    const { data } = await applyFilters(
      admin.from("quotes").select(selectCols).order("created_at", { ascending: false }),
    );
    return data ?? [];
  }

  const orgIds = organizationIds.filter(Boolean);
  if (!orgIds.length && !clientEmail) return [];

  const queries = [];
  if (orgIds.length) {
    queries.push(
      applyFilters(
        admin
          .from("quotes")
          .select(selectCols)
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false }),
      ),
    );
  }
  if (clientEmail) {
    queries.push(
      applyFilters(
        admin
          .from("quotes")
          .select(selectCols)
          .ilike("recipient_email", clientEmail)
          .order("created_at", { ascending: false }),
      ),
    );
  }

  const results = await Promise.all(queries);
  return mergeByCreatedAt(results);
}


export async function fetchQuote(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("quotes")
    .select("*, quote_line_items(*), quote_events(*), organizations(name)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function fetchQuoteByNumber(quoteNumber: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("quotes")
    .select("*, quote_line_items(*), quote_events(event_type, created_at), organizations(name)")
    .eq("quote_number", quoteNumber)
    .maybeSingle();
  return data;
}

export async function fetchInvoices(
  organizationIds?: string[],
  filters: ListFilters = {},
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const selectCols =
    "id, invoice_number, status, total_minor, amount_paid_minor, due_at, issued_at, paid_at, quote_id, project_id, organization_id, organizations(name, billing_email, phone), projects(id, name, code, status), created_at";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    if (filters.org) q = q.eq("organization_id", filters.org);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
    const term = filters.q?.trim();
    if (term) q = q.ilike("invoice_number", like(term));
    return q;
  };

  const clientEmail = filters.clientEmail?.trim().toLowerCase();

  if (organizationIds === undefined) {
    const { data } = await applyFilters(
      admin.from("invoices").select(selectCols).order("created_at", { ascending: false }),
    );
    return data ?? [];
  }

  const orgIds = organizationIds.filter(Boolean);
  if (!orgIds.length && !clientEmail) return [];

  let emailQuoteIds: string[] = [];
  let emailInvoiceIds: string[] = [];
  if (clientEmail) {
    const [{ data: quoteRows }, { data: txRows }, { data: billingOrgs }] =
      await Promise.all([
        admin
          .from("quotes")
          .select("id")
          .ilike("recipient_email", clientEmail),
        admin
          .from("transactions")
          .select("invoice_id")
          .ilike("customer_email", clientEmail)
          .not("invoice_id", "is", null),
        admin
          .from("organizations")
          .select("id")
          .ilike("billing_email", clientEmail),
      ]);
    emailQuoteIds = (quoteRows ?? []).map((row) => String(row.id));
    emailInvoiceIds = [
      ...new Set(
        (txRows ?? [])
          .map((row) => row.invoice_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const org of billingOrgs ?? []) {
      const id = org.id as string;
      if (id && !orgIds.includes(id)) orgIds.push(id);
    }
  }

  const queries = [];
  if (orgIds.length) {
    queries.push(
      applyFilters(
        admin
          .from("invoices")
          .select(selectCols)
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false }),
      ),
    );
  }
  if (emailQuoteIds.length) {
    queries.push(
      applyFilters(
        admin
          .from("invoices")
          .select(selectCols)
          .in("quote_id", emailQuoteIds)
          .order("created_at", { ascending: false }),
      ),
    );
  }
  if (emailInvoiceIds.length) {
    queries.push(
      applyFilters(
        admin
          .from("invoices")
          .select(selectCols)
          .in("id", emailInvoiceIds)
          .order("created_at", { ascending: false }),
      ),
    );
  }
  if (!queries.length) return [];

  const results = await Promise.all(queries);
  let rows = mergeByCreatedAt(results);
  if (clientEmail) {
    rows = rows.filter(
      (row) => String((row as { status?: string | null }).status) !== "draft",
    );
  }
  return rows;
}


export async function fetchTickets(
  organizationIds?: string[],
  filters: ListFilters = {},
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  let q = admin
    .from("threads")
    .select(
      "id, ticket_number, subject, status, priority, category, created_at, updated_at, last_reply_at, organization_id, project_id, organizations(name), projects(name), messages(id)",
    )
    .eq("kind", "support")
    .order("updated_at", { ascending: false });

  if (organizationIds) {
    if (!organizationIds.length) return [];
    q = q.in("organization_id", organizationIds);
  }
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.org) q = q.eq("organization_id", filters.org);

  const term = filters.q?.trim();
  if (term) {
    const pattern = like(term);
    const clauses = [
      `subject.ilike.${pattern}`,
      `ticket_number.ilike.${pattern}`,
      `category.ilike.${pattern}`,
    ];
    const orgIds = await matchingOrganizationIds(admin, term);
    if (orgIds.length) clauses.push(`organization_id.in.(${orgIds.join(",")})`);
    q = q.or(clauses.join(","));
  }

  const { data } = await q;
  return data ?? [];
}

export async function fetchTicket(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("threads")
    .select(
      "*, organizations(name, billing_email, phone), projects(id, name), messages(id, body, created_at, internal_only, author_id, attachments, profiles(full_name, email, role))",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function fetchProjectSnapshots(projectIds: string[], limit = 20) {
  const admin = getSupabaseAdmin();
  if (!admin || projectIds.length === 0) return [];
  const { data } = await admin
    .from("snapshots")
    .select(
      "id, title, changelog, staging_url, status, auto_generated, created_at, published_at, project_id, projects(name)",
    )
    .in("project_id", projectIds)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchInvoice(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("invoices")
    .select(
      "*, invoice_line_items(*), invoice_payments(*), organizations(id, name, slug, billing_email, phone, website, primary_contact_name, notes_internal), projects(id, name, code, status, summary), quotes(id, quote_number, title, status, total_minor, recipient_name, recipient_email, recipient_phone)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function fetchThreads(
  organizationIds?: string[],
  options?: { channel?: "clients" | "team" | "all" },
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const channel = options?.channel ?? "all";
  let q = admin
    .from("threads")
    .select(
      "id, subject, kind, status, updated_at, organization_id, organizations(name), meta, messages(id, body, created_at, internal_only, author_id, profiles(full_name, email, role))",
    )
    .order("updated_at", { ascending: false });

  if (channel === "team") {
    q = q.eq("kind", "internal");
  } else if (channel === "clients") {
    q = q.in("kind", ["project", "general"]);
  } else {
    q = q.neq("kind", "support");
  }

  if (organizationIds) {
    if (!organizationIds.length) return [];
    q = q.in("organization_id", organizationIds);
  }
  const { data } = await q;
  return data ?? [];
}

export async function fetchStaffDirectory() {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, role, account_status, avatar_url, last_login_at, created_at, dormant_reason",
    )
    .in("role", ["SUPER_ADMIN", "ADMIN", "STAFF"])
    .order("full_name", { ascending: true });
  return data ?? [];
}

export async function fetchStaffMember(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, phone, role, account_status, avatar_url, last_login_at, created_at, dormant_at, dormant_reason",
    )
    .eq("id", id)
    .in("role", ["SUPER_ADMIN", "ADMIN", "STAFF"])
    .maybeSingle();
  return data;
}


/** Full teammate profile: recent actions, quotes, conversations, invites. */
export async function fetchStaffMemberProfile(id: string) {
  const admin = getSupabaseAdmin();
  const empty = {
    member: null as Awaited<ReturnType<typeof fetchStaffMember>>,
    activity: [] as {
      ts: string;
      text: string;
      action?: string | null;
      entityType?: string | null;
      href?: string | null;
    }[],
    stats: {
      actions30d: 0,
      quotes: 0,
      messages: 0,
      invites: 0,
      snapshots: 0,
    },
    quotes: [] as {
      id: string;
      quote_number: string;
      title: string;
      status: string;
      total_minor: number;
      created_at: string;
      organizations?: { name?: string } | null;
    }[],
    threads: [] as {
      id: string;
      subject: string;
      kind: string;
      status: string;
      updated_at: string;
      lastBody: string;
      channel: "team" | "clients" | "tickets";
    }[],
    invites: [] as {
      id: string;
      email: string;
      full_name: string;
      role: string;
      created_at: string;
      accepted_at: string | null;
      last_sent_at: string | null;
    }[],
  };

  if (!admin) return empty;

  const member = await fetchStaffMember(id);
  if (!member) return empty;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    activityRes,
    actions30d,
    quotesCount,
    messagesCount,
    invitesCount,
    snapshotsCount,
    quotesRes,
    messagesRes,
    invitesRes,
  ] = await Promise.all([
    admin
      .from("activity_log")
      .select(
        "created_at, summary, action, entity_type, entity_id, organizations(name)",
      )
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", id)
      .gte("created_at", since30d),
    admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("created_by", id),
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("author_id", id),
    admin
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", id),
    admin
      .from("snapshots")
      .select("id", { count: "exact", head: true })
      .eq("created_by", id),
    admin
      .from("quotes")
      .select(
        "id, quote_number, title, status, total_minor, created_at, organizations(name)",
      )
      .eq("created_by", id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("messages")
      .select(
        "id, body, created_at, thread_id, threads(id, subject, kind, status, updated_at)",
      )
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("invites")
      .select(
        "id, email, full_name, role, created_at, accepted_at, last_sent_at",
      )
      .eq("invited_by", id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const activity = (activityRes.data ?? []).map((row) => {
    const org = row.organizations as { name?: string } | null;
    const entityType = (row.entity_type as string | null) ?? null;
    const entityId = (row.entity_id as string | null) ?? null;
    return {
      ts: relativeStamp(row.created_at as string),
      text: org?.name
        ? `${org.name} → ${row.summary}`
        : String(row.summary),
      action: (row.action as string | null) ?? null,
      entityType,
      href: staffActivityHref(entityType, entityId),
    };
  });

  const threadMap = new Map<
    string,
    {
      id: string;
      subject: string;
      kind: string;
      status: string;
      updated_at: string;
      lastBody: string;
      channel: "team" | "clients" | "tickets";
    }
  >();
  for (const row of messagesRes.data ?? []) {
    const thread = row.threads as
      | {
          id?: string;
          subject?: string;
          kind?: string;
          status?: string;
          updated_at?: string;
        }
      | null;
    const tid = String(thread?.id ?? row.thread_id ?? "");
    if (!tid || threadMap.has(tid)) continue;
    const kind = String(thread?.kind ?? "general");
    const channel: "team" | "clients" | "tickets" =
      kind === "internal"
        ? "team"
        : kind === "support"
          ? "tickets"
          : "clients";
    threadMap.set(tid, {
      id: tid,
      subject: String(thread?.subject ?? "Conversation"),
      kind,
      status: String(thread?.status ?? "open"),
      updated_at: String(thread?.updated_at ?? row.created_at),
      lastBody: String(row.body ?? "").slice(0, 140),
      channel,
    });
    if (threadMap.size >= 8) break;
  }

  return {
    member,
    activity,
    stats: {
      actions30d: actions30d.count ?? 0,
      quotes: quotesCount.count ?? 0,
      messages: messagesCount.count ?? 0,
      invites: invitesCount.count ?? 0,
      snapshots: snapshotsCount.count ?? 0,
    },
    quotes: (quotesRes.data ?? []) as typeof empty.quotes,
    threads: [...threadMap.values()],
    invites: (invitesRes.data ?? []) as typeof empty.invites,
  };
}

function relativeStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function staffActivityHref(
  entityType: string | null,
  entityId: string | null,
): string | null {
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
    case "ticket":
      return `/admin/tickets/${entityId}`;
    case "thread":
    case "message":
      return `/admin/inbox?thread=${entityId}`;
    case "snapshot":
      return `/admin/projects`;
    default:
      return null;
  }
}

export async function fetchClientDashboard(
  organizationIds: string[],
  clientEmail?: string | null,
) {
  const admin = getSupabaseAdmin();
  const email = clientEmail?.trim().toLowerCase() || undefined;
  if (!admin || (organizationIds.length === 0 && !email)) {
    return {
      configured: Boolean(admin),
      projects: [] as Awaited<ReturnType<typeof fetchProjects>>,
      invoices: [] as Awaited<ReturnType<typeof fetchInvoices>>,
      quotes: [] as Awaited<ReturnType<typeof fetchQuotes>>,
      tickets: [] as Awaited<ReturnType<typeof fetchTickets>>,
      snapshots: [] as Awaited<ReturnType<typeof fetchProjectSnapshots>>,
      activity: [] as { ts: string; text: string; action?: string | null; entityType?: string | null }[],
      payments: [] as Awaited<ReturnType<typeof fetchPayments>>,
      nextPayment: null as null | {
        amount: string;
        due: string;
        invoiceId: string;
        number: string;
      },
    };
  }

  const emailFilter = email ? { clientEmail: email } : {};
  const [projects, invoices, quotes, activity, tickets, payments] = await Promise.all([
    fetchProjects(organizationIds),
    fetchInvoices(organizationIds, emailFilter),
    fetchQuotes(organizationIds, emailFilter),
    organizationIds.length
      ? admin
          .from("activity_log")
          .select("created_at, summary")
          .in("organization_id", organizationIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as { created_at: string; summary: string }[] }),
    fetchTickets(organizationIds),
    fetchPayments(organizationIds, email),
  ]);

  const snapshots = await fetchProjectSnapshots(
    projects.map((project) => String(project.id)),
    6,
  );

  const openInvoice = invoices.find(
    (inv: { status?: string | null }) =>
      ["sent", "partial", "overdue"].includes(String(inv.status)),
  );

  return {
    configured: true,
    projects,
    invoices,
    quotes,
    payments,
    tickets,
    snapshots,
    activity: (activity.data ?? []).map((row) => ({
      ts: cliTime(row.created_at as string),
      text: String(row.summary),
    })),
    nextPayment: openInvoice
      ? {
          amount: formatInr(
            Math.max(
              0,
              Number(openInvoice.total_minor) -
                Number(openInvoice.amount_paid_minor),
            ),
          ),
          due: String(openInvoice.due_at ?? "TBD"),
          invoiceId: String(openInvoice.id),
          number: String(openInvoice.invoice_number),
        }
      : null,
  };
}


/** Payment ledger visible to a client (by org membership or payer email). */
export async function fetchPayments(
  organizationIds: string[],
  clientEmail?: string | null,
) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const orgIds = organizationIds.filter(Boolean);
  const email = clientEmail?.trim().toLowerCase();
  if (!orgIds.length && !email) return [];

  const selectCols =
    "id, status, plan_slug, plan_name, amount_minor, currency, customer_email, customer_phone, provider_order_id, quote_id, invoice_id, organization_id, created_at, updated_at, invoice_number";

  const queries = [];
  if (orgIds.length) {
    queries.push(
      admin
        .from("transactions")
        .select(selectCols)
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(100),
    );
  }
  if (email) {
    queries.push(
      admin
        .from("transactions")
        .select(selectCols)
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(100),
    );
  }

  const results = await Promise.all(queries);
  return mergeByCreatedAt(results);
}



export async function fetchLeads(filters: ListFilters = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  let query = admin
    .from("leads")
    .select(
      "id, created_at, updated_at, name, email, company, project_type, budget, timeline, selected_plan, scope, status, source, meta",
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);
  if (filters.q?.trim()) {
    const pattern = like(filters.q.trim());
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `company.ilike.${pattern}`,
        `project_type.ilike.${pattern}`,
        `scope.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data: rows } = await query;
  return rows ?? [];
}

export async function fetchLead(id: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("leads")
    .select(
      "id, created_at, updated_at, name, email, company, project_type, budget, timeline, selected_plan, scope, status, source, meta",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const email = String(data.email ?? "").trim().toLowerCase();
  const quoteQueries = [];
  if (email) {
    quoteQueries.push(
      admin
        .from("quotes")
        .select(
          "id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor, recipient_email, recipient_name, created_at, organization_id, meta",
        )
        .ilike("recipient_email", email)
        .order("created_at", { ascending: false })
        .limit(40),
    );
  }
  quoteQueries.push(
    admin
      .from("quotes")
      .select(
        "id, quote_number, title, status, total_minor, advance_minor, paid_advance_minor, recipient_email, recipient_name, created_at, organization_id, meta",
      )
      .contains("meta", { lead_id: id })
      .order("created_at", { ascending: false })
      .limit(40),
  );

  const orgQueries = [
    admin
      .from("organizations")
      .select("id, name, slug, billing_email, lead_id")
      .eq("lead_id", id)
      .limit(5),
  ];
  if (email) {
    orgQueries.push(
      admin
        .from("organizations")
        .select("id, name, slug, billing_email, lead_id")
        .ilike("billing_email", email)
        .limit(5),
    );
  }

  const [quoteResults, orgResults] = await Promise.all([
    Promise.all(quoteQueries),
    Promise.all(orgQueries),
  ]);

  const quotes = mergeByCreatedAt(quoteResults);
  const organizations: Array<{
    id: string;
    name: string;
    slug?: string | null;
    billing_email?: string | null;
    lead_id?: string | null;
  }> = [];
  const seenOrgs = new Set<string>();
  for (const result of orgResults) {
    for (const row of result.data ?? []) {
      const oid = String(row.id);
      if (seenOrgs.has(oid)) continue;
      seenOrgs.add(oid);
      organizations.push(row);
    }
  }

  return {
    ...data,
    quotes,
    organizations,
  };
}
