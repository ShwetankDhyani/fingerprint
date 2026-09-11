import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { nextProjectCode } from "@/lib/portal/utils";

/**
 * When a quote advance is paid, the client expects a project in "My projects".
 * Creates one if missing, links the quote, and opens a project conversation.
 */
export async function ensureProjectForPaidQuote(
  admin: SupabaseClient,
  quote: {
    id: string;
    title?: string | null;
    quote_number?: string | null;
    organization_id?: string | null;
    project_id?: string | null;
    notes?: string | null;
    summary?: string | null;
  },
  organizationId: string,
): Promise<string | null> {
  if (quote.project_id) {
    // Make sure a paid quote's project isn't stuck in intake forever.
    await admin
      .from("projects")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", quote.project_id)
      .eq("status", "intake");
    return quote.project_id as string;
  }

  const { data: org } = await admin
    .from("organizations")
    .select("slug, name")
    .eq("id", organizationId)
    .maybeSingle();

  const name =
    String(quote.title ?? "").trim() ||
    `${org?.name ?? "Client"} project`;
  const code = nextProjectCode(String(org?.slug ?? "lwx"));
  const summary =
    String(quote.notes ?? quote.summary ?? "").trim() ||
    `Started after advance on ${quote.quote_number ?? "quotation"}`.trim();

  const { data: project, error } = await admin
    .from("projects")
    .insert({
      organization_id: organizationId,
      name,
      code,
      summary,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !project?.id) {
    console.error("[ensure-project] create failed", error?.message);
    return null;
  }

  await admin
    .from("quotes")
    .update({
      project_id: project.id,
      status: "converted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  // Keep invoice linked if one already exists for this quote.
  await admin
    .from("invoices")
    .update({ project_id: project.id })
    .eq("quote_id", quote.id)
    .is("project_id", null);

  await admin.from("threads").insert({
    organization_id: organizationId,
    project_id: project.id,
    subject: `${name} · conversation`,
    kind: "project",
  });

  await admin.from("milestones").insert({
    project_id: project.id,
    title: "Kickoff",
    status: "in_progress",
    client_visible: true,
    sort_order: 0,
  });

  await admin.from("quote_events").insert({
    quote_id: quote.id,
    event_type: "converted",
    summary: `Project ${code} opened after advance payment`,
    meta: { projectId: project.id },
  });

  return project.id as string;
}
