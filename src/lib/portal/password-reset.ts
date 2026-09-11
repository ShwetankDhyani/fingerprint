import "server-only";

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffProfileRole } from "@/lib/portal/access";
import { isProtectedPortalEmail } from "@/lib/portal/auth-safety";

const STUDIO_SLUGS = new Set(["lynx-studio"]);
const STAFF_INVITE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STAFF"]);
const CLIENT_INVITE_ROLES = new Set(["CLIENT", "CLIENT_VIEWER"]);

export type ListedPortalIdentity =
  | {
      source: "team_profile";
      role: string;
      fullName: string | null;
      profileId: string;
    }
  | {
      source: "team_invite";
      role: string;
      fullName: string | null;
      inviteId: string;
    }
  | {
      source: "client_billing";
      role: "CLIENT";
      fullName: string | null;
      organizationId: string;
    }
  | {
      source: "client_invite";
      role: "CLIENT" | "CLIENT_VIEWER";
      fullName: string | null;
      organizationId: string;
      inviteId: string;
    };

function mintTempPassword() {
  return `Lx.${randomBytes(24).toString("base64url")}`;
}

/**
 * An email is "listed" when it already appears on Team or Clients —
 * even if the Auth user was deleted. Those people should still be able
 * to request a password setup link.
 */
export async function findListedPortalIdentity(
  admin: SupabaseClient,
  email: string,
): Promise<ListedPortalIdentity | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, full_name, email")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id && isStaffProfileRole(String(profile.role))) {
    return {
      source: "team_profile",
      role: String(profile.role),
      fullName: (profile.full_name as string | null) ?? null,
      profileId: profile.id as string,
    };
  }

  const { data: staffInvite } = await admin
    .from("invites")
    .select("id, role, full_name, accepted_at, expires_at")
    .ilike("email", normalized)
    .is("accepted_at", null)
    .in("role", [...STAFF_INVITE_ROLES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    staffInvite?.id &&
    new Date(String(staffInvite.expires_at)).getTime() > Date.now()
  ) {
    return {
      source: "team_invite",
      role: String(staffInvite.role),
      fullName: (staffInvite.full_name as string | null) ?? null,
      inviteId: staffInvite.id as string,
    };
  }

  // Prefer an open client invite over bare billing email when both exist.
  const { data: clientInvite } = await admin
    .from("invites")
    .select("id, role, full_name, organization_id, accepted_at, expires_at")
    .ilike("email", normalized)
    .is("accepted_at", null)
    .in("role", [...CLIENT_INVITE_ROLES])
    .not("organization_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    clientInvite?.id &&
    clientInvite.organization_id &&
    new Date(String(clientInvite.expires_at)).getTime() > Date.now()
  ) {
    const role =
      String(clientInvite.role) === "CLIENT_VIEWER"
        ? ("CLIENT_VIEWER" as const)
        : ("CLIENT" as const);
    return {
      source: "client_invite",
      role,
      fullName: (clientInvite.full_name as string | null) ?? null,
      organizationId: clientInvite.organization_id as string,
      inviteId: clientInvite.id as string,
    };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, primary_contact_name")
    .ilike("billing_email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (org?.id && !STUDIO_SLUGS.has(String(org.slug ?? ""))) {
    return {
      source: "client_billing",
      role: "CLIENT",
      fullName:
        (org.primary_contact_name as string | null) ||
        (org.name as string | null) ||
        null,
      organizationId: org.id as string,
    };
  }

  // Existing client profile without Auth (unusual) — still allow reset.
  if (profile?.id && !isStaffProfileRole(String(profile.role))) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id, organizations(slug)")
      .eq("user_id", profile.id)
      .limit(5);

    for (const row of membership ?? []) {
      const slug = String(
        (row.organizations as { slug?: string } | null)?.slug ?? "",
      );
      if (STUDIO_SLUGS.has(slug)) continue;
      if (!row.organization_id) continue;
      return {
        source: "client_billing",
        role: "CLIENT",
        fullName: (profile.full_name as string | null) ?? null,
        organizationId: row.organization_id as string,
      };
    }
  }

  return null;
}

/**
 * Makes sure Auth + profile (+ org membership for clients) exist for a listed
 * email, without exposing a password — the recovery mail is how they choose one.
 */
export async function ensureAuthUserForListedIdentity(
  admin: SupabaseClient,
  email: string,
  identity: ListedPortalIdentity,
): Promise<{ userId: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();

  // Protected humans: never invent a password. Recovery only if Auth still
  // has them. If deleted, refuse silent recreate.
  if (isProtectedPortalEmail(normalized)) {
    const existing = await findAuthUserIdByEmail(admin, normalized);
    if (!existing) {
      return {
        error:
          "Protected panel account is missing from Auth — restore it manually, do not auto-create.",
      };
    }
    return { userId: existing };
  }

  let userId: string | null = null;

  const created = await admin.auth.admin.createUser({
    email: normalized,
    password: mintTempPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: identity.fullName ?? normalized.split("@")[0],
    },
    app_metadata: { role: identity.role },
  });

  if (created.data?.user?.id) {
    userId = created.data.user.id;
  } else {
    const existing = await findAuthUserIdByEmail(admin, normalized);
    if (!existing) {
      return {
        error:
          created.error?.message ??
          "Could not create or find an Auth user for this email.",
      };
    }
    userId = existing;
  }

  const fullName = identity.fullName?.trim() || normalized.split("@")[0];
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    email: normalized,
    full_name: fullName,
    role: identity.role,
    account_status: "active",
    dormant_at: null,
    dormant_by: null,
    dormant_reason: null,
  });
  if (profileErr) {
    return { error: profileErr.message };
  }

  if (
    identity.source === "client_billing" ||
    identity.source === "client_invite"
  ) {
    const { error: memberErr } = await admin.from("organization_members").upsert(
      {
        organization_id: identity.organizationId,
        user_id: userId,
        member_role: identity.role === "CLIENT_VIEWER" ? "viewer" : "owner",
        can_comment: true,
        can_approve: identity.role !== "CLIENT_VIEWER",
        can_pay: identity.role !== "CLIENT_VIEWER",
      },
      { onConflict: "organization_id,user_id" },
    );
    if (memberErr) {
      console.error(
        "[password-reset] membership link failed",
        memberErr.message,
      );
    }
  }

  if (isStaffProfileRole(identity.role)) {
    await admin.from("organization_members").delete().eq("user_id", userId);
  }

  return { userId };
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string) {
  // Prefer getUserByEmail when available on this supabase-js version.
  const adminApi = admin.auth.admin as {
    getUserByEmail?: (
      email: string,
    ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    listUsers: (args: {
      page: number;
      perPage: number;
    }) => Promise<{ data: { users: { id: string; email?: string }[] }; error: unknown }>;
  };

  if (typeof adminApi.getUserByEmail === "function") {
    const { data } = await adminApi.getUserByEmail(email);
    if (data?.user?.id) return data.user.id;
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data } = await adminApi.listUsers({ page, perPage: 200 });
    const match = data?.users?.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}
