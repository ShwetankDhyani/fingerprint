import Link from "next/link";

import { BoardRow } from "@/components/portal/board-row";
import { FilterBar } from "@/components/portal/filter-bar";
import {
  GlanceTile,
  StageStrip,
  VisualEmpty,
} from "@/components/portal/glance";
import {
  ActionLane,
  LaneList,
  SettledLane,
} from "@/components/portal/work-lanes";
import { fetchLeads } from "@/lib/portal/data";
import { LEAD_STATUS_LABEL, labelOf } from "@/lib/portal/labels";

export const metadata = { title: "Leads" };

const STATUS_COLOR: Record<string, string> = {
  new: "#d4b45a",
  contacted: "#6eb4c8",
  converted: "#5ecf9a",
  archived: "#5f6f68",
};

type LeadRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  project_type: string;
  budget: string;
  timeline: string;
  selected_plan?: string | null;
  scope: string;
  status: string;
  source: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function LeadRowView({ lead }: { lead: LeadRow }) {
  return (
    <BoardRow
      href={`/admin/leads/${lead.id}`}
      title={lead.name}
      subtitle={[lead.company || null, lead.email || null]
        .filter(Boolean)
        .join(" · ")}
      meta={[lead.project_type, lead.budget, lead.selected_plan]
        .filter(Boolean)
        .join(" · ")}
      statusLabel={labelOf(LEAD_STATUS_LABEL, lead.status)}
      statusColor={STATUS_COLOR[String(lead.status)] ?? "#9aaba2"}
      at={lead.updated_at ?? lead.created_at ?? null}
      atLabel={lead.updated_at ? "last touch" : "received"}
    />
  );
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const leads = (await fetchLeads({
    q: sp.q,
    status: sp.status,
    from: sp.from,
    to: sp.to,
  })) as LeadRow[];

  const open = leads.filter((l) =>
    ["new", "contacted"].includes(String(l.status)),
  );
  const converted = leads.filter((l) => String(l.status) === "converted");
  const archived = leads.filter((l) => String(l.status) === "archived");
  const byStatus = (status: string) =>
    leads.filter((l) => String(l.status) === status).length;

  const stageHref = (status?: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (status) params.set("status", status);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    const qs = params.toString();
    return qs ? `/admin/leads?${qs}` : "/admin/leads";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          Pipeline
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
          Leads
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[#9aaba2]">
          Enquiries land here. Quote them while they stay leads — they become
          Clients only after the advance is paid.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <GlanceTile
          href={stageHref("new")}
          eyebrow="New"
          value={String(byStatus("new"))}
          unit="enquiries"
          hint="Fresh from the contact form"
          accent="#d4b45a"
          glow="#d4b45a55"
        />
        <GlanceTile
          href={stageHref("contacted")}
          eyebrow="In conversation"
          value={String(byStatus("contacted"))}
          unit="active"
          hint="Quoted or being followed up"
          accent="#6eb4c8"
          glow="#6eb4c855"
        />
        <GlanceTile
          href={stageHref("converted")}
          eyebrow="Converted"
          value={String(byStatus("converted"))}
          unit="clients"
          hint="Advance paid — now on Clients"
          accent="#5ecf9a"
          glow="#5ecf9a55"
        />
      </div>

      <StageStrip
        stages={[
          {
            key: "all",
            label: "All",
            count: leads.length,
            href: stageHref(),
            color: "#9aaba2",
            active: !sp.status,
          },
          {
            key: "new",
            label: "New",
            count: byStatus("new"),
            href: stageHref("new"),
            color: "#d4b45a",
            active: sp.status === "new",
          },
          {
            key: "contacted",
            label: "Talking",
            count: byStatus("contacted"),
            href: stageHref("contacted"),
            color: "#6eb4c8",
            active: sp.status === "contacted",
          },
          {
            key: "converted",
            label: "Converted",
            count: byStatus("converted"),
            href: stageHref("converted"),
            color: "#5ecf9a",
            active: sp.status === "converted",
          },
          {
            key: "archived",
            label: "Archived",
            count: byStatus("archived"),
            href: stageHref("archived"),
            color: "#5f6f68",
            active: sp.status === "archived",
          },
        ]}
      />

      <FilterBar
        basePath="/admin/leads"
        placeholder="Search name, email, company or project…"
        resultCount={leads.length}
        showDateRange
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All statuses",
            options: [
              { value: "new", label: "New enquiry" },
              { value: "contacted", label: "In conversation" },
              { value: "converted", label: "Became a client" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />

      {leads.length === 0 ? (
        <VisualEmpty
          title="No leads yet"
          body="Contact-form enquiries appear here automatically. Quote them without creating a client until they pay the advance."
          steps={[
            {
              label: "Enquiry",
              detail: "Someone submits the project intake form.",
              color: "#d4b45a",
            },
            {
              label: "Quote",
              detail: "Open the lead and create a quotation.",
              color: "#6eb4c8",
            },
            {
              label: "Client",
              detail: "Advance payment converts them to Clients.",
              color: "#5ecf9a",
            },
          ]}
        />
      ) : (
        <div className="space-y-6">
          <ActionLane
            title="Needs attention"
            hint="New and in-conversation leads"
            count={open.length}
          >
            {open.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#5f6f68]">
                No open leads in this view.
              </p>
            ) : (
              <LaneList>
                {open.map((lead) => (
                  <LeadRowView key={lead.id} lead={lead} />
                ))}
              </LaneList>
            )}
          </ActionLane>

          <SettledLane
            title="Converted & archived"
            count={converted.length + archived.length}
            defaultOpen={converted.length > 0}
          >
            {converted.length + archived.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#5f6f68]">
                No converted or archived leads here.
              </p>
            ) : (
              <LaneList>
                {[...converted, ...archived].map((lead) => (
                  <LeadRowView key={lead.id} lead={lead} />
                ))}
              </LaneList>
            )}
          </SettledLane>
        </div>
      )}

      <p className="text-center text-xs text-[#5f6f68]">
        Prefer starting from Quotes? Use{" "}
        <Link href="/admin/quotes" className="text-[#d4b45a] hover:underline">
          Prospect / lead (until advance paid)
        </Link>{" "}
        — it still creates a lead, not a client.
      </p>
    </div>
  );
}
