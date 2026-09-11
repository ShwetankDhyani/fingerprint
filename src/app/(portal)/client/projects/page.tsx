import { ProjectCard } from "@/components/portal/project-card";
import { EmptyState } from "@/components/portal/shell";
import { requireClient } from "@/lib/auth/session";
import { fetchProjects } from "@/lib/portal/data";
import { PROJECT_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import { formatDateTime, formatInr } from "@/lib/portal/utils";

export const metadata = { title: "My projects" };

type ProjectRow = {
  id: string;
  name: string;
  code?: string | null;
  summary?: string | null;
  meta?: unknown;
  status: string;
  completed_at?: string | null;
  invoices?: Array<{ total_minor?: number; amount_paid_minor?: number }>;
};

function ProjectGrid({ projects }: { projects: ProjectRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((row) => {
        const invoices = row.invoices ?? [];
        const total = invoices.reduce(
          (s, i) => s + Number(i.total_minor ?? 0),
          0,
        );
        const paid = invoices.reduce(
          (s, i) => s + Number(i.amount_paid_minor ?? 0),
          0,
        );
        const due = Math.max(0, total - paid);
        const delivered = row.status === "completed";

        return (
          <ProjectCard
            key={row.id}
            href={`/client/projects/${row.id}`}
            project={{
              id: row.id,
              name: row.name,
              code: row.code,
              summary: row.summary,
              meta: row.meta,
            }}
            statusLabel={labelOf(PROJECT_STATUS_LABEL, String(row.status))}
            trailing={
              <div className="font-mono text-[11px] text-[#9aaba2]">
                <p>
                  <span className="text-emerald-400">
                    {formatInr(paid)} paid
                  </span>
                  {" · "}
                  <span
                    className={due > 0 ? "text-[#e6c35c]" : "text-[#5f6f68]"}
                  >
                    {due > 0 ? `${formatInr(due)} pending` : "settled"}
                  </span>
                </p>
                {delivered && row.completed_at ? (
                  <p className="text-[10px] text-[#5f6f68]">
                    handed over {formatDateTime(row.completed_at)}
                  </p>
                ) : null}
              </div>
            }
          />
        );
      })}
    </ul>
  );
}

export default async function ClientProjectsPage() {
  const profile = await requireClient();
  const projects = (await fetchProjects(
    profile.organization_ids,
  )) as ProjectRow[];

  // Finished work stays visible, but it shouldn't compete for attention with
  // whatever is still in flight.
  const active = projects.filter((p) => p.status !== "completed");
  const delivered = projects
    .filter((p) => p.status === "completed")
    .sort((a, b) =>
      String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")),
    );

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight text-[#f2f6f3]">
          Projects
        </h2>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="When work starts, your projects show up here."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
              In progress
            </h3>
            {active.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#7a8a83]">
                Nothing in flight right now. Everything we&apos;ve built for you
                is below.
              </p>
            ) : (
              <ProjectGrid projects={active} />
            )}
          </section>

          {delivered.length > 0 ? (
            <section className="space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">
                Delivered
              </h3>
              <ProjectGrid projects={delivered} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
