import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { syncClientMemberships } from "@/lib/portal/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "STAFF"
  | "CLIENT"
  | "CLIENT_VIEWER";

export type AccountStatus = "active" | "dormant";

export type PortalProfile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
  totp_enabled: boolean;
  account_status: AccountStatus;
  organization_ids: string[];
};

export function isAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isStaffRole(role: AppRole) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";
}

/** Super Admin + Admin — full studio ops. Hard deletes remain Super Admin only. */
export function isAdminRole(role: AppRole) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isSuperAdminRole(role: AppRole) {
  return role === "SUPER_ADMIN";
}

export function isClientRole(role: AppRole) {
  return role === "CLIENT" || role === "CLIENT_VIEWER";
}

export function homeForRole(role: AppRole) {
  return isStaffRole(role) ? "/admin" : "/client";
}

export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* middleware refreshes session */
        }
      },
    },
  });
}

export async function getSessionUser() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}


function safeDisplayName(fullName: string | null | undefined, email: string) {
  const name = (fullName ?? "").trim();
  const local = email.split("@")[0] || "there";
  if (!name) return local;
  // Reject values that look like a password accidentally saved as a name
  // (common when invite autofill dumps the password into the name field).
  const looksLikePassword =
    !/\s/.test(name) &&
    /\d/.test(name) &&
    /[^A-Za-z0-9]/.test(name) &&
    name.length >= 8;
  if (looksLikePassword) return local;
  return name;
}

export async function getPortalProfile(): Promise<PortalProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, role, avatar_url, totp_enabled, account_status",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const status = (profile.account_status as AccountStatus | null) ?? "active";
  if (status === "dormant") {
    const supabase = await createServerSupabase();
    if (supabase) await supabase.auth.signOut();
    return null;
  }

  const role = profile.role as AppRole;
  if (role === "CLIENT" || role === "CLIENT_VIEWER") {
    await syncClientMemberships(admin, {
      userId: user.id,
      email: profile.email as string,
      role,
    });
  }

  const { data: memberships } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  return {
    id: profile.id as string,
    email: profile.email as string,
    full_name: safeDisplayName(profile.full_name as string | null, profile.email as string),
    role,
    avatar_url: (profile.avatar_url as string | null) ?? null,
    totp_enabled: Boolean(profile.totp_enabled),
    account_status: status,
    organization_ids: (memberships ?? []).map(
      (m) => m.organization_id as string,
    ),
  };
}

export async function requirePortalProfile(): Promise<PortalProfile> {
  const profile = await getPortalProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireStaff(): Promise<PortalProfile> {
  const profile = await requirePortalProfile();
  if (!isStaffRole(profile.role)) redirect("/client");
  return profile;
}

export async function requireSuperAdmin(): Promise<PortalProfile> {
  const profile = await requirePortalProfile();
  if (!isSuperAdminRole(profile.role)) redirect("/admin");
  return profile;
}

/** Admin or Super Admin — invite peers, team directory, studio channels. */
export async function requireAdmin(): Promise<PortalProfile> {
  const profile = await requirePortalProfile();
  if (!isAdminRole(profile.role)) redirect("/admin");
  return profile;
}

export async function requireClient(): Promise<PortalProfile> {
  const profile = await requirePortalProfile();
  if (isStaffRole(profile.role)) redirect("/admin");
  return profile;
}
