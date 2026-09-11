import { createHash, randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export {
  cliTime,
  formatDate,
  formatDateTime,
  formatInr,
  paiseFromInr,
  relativeTime,
} from "@/lib/portal/format";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function mintToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function nextProjectCode(orgSlug: string) {
  const prefix =
    orgSlug.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "LWX";
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix}-${stamp}`;
}

export async function nextQuoteNumber(admin: SupabaseClient) {
  const year = new Date().getFullYear();
  const { count } = await admin
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .like("quote_number", `LWX-Q-${year}-%`);
  return `LWX-Q-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function nextInvoiceNumber(admin: SupabaseClient) {
  const year = new Date().getFullYear();
  const { count } = await admin
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .like("invoice_number", `LWX-INV-${year}-%`);
  return `LWX-INV-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function nextTicketNumber(admin: SupabaseClient) {
  const year = new Date().getFullYear();
  const { count } = await admin
    .from("threads")
    .select("*", { count: "exact", head: true })
    .like("ticket_number", `LWX-T-${year}-%`);
  return `LWX-T-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export function olderThan(value: string | number | null | undefined, ms: number) {
  if (value === null || value === undefined) return true;
  const time = typeof value === "number" ? value : new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  return Date.now() - time > ms;
}

export function isPast(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time < Date.now();
}

export async function logActivity(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null;
    projectId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    meta?: Record<string, unknown>;
  },
) {
  await admin.from("activity_log").insert({
    organization_id: input.organizationId ?? null,
    project_id: input.projectId ?? null,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    meta: input.meta ?? {},
  });
}