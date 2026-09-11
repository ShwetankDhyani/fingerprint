import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STAFF"]);
const CLIENT_ROLES = new Set(["CLIENT", "CLIENT_VIEWER"]);
/** Internal studio org slug(s) — never treated as a client company. */
const STUDIO_SLUGS = new Set(["lynx-studio"]);

export function isStaffProfileRole(role?: string | null) {
  return STAFF_ROLES.has(String(role ?? ""));
}

export function isClientProfileRole(role?: string | null) {
  return CLIENT_ROLES.has(String(role ?? ""));
}

/**
 * Ensures a portal profile for `email` can see an organization's quotes/invoices.
 * Used when sending quotes and after payments so email remains the identity key.
 * Staff/admin accounts are never attached to client orgs — one email, one role.
 */
export async function ensureEmailMembership(
  admin: SupabaseClient,
  input: {
    email?: string | null;
    organizationId?: string | null;
    memberRole?: "owner" | "contact" | "viewer";
  },
) {
  const email = input.email?.trim().toLowerCase();
  const organizationId = input.organizationId;
  if (!email || !organizationId) {
    return { linked: false as const, reason: "missing_email_or_org" as const };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();

  if (!profile?.id) {
    return { linked: false as const, reason: "no_profile" as const };
  }

  // Never attach staff/super-admin into client orgs.
  if (isStaffProfileRole(String(profile.role))) {
    return { linked: false as const, reason: "staff_profile" as const };
  }

  const { error } = await admin.from("organization_members").upsert(
    {
      organization_id: organizationId,
      user_id: profile.id,
      member_role: input.memberRole ?? "owner",
      can_comment: true,
      can_approve: true,
      can_pay: true,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) {
    console.error("[access] ensureEmailMembership failed", error.message);
    return { linked: false as const, reason: "upsert_failed" as const };
  }

  return { linked: true as const, userId: profile.id as string };
}

/** Resolve an organization id from a client email (membership or billing email). */
export async function resolveOrganizationIdForEmail(
  admin: SupabaseClient,
  email?: string | null,
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .ilike("email", normalized)
    .maybeSingle();

  // Staff emails are never treated as client identities.
  if (profile?.id && isStaffProfileRole(String(profile.role))) {
    return null;
  }

  if (profile?.id) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id, organizations(slug)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: true })
      .limit(5);

    for (const row of membership ?? []) {
      const slug = String(
        (row.organizations as { slug?: string } | null)?.slug ?? "",
      );
      if (STUDIO_SLUGS.has(slug)) continue;
      if (row.organization_id) return row.organization_id as string;
    }
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, slug")
    .ilike("billing_email", normalized)
    .limit(1)
    .maybeSingle();

  if (org?.id && !STUDIO_SLUGS.has(String(org.slug ?? ""))) {
    return org.id as string;
  }

  return null;
}

/**
 * Ensure a client organization exists for a paid / sent quote.
 * Looks up by email first; otherwise creates a real Clients-page org from the
 * recipient details so admin never loses a paying prospect.
 */
export async function ensureClientOrganization(
  admin: SupabaseClient,
  input: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    fallbackName?: string | null;
    leadId?: string | null;
  },
): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  const contactName =
    String(input.name ?? "").trim() ||
    String(input.fallbackName ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "Client";

  if (email) {
    const existing = await resolveOrganizationIdForEmail(admin, email);
    if (existing) {
      if (input.leadId) {
        await markLeadConverted(admin, {
          leadId: input.leadId,
          organizationId: existing,
        });
      } else {
        await markLeadConverted(admin, {
          email,
          organizationId: existing,
        });
      }
      return existing;
    }
  }

  const { slugify } = await import("@/lib/portal/utils");
  const base = slugify(contactName) || slugify(email ?? "client") || "client";
  const slug = `${base}-${Date.now().toString(36).slice(-4)}`;

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: contactName,
      slug,
      billing_email: email,
      phone,
      primary_contact_name: contactName,
      notes_internal: email
        ? `Auto-created from quotation payment / recipient ${email}.`
        : "Auto-created from quotation payment.",
      meta: { source: "quote_settlement" },
      ...(input.leadId ? { lead_id: input.leadId } : {}),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[access] ensureClientOrganization failed", error?.message);
    return null;
  }

  if (email) {
    await ensureEmailMembership(admin, {
      email,
      organizationId: data.id as string,
      memberRole: "owner",
    });
  }

  if (input.leadId) {
    await markLeadConverted(admin, {
      leadId: input.leadId,
      organizationId: data.id as string,
    });
  }

  return data.id as string;
}

/**
 * Find or create a CRM lead from recipient details. Used when quoting a
 * prospect so they stay on Leads until advance payment — not Clients yet.
 */
