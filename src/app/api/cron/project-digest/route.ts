import { NextResponse } from "next/server";

import { sendSnapshotEmail } from "@/lib/email/notifications";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MilestoneRow = {
  title: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  updated_at: string;
  client_visible: boolean;
};

function buildChangelog(
  milestones: MilestoneRow[],
  activityLines: string[],
  since: Date,
) {
  const finished = milestones.filter(
    (m) =>
      m.status === "done" &&
      m.completed_at &&
      new Date(m.completed_at) >= since,
  );
  const inFlight = milestones.filter((m) => m.status === "in_progress");
  const next = milestones
    .filter((m) => m.status === "upcoming")
    .slice(0, 3);

  const parts: string[] = [];
  if (finished.length) {
    parts.push(`Completed: ${finished.map((m) => m.title).join(", ")}.`);
  }
  if (inFlight.length) {
    parts.push(`In progress: ${inFlight.map((m) => m.title).join(", ")}.`);
  }
  if (next.length) {
    parts.push(`Up next: ${next.map((m) => m.title).join(", ")}.`);
  }
  if (activityLines.length) {
    parts.push(`Recent activity: ${activityLines.slice(0, 5).join("; ")}.`);
  }
  return parts.join("\n");
}

/**
 * Daily progress snapshot for every active project.
 * Vercel Cron hits this once a day; it writes a published snapshot the client
 * sees in their portal and emails the same summary to their contacts.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Database offline" }, { status: 503 });
  }

  const url = new URL(request.url);
  const notify = url.searchParams.get("notify") !== "0";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: projects } = await admin
    .from("projects")
    .select("id, name, organization_id, status")
    .in("status", ["active", "review"]);

  const results: Array<{ project: string; created: boolean; reason?: string }> =
    [];

  for (const project of projects ?? []) {
    const projectId = project.id as string;

    const [{ data: milestones }, { data: activity }, { data: recentAuto }] =
      await Promise.all([
        admin
          .from("milestones")
          .select("title, status, due_at, completed_at, updated_at, client_visible")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true }),
        admin
          .from("activity_log")
          .select("summary, created_at")
          .eq("project_id", projectId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(10),
        admin
          .from("snapshots")
          .select("id, created_at")
          .eq("project_id", projectId)
          .eq("auto_generated", true)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    // One automatic snapshot per project per day.
    const last = recentAuto?.[0]?.created_at as string | undefined;
    if (last && new Date(last) >= since) {
      results.push({ project: projectId, created: false, reason: "already_today" });
      continue;
    }

    const visible = (milestones ?? []).filter(
      (m) => (m as MilestoneRow).client_visible,
    ) as MilestoneRow[];
    const activityLines = (activity ?? []).map((row) => String(row.summary));
    const changelog = buildChangelog(visible, activityLines, since);

    if (!changelog) {
      results.push({ project: projectId, created: false, reason: "no_movement" });
      continue;
    }

    const now = new Date();
    const title = `Daily progress · ${now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })}`;

    const { data: snapshot } = await admin
      .from("snapshots")
      .insert({
        project_id: projectId,
        title,
        changelog,
        status: "published",
        auto_generated: true,
        published_at: now.toISOString(),
        period_start: since.toISOString(),
        period_end: now.toISOString(),
      })
      .select("id")
      .single();

    if (notify && project.organization_id) {
      const { data: members } = await admin
        .from("organization_members")
        .select("profiles(email)")
        .eq("organization_id", project.organization_id);
      const recipients = (members ?? [])
        .map((m) => (m.profiles as { email?: string } | null)?.email)
        .filter((value): value is string => Boolean(value));

      if (recipients.length) {
        await sendSnapshotEmail({
          to: recipients,
          projectName: String(project.name),
          projectId,
          title,
          changelog,
          organizationId: project.organization_id as string,
        });
      }
    }

    results.push({ project: projectId, created: Boolean(snapshot?.id) });
  }

  return NextResponse.json({
    ok: true,
    scanned: projects?.length ?? 0,
    created: results.filter((r) => r.created).length,
    results,
  });
}
