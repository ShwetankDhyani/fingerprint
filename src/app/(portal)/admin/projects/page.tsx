import { ProjectCard } from "@/components/portal/project-card";
import { FilterBar } from "@/components/portal/filter-bar";
import { EmptyState } from "@/components/portal/shell";
import {
  ActionLane,
  SettledLane,
} from "@/components/portal/work-lanes";
import { fetchProjects } from "@/lib/portal/data";
import { PROJECT_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import { projectIsLive } from "@/lib/portal/money";
import { formatInr, relativeTime } from "@/lib/portal/utils";

export const metadata = { title: "Projects" };

type ProjectRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  summary?: string | null;
  meta?: unknown;
  updated_at: string;
  organizations?: { name?: string | null } | null;
  invoices?: Array<{
    total_minor?: number | null;
    amount_paid_minor?: number | null;
    status?: string | null;
  }> | null;
};

function moneyBits(p: ProjectRow) {
  const invoices = p.invoices ?? [];
  const total = invoices.reduce((s, i) => s + Number(i.total_minor ?? 0), 0);
  const paid = invoices.reduce(
    (s, i) => s + Number(i.amount_paid_minor ?? 0),
    0,
  );
  return { total, paid, due: Math.max(0, total - paid) };
}

function ProjectTile({ p }: { p: ProjectRow }) {
  const org = p.organizations ?? null;
  const { paid, due } = moneyBits(p);

  return (
    <ProjectCard
      href={`/admin/projects/${p.id}`}
      project={{
        id: p.id,
        name: p.name,
        code: p.code,
        summary: p.summary,
        meta: p.meta,
      }}
      statusLabel={labelOf(PROJECT_STATUS_LABEL, p.status)}
      orgName={org?.name}
      trailing={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
          <span className="text-emerald-400">
            {paid > 0 ? `${formatInr(paid)} paid` : "₹0 paid"}
          </span>
          <span className={due > 0 ? "text-[#e6c35c]" : "text-[#5f6f68]"}>
            {due > 0
              ? `${formatInr(due)} pending`
              : paid > 0
                ? "settled"
                : "no invoices"}
          </span>
          <span className="text-[#5f6f68]">{relativeTime(p.updated_at)}</span>
        </div>
      }
    />
  );
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const projects = (await fetchProjects(undefined, {
    q: sp.q,
    status: sp.status,
  })) as ProjectRow[];

  const live = projects.filter((p) => projectIsLive(String(p.status)));
  const delivered = projects.filter((p) => String(p.status) === "completed");
  const quiet = projects.filter(
    (p) => !projectIsLive(String(p.status)) && String(p.status) !== "completed",
  );

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight text-[#f2f6f3]">
          Projects
        </h2>
</header>

      <FilterBar
        basePath="/admin/projects"
        placeholder="Search project, code, client…"
        resultCount={projects.length}
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All statuses",
            options: [
              { value: "intake", label: "Intake" },
              { value: "active", label: "Active" },
              { value: "review", label: "In review" },
              { value: "launched", label: "Launched" },
              { value: "maintenance", label: "Maintenance" },
              { value: "completed", label: "Delivered" },
              { value: "paused", label: "Paused" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects match"
          body="Clear the filters, or create a project from a client record."
        />
      ) : (
        <div className="space-y-8">
          <ActionLane
            title="Active"
            count={live.length}
          >
            {live.length === 0 ? (
              <EmptyState
                title="No active projects"
                body="Nothing currently in delivery for this filter."
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {live.map((p) => (
                  <ProjectTile key={p.id} p={p} />
                ))}
              </ul>
            )}
          </ActionLane>

          {delivered.length > 0 ? (
            <SettledLane title="Delivered" count={delivered.length}>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {delivered.map((p) => (
                  <ProjectTile key={p.id} p={p} />
                ))}
              </ul>
            </SettledLane>
          ) : null}

          <SettledLane
            title="Paused & closed"
            count={quiet.length}
          >
            {quiet.length === 0 ? (
              <p className="px-1 py-3 text-sm text-[#5f6f68]">
                No paused or closed projects here.
              </p>
            ) : (
              <ul className="grid gap-3 opacity-95 sm:grid-cols-2 xl:grid-cols-3">
                {quiet.map((p) => (
                  <ProjectTile key={p.id} p={p} />
                ))}
              </ul>
            )}
          </SettledLane>
        </div>
      )}
    </div>
  );
}
