import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type NotificationKind =
  | "lead"
  | "quote"
  | "money"
  | "ticket"
  | "project"
  | "system";

export type StaffNotification = {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /**
   * Stable per-event key. A cron that re-runs, or a webhook that retries, must
   * not fill the bell with the same line twice.
   */
  dedupeKey?: string | null;
};

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"];

/**
 * Tells the team something needs attention. Without this, work waits until
 * somebody happens to open the right tab.
 */
export async function notifyStaff(input: StaffNotification) {
  const admin = getSupabaseAdmin();
  if (!admin) return { inserted: 0 };

  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .in("role", STAFF_ROLES)
    .eq("account_status", "active");

  let userIds = (staff ?? []).map((row) => String(row.id));
  if (!userIds.length) return { inserted: 0 };

  if (input.dedupeKey) {
    const { data: existing } = await admin
      .from("notifications")
      .select("user_id")
      .eq("dedupe_key", input.dedupeKey)
      .in("user_id", userIds);
    const already = new Set((existing ?? []).map((row) => String(row.user_id)));
    userIds = userIds.filter((id) => !already.has(id));
    if (!userIds.length) return { inserted: 0 };
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    organization_id: input.organizationId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    dedupe_key: input.dedupeKey ?? null,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) {
    // A racing insert hitting the dedupe index is expected, not a failure.
    if (error.code !== "23505") {
      console.error("[notify] insert failed", error);
    }
    return { inserted: 0 };
  }
  return { inserted: rows.length };
}

/** Clears the bell. Passing ids marks just those, otherwise everything unread. */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  const admin = getSupabaseAdmin();
  if (!admin) return { marked: 0 };

  let query = admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (ids?.length) query = query.in("id", ids);

  const { error } = await query;
  if (error) {
    console.error("[notify] mark read failed", error);
    return { marked: 0 };
  }
  return { marked: ids?.length ?? -1 };
}

export type StaffNotificationRow = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
};

export async function fetchStaffNotifications(userId: string, limit = 30) {
  const admin = getSupabaseAdmin();
  if (!admin) return { rows: [] as StaffNotificationRow[], unread: 0 };

  const [{ data }, { count }] = await Promise.all([
    admin
      .from("notifications")
      .select("id, created_at, kind, title, body, href, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  return {
    rows: (data ?? []) as StaffNotificationRow[],
    unread: count ?? 0,
  };
}