export async function ensureLeadRecord(
  admin: SupabaseClient,
  input: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    phone?: string | null;
    projectType?: string | null;
    scope?: string | null;
    source?: string | null;
  },
): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const name =
    String(input.name ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "Lead";

  if (email) {
    const { data: existing } = await admin
      .from("leads")
      .select("id, status")
      .ilike("email", email)
      .not("status", "eq", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      if (existing.status === "new") {
        await admin
          .from("leads")
          .update({
            status: "contacted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("status", "new");
      }
      return existing.id as string;
    }
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      name,
      email: email ?? `${slugifySafe(name)}@unknown.local`,
      company: String(input.company ?? "").trim() || name,
      project_type: String(input.projectType ?? "").trim() || "custom",
      budget: "tbd",
      timeline: "tbd",
      scope:
        String(input.scope ?? "").trim() ||
        "Created from admin quotation before advance payment.",
      status: "contacted",
      source: input.source ?? "admin_quote",
      meta: {
        phone: input.phone ?? null,
        seeded_from: "admin_quote",
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[access] ensureLeadRecord failed", error?.message);
    return null;
  }
  return data.id as string;
}

function slugifySafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "lead";
}

/** Mark a lead converted and attach it to the paying client org. */
export async function markLeadConverted(
  admin: SupabaseClient,
  input: {
    leadId?: string | null;
    email?: string | null;
    organizationId?: string | null;
  },
) {
  let leadId = input.leadId ?? null;
  const email = input.email?.trim().toLowerCase() || null;

  if (!leadId && email) {
    const { data } = await admin
      .from("leads")
      .select("id")
      .ilike("email", email)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    leadId = (data?.id as string | undefined) ?? null;
  }
  if (!leadId) return null;

  const { data: existing } = await admin
    .from("leads")
    .select("meta")
    .eq("id", leadId)
    .maybeSingle();
  const priorMeta =
    existing?.meta && typeof existing.meta === "object"
      ? (existing.meta as Record<string, unknown>)
      : {};

  await admin
    .from("leads")
    .update({
      status: "converted",
      updated_at: new Date().toISOString(),
      meta: {
        ...priorMeta,
        converted_at: new Date().toISOString(),
        organization_id: input.organizationId ?? null,
      },
    })
    .eq("id", leadId);

  if (input.organizationId) {
    await admin
      .from("organizations")
      .update({ lead_id: leadId })
      .eq("id", input.organizationId)
      .is("lead_id", null);
  }

  return leadId;
}

/**
 * Remove a user from all client organizations (keeps studio shell membership if any).
 * Call when promoting someone to staff/admin so they stop appearing as a client contact.
 */
export async function detachStaffFromClientOrgs(
  admin: SupabaseClient,
  userId: string,
) {
  const { data: memberships } = await admin
    .from("organization_members")
    .select("id, organization_id, organizations(slug)")
    .eq("user_id", userId);

  const toDelete = (memberships ?? [])
    .filter((row) => {
      const slug = String(
        (row.organizations as { slug?: string } | null)?.slug ?? "",
      );
      return !STUDIO_SLUGS.has(slug);
    })
    .map((row) => String(row.id));

  if (!toDelete.length) return { removed: 0 };

  const { error } = await admin
    .from("organization_members")
    .delete()
    .in("id", toDelete);
  if (error) throw new Error(error.message);
  return { removed: toDelete.length };
}

/**
 * One email → one account. Blocks client invites for staff emails and
 * staff invites that would collide awkwardly; returns existing profile when present.
 */
export async function assertEmailInviteAllowed(
  admin: SupabaseClient,
  input: { email: string; role: string },
) {
  const email = input.email.trim().toLowerCase();
  const invitingStaff = isStaffProfileRole(input.role);

  const { data: existing } = await admin
    .from("profiles")
    .select("id, email, role, full_name")
    .ilike("email", email)
    .maybeSingle();

  if (!existing) {
    return { existing: null as null, promoteClientToStaff: false };
  }

  const existingStaff = isStaffProfileRole(String(existing.role));

  if (!invitingStaff && existingStaff) {
    throw new Error(
      `${email} is already a panel ${existing.role} account. One email cannot be both admin and client — invite a different client email.`,
    );
  }

  if (invitingStaff && existingStaff) {
    throw new Error(
      `${email} is already on the panel team as ${existing.role}.`,
    );
  }

  // Staff invite for an existing client → promote on accept / immediately.
  if (invitingStaff && isClientProfileRole(String(existing.role))) {
    return {
      existing,
      promoteClientToStaff: true,
    };
  }

  return { existing, promoteClientToStaff: false };
}

/**
 * Backfills organization_members for a signed-in client from billing email,
 * invite history, and quote/invoice recipient emails. Fixes the common case
 * where admin created a project + invite but membership was never linked
 * (e.g. existing auth user, or invite accepted via a broken path).
 */
export async function syncClientMemberships(
  admin: SupabaseClient,
  input: { userId: string; email?: string | null; role?: string | null },
) {
  const email = input.email?.trim().toLowerCase();
  const role = String(input.role ?? "");
  if (!email || !input.userId) return { linked: 0 };
  if (isStaffProfileRole(role)) {
    return { linked: 0 };
  }

  const orgIds = new Set<string>();

  const { data: billingOrgs } = await admin
    .from("organizations")
    .select("id, slug")
    .ilike("billing_email", email);
  for (const row of billingOrgs ?? []) {
    if (row.id && !STUDIO_SLUGS.has(String(row.slug ?? ""))) {
      orgIds.add(String(row.id));
    }
  }

  const { data: inviteOrgs } = await admin
    .from("invites")
    .select("organization_id")
    .ilike("email", email)
    .not("organization_id", "is", null);
  for (const row of inviteOrgs ?? []) {
    if (row.organization_id) orgIds.add(String(row.organization_id));
  }

  const { data: quoteOrgs } = await admin
    .from("quotes")
    .select("organization_id")
    .ilike("recipient_email", email)
    .not("organization_id", "is", null);
  for (const row of quoteOrgs ?? []) {
    if (row.organization_id) orgIds.add(String(row.organization_id));
  }

  let linked = 0;
  for (const organizationId of orgIds) {
    const result = await ensureEmailMembership(admin, {
      email,
      organizationId,
      memberRole: "owner",
    });
    if (result.linked) linked += 1;
  }
  return { linked };
}
