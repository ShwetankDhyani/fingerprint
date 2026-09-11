import { createQuoteAction } from "@/app/actions/portal";
import { BoardRow } from "@/components/portal/board-row";
import { FilterBar } from "@/components/portal/filter-bar";
import {
  GlanceTile,
  Meter,
  StageStrip,
  VisualEmpty,
} from "@/components/portal/glance";
import { PortalSelect } from "@/components/portal/select-field";
import {
  ActionLane,
  LaneList,
  SettledLane,
} from "@/components/portal/work-lanes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchOrganizations, fetchQuotes } from "@/lib/portal/data";
import { QUOTE_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import { quoteIsSettled, quoteNeedsAction } from "@/lib/portal/money";
import { formatDate, formatInr } from "@/lib/portal/utils";

export const metadata = { title: "Quotes" };

const STATUS_COLOR: Record<string, string> = {
  draft: "#5f6f68",
  sent: "#d4b45a",
  opened: "#c4a06a",
  accepted: "#5ecf9a",
  converted: "#6eb4c8",
  declined: "#c07060",
  expired: "#c07060",
};

type QuoteRow = {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_minor: number;
  advance_minor?: number | null;
  paid_advance_minor?: number | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  valid_until?: string | null;
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

function QuoteRowView({ q }: { q: QuoteRow }) {
  const org = q.organizations ?? null;
  const project = q.projects ?? null;
  const advance = Number(q.advance_minor ?? 0) || Number(q.total_minor) || 0;
  const paid = Number(q.paid_advance_minor ?? 0);
  return (
    <BoardRow
      href={`/admin/quotes/${q.id}`}
      title={project?.name || q.title}
      subtitle={[q.quote_number, org?.name, q.recipient_email]
        .filter(Boolean)
        .join(" \u00b7 ")}
      meta={
        q.valid_until
          ? `Valid until ${formatDate(q.valid_until)}`
          : "No expiry set"
      }
      statusLabel={labelOf(QUOTE_STATUS_LABEL, String(q.status))}
      statusColor={STATUS_COLOR[String(q.status)] ?? "#9aaba2"}
      money={{
        headline: Number(q.total_minor),
        paid,
        pending: Math.max(0, advance - paid),
        settledLabel: "Advance settled",
      }}
      at={q.created_at ?? null}
      atLabel="created"
    />
  );
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [quotes, orgs] = await Promise.all([
    fetchQuotes(undefined, {
      q: sp.q,
      status: sp.status,
      from: sp.from,
      to: sp.to,
    }) as Promise<QuoteRow[]>,
    fetchOrganizations(),
  ]);

  const action = quotes.filter((q) => quoteNeedsAction(String(q.status)));
  const settled = quotes.filter((q) => quoteIsSettled(String(q.status)));
  const drafts = quotes.filter((q) => String(q.status) === "draft");
  const pipeline = action.reduce((sum, q) => sum + Number(q.total_minor), 0);
  const won = quotes
    .filter((q) => ["accepted", "converted"].includes(String(q.status)))
    .reduce((sum, q) => sum + Number(q.total_minor), 0);
  const paidAdvanceQuotes = quotes.filter(
    (q) => Number(q.paid_advance_minor ?? 0) > 0,
  );
  const paidAdvanceSum = paidAdvanceQuotes.reduce(
    (sum, q) => sum + Number(q.paid_advance_minor ?? 0),
    0,
  );
  const byStatus = (status: string) =>
    quotes.filter((q) => String(q.status) === status).length;

  const stageHref = (status?: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (status) params.set("status", status);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    const qs = params.toString();
    return qs ? `/admin/quotes?${qs}` : "/admin/quotes";
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            Pipeline
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl">
            Quotes
          </h2>
          <p className="mt-1 text-sm text-[#9aaba2]">
            Scan the board — waiting money, drafts, won work.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <GlanceTile
            href={stageHref("sent")}
            eyebrow="Waiting"
            value={formatInr(pipeline)}
            hint={`${action.length} quote${action.length === 1 ? "" : "s"} with clients`}
            accent="#d4b45a"
            glow="#d4b45a55"
            meter={
              <Meter
                segments={[
                  {
                    pct: byStatus("sent"),
                    color: "#d4b45a",
                    label: `Sent ${byStatus("sent")}`,
                  },
                  {
                    pct: byStatus("opened"),
                    color: "#c4a06a",
                    label: `Opened ${byStatus("opened")}`,
                  },
                ]}
              />
            }
          />
          <GlanceTile
            href={stageHref("draft")}
            eyebrow="Drafts"
            value={String(drafts.length)}
            unit="ready"
            hint="Not sent yet — finish and fire"
            accent="#7eb8a8"
            glow="#7eb8a855"
          />
          <GlanceTile
            href={stageHref("converted")}
            eyebrow="Won"
            value={formatInr(won)}
            hint={`${paidAdvanceQuotes.length} advances · ${formatInr(paidAdvanceSum)} in`}
            accent="#5ecf9a"
            glow="#5ecf9a55"
          />
        </div>

        <StageStrip
          stages={[
            {
              key: "all",
              label: "All",
              count: quotes.length,
              href: stageHref(),
              color: "#9aaba2",
              active: !sp.status,
            },
            {
              key: "draft",
              label: "Draft",
              count: byStatus("draft"),
              href: stageHref("draft"),
              color: "#5f6f68",
              active: sp.status === "draft",
            },
            {
              key: "sent",
              label: "Sent",
              count: byStatus("sent"),
              href: stageHref("sent"),
              color: "#d4b45a",
              active: sp.status === "sent",
            },
            {
              key: "opened",
              label: "Opened",
              count: byStatus("opened"),
              href: stageHref("opened"),
              color: "#c4a06a",
              active: sp.status === "opened",
            },
            {
              key: "accepted",
              label: "Accepted",
              count: byStatus("accepted"),
              href: stageHref("accepted"),
              color: "#5ecf9a",
              active: sp.status === "accepted",
            },
            {
              key: "converted",
              label: "Live",
              count: byStatus("converted"),
              href: stageHref("converted"),
              color: "#6eb4c8",
              active: sp.status === "converted",
            },
          ]}
        />

        <FilterBar
          basePath="/admin/quotes"
          placeholder="Search number, title, client, email or phone…"
          resultCount={quotes.length}
          showDateRange
          selects={[
            {
              name: "status",
              label: "Status",
              emptyLabel: "All statuses",
              options: [
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "opened", label: "Opened" },
                { value: "accepted", label: "Accepted" },
                { value: "converted", label: "Converted" },
                { value: "declined", label: "Declined" },
                { value: "expired", label: "Expired" },
              ],
            },
          ]}
        />

        {quotes.length === 0 ? (
          <VisualEmpty
            title="Pipeline is empty"
            body="Draft a quote on the right. Once accepted, convert it into an advance invoice."
            steps={[
              {
                label: "Draft",
                detail: "Price the work and name the recipient.",
                color: "#5f6f68",
              },
              {
                label: "Send",
                detail: "Share link + email — track opens here.",
                color: "#d4b45a",
              },
              {
                label: "Convert",
                detail: "Accepted quotes mint the advance invoice.",
                color: "#5ecf9a",
              },
            ]}
          />
        ) : (
          <div className="space-y-6">
            <ActionLane
              title="Needs a decision"
              hint="Waiting on a client response"
              count={action.length}
            >
              {action.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#24302b] px-4 py-6 text-center text-sm text-[#5f6f68]">
                  Nothing waiting — queue is clear.
                </p>
              ) : (
                <LaneList>
                  {action.map((q) => (
                    <QuoteRowView key={q.id} q={q} />
                  ))}
                </LaneList>
              )}
            </ActionLane>

            <SettledLane title="Decided" count={settled.length} defaultOpen={paidAdvanceQuotes.length > 0}>
              {settled.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#5f6f68]">
                  No settled quotes in this view.
                </p>
              ) : (
                <LaneList>
                  {settled.map((q) => (
                    <QuoteRowView key={q.id} q={q} />
                  ))}
                </LaneList>
              )}
            </SettledLane>
          </div>
        )}
      </section>

      <form
        action={createQuoteAction}
        className="h-fit space-y-3 rounded-2xl border border-[#24302b] bg-[#121a17] p-4"
      >
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          New quote
        </h3>
        <div className="space-y-1">
          <Label htmlFor="organizationId">Client</Label>
          <PortalSelect
            id="organizationId"
            name="organizationId"
            label="Client"
            includeEmptyLabel="Prospect / lead (until advance paid)"
            options={orgs.map((o: { id: string; name: string }) => ({
              value: o.id,
              label: o.name,
            }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipientName">Recipient name</Label>
          <Input id="recipientName" name="recipientName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipientEmail">Recipient email</Label>
          <Input id="recipientEmail" name="recipientEmail" type="email" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipientPhone">Recipient mobile</Label>
          <Input id="recipientPhone" name="recipientPhone" type="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lineLabel">Line item</Label>
          <Input id="lineLabel" name="lineLabel" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lineDescription">Description</Label>
          <Textarea id="lineDescription" name="lineDescription" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="lineAmountInr">Amount (INR)</Label>
            <Input
              id="lineAmountInr"
              name="lineAmountInr"
              type="number"
              min={1}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="advanceInr">Advance (INR)</Label>
            <Input id="advanceInr" name="advanceInr" type="number" min={0} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="taxInr">Tax (INR)</Label>
            <Input id="taxInr" name="taxInr" type="number" min={0} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="validDays">Valid days</Label>
            <Input
              id="validDays"
              name="validDays"
              type="number"
              defaultValue={14}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="sendNow" defaultChecked />
          Send now — emails the quote and activates the share link
        </label>
        <Button type="submit" className="w-full">
          Create quote
        </Button>
      </form>
    </div>
  );
}
