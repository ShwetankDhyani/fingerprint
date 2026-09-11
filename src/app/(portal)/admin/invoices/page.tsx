import Link from "next/link";

import { BoardRow } from "@/components/portal/board-row";
import { FilterBar } from "@/components/portal/filter-bar";
import {
  GlanceTile,
  Meter,
  StageStrip,
  VisualEmpty,
} from "@/components/portal/glance";
import {
  ActionLane,
  LaneList,
  SettledLane,
} from "@/components/portal/work-lanes";
import { fetchInvoices } from "@/lib/portal/data";
import { INVOICE_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import {
  invoiceBalance,
  invoiceIsSettled,
  invoiceNeedsAction,
} from "@/lib/portal/money";
import { formatDate, formatInr } from "@/lib/portal/utils";

export const metadata = { title: "Invoices" };

const STATUS_COLOR: Record<string, string> = {
  draft: "#5f6f68",
  sent: "#d4b45a",
  partial: "#c4a06a",
  paid: "#5ecf9a",
  overdue: "#c07060",
  void: "#5f6f68",
  refunded: "#5f6f68",
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_minor: number;
  amount_paid_minor: number;
  due_at: string | null;
  created_at?: string | null;
  organizations?: {
    name?: string | null;
    billing_email?: string | null;
  } | null;
  projects?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;
};

function InvoiceRowView({ inv }: { inv: InvoiceRow }) {
  const due = invoiceBalance(inv.total_minor, inv.amount_paid_minor);
  const org = inv.organizations ?? null;
  const project = inv.projects ?? null;
  return (
    <BoardRow
      href={`/admin/invoices/${inv.id}`}
      title={project?.name || inv.invoice_number}
      subtitle={[inv.invoice_number, org?.name].filter(Boolean).join(" · ")}
      meta={inv.due_at ? `Due ${formatDate(inv.due_at)}` : "No due date set"}
      statusLabel={labelOf(INVOICE_STATUS_LABEL, String(inv.status))}
      statusColor={STATUS_COLOR[String(inv.status)] ?? "#9aaba2"}
      money={{
        headline: Number(inv.total_minor),
        paid: Number(inv.amount_paid_minor),
        pending: due,
      }}
      at={inv.created_at ?? null}
      atLabel="raised"
    />
  );
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const invoices = (await fetchInvoices(undefined, {
    q: sp.q,
    status: sp.status,
    from: sp.from,
    to: sp.to,
    org: sp.org,
  })) as InvoiceRow[];

  const action = invoices.filter((inv) =>
    invoiceNeedsAction(
      String(inv.status),
      invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    ),
  );
  const settled = invoices.filter((inv) =>
    invoiceIsSettled(
      String(inv.status),
      invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    ),
  );
  const outstanding = action.reduce(
    (sum, inv) =>
      sum + invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    0,
  );
  const collected = invoices.reduce(
    (sum, inv) => sum + Number(inv.amount_paid_minor),
    0,
  );
  const overdue = invoices.filter((inv) => String(inv.status) === "overdue");
  const overdueTotal = overdue.reduce(
    (sum, inv) =>
      sum + invoiceBalance(inv.total_minor, inv.amount_paid_minor),
    0,
  );
  const byStatus = (status: string) =>
    invoices.filter((inv) => String(inv.status) === status).length;

  const stageHref = (status?: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (status) params.set("status", status);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.org) params.set("org", sp.org);
    const qs = params.toString();
    return qs ? `/admin/invoices?${qs}` : "/admin/invoices";
  };

  const scopedClient = sp.org
    ? invoices.find((inv) => inv.organizations?.name)?.organizations?.name ??
      "this client"
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          Collections
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">
          Invoices
        </h2>
        <p className="mt-1 text-sm text-[#9aaba2]">
          Money owed vs money in — chase the gold, celebrate the green.
        </p>
        {scopedClient ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#24302b] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#9aaba2]">
            Filtered to {scopedClient}
            <Link href="/admin/invoices" className="text-[#d4b45a] hover:underline">
              clear
            </Link>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <GlanceTile
          href={stageHref("sent")}
          eyebrow="To collect"
          value={formatInr(outstanding)}
          hint={`${action.length} open invoice${action.length === 1 ? "" : "s"}`}
          accent="#d4b45a"
          glow="#d4b45a55"
          meter={
            <Meter
              segments={[
                {
                  pct: outstanding,
                  color: "#d4b45a",
                  label: `Due ${formatInr(outstanding)}`,
                },
                {
                  pct: collected,
                  color: "#5ecf9a",
                  label: `In ${formatInr(collected)}`,
                },
              ]}
            />
          }
        />
        <GlanceTile
          href={stageHref("paid")}
          eyebrow="Received"
          value={formatInr(collected)}
          hint={`${byStatus("paid")} settled in this view`}
          accent="#5ecf9a"
          glow="#5ecf9a55"
        />
        <GlanceTile
          href={stageHref("overdue")}
          eyebrow="Overdue"
          value={formatInr(overdueTotal)}
          hint={
            overdue.length === 0
              ? "Nothing past due"
              : `${overdue.length} need a nudge`
          }
          accent="#c07060"
          glow="#c0706055"
        />
      </div>

      <StageStrip
        stages={[
          {
            key: "all",
            label: "All",
            count: invoices.length,
            href: stageHref(),
            color: "#9aaba2",
            active: !sp.status,
          },
          {
            key: "sent",
            label: "Unpaid",
            count: byStatus("sent"),
            href: stageHref("sent"),
            color: "#d4b45a",
            active: sp.status === "sent",
          },
          {
            key: "partial",
            label: "Partial",
            count: byStatus("partial"),
            href: stageHref("partial"),
            color: "#c4a06a",
            active: sp.status === "partial",
          },
          {
            key: "overdue",
            label: "Overdue",
            count: byStatus("overdue"),
            href: stageHref("overdue"),
            color: "#c07060",
            active: sp.status === "overdue",
          },
          {
            key: "paid",
            label: "Paid",
            count: byStatus("paid"),
            href: stageHref("paid"),
            color: "#5ecf9a",
            active: sp.status === "paid",
          },
        ]}
      />

      <FilterBar
        basePath="/admin/invoices"
        placeholder="Search number, client, email or phone…"
        resultCount={invoices.length}
        showDateRange
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All statuses",
            options: [
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Unpaid" },
              { value: "partial", label: "Partially paid" },
              { value: "paid", label: "Paid" },
              { value: "overdue", label: "Overdue" },
              { value: "void", label: "Void" },
              { value: "refunded", label: "Refunded" },
            ],
          },
        ]}
      />

      {invoices.length === 0 ? (
        <VisualEmpty
          title="No invoices yet"
          body="Invoices are raised from accepted quotes — open a quote and create the advance invoice."
          steps={[
            {
              label: "Quote",
              detail: "Client accepts the priced scope.",
              color: "#d4b45a",
            },
            {
              label: "Invoice",
              detail: "Advance invoice lands in Collect.",
              color: "#c4a06a",
            },
            {
              label: "Paid",
              detail: "Cashfree settles — row turns green.",
              color: "#5ecf9a",
            },
          ]}
        />
      ) : (
        <div className="space-y-6">
          <ActionLane
            title="Collect"
            hint="Outstanding balances"
            count={action.length}
          >
            {action.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#5f6f68]">
                Nothing to collect — all matching invoices are settled.
              </p>
            ) : (
              <LaneList>
                {action.map((inv) => (
                  <InvoiceRowView key={inv.id} inv={inv} />
                ))}
              </LaneList>
            )}
          </ActionLane>

          <SettledLane title="Paid & closed" count={settled.length} defaultOpen={settled.length > 0}>
            {settled.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#5f6f68]">
                No settled invoices in this view.
              </p>
            ) : (
              <LaneList>
                {settled.map((inv) => (
                  <InvoiceRowView key={inv.id} inv={inv} />
                ))}
              </LaneList>
            )}
          </SettledLane>
        </div>
      )}
    </div>
  );
}
