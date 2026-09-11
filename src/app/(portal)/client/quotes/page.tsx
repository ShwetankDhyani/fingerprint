import Link from "next/link";

import { PeekRow } from "@/components/portal/entity-peek";
import { FilterBar } from "@/components/portal/filter-bar";
import { EmptyState } from "@/components/portal/shell";
import {
  ActionLane,
  LaneList,
  SettledLane,
} from "@/components/portal/work-lanes";
import { buttonVariants } from "@/components/ui/button";
import { requireClient } from "@/lib/auth/session";
import { fetchQuotes } from "@/lib/portal/data";
import { QUOTE_STATUS_LABEL, labelOf } from "@/lib/portal/labels";
import {
  quoteIsSettled,
  quoteNeedsAction,
  quotePeek,
} from "@/lib/portal/money";
import { formatDate, formatInr } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Quotes" };

const STATUS_TONE: Record<string, string> = {
  sent: "text-[#d4b45a]",
  opened: "text-[#d4b45a]",
  accepted: "text-emerald-400",
  converted: "text-emerald-400",
  declined: "text-red-400",
  expired: "text-red-400",
};

type QuoteRow = {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_minor: number;
  advance_minor: number | null;
  paid_advance_minor: number | null;
  share_token: string | null;
  valid_until: string | null;
  organizations?: { name?: string | null } | null;
  projects?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;
};

function quoteHref(q: QuoteRow) {
  // Signed-in clients use org membership — never put share tokens in portal URLs.
  return `/q/${encodeURIComponent(String(q.quote_number))}`;
}

function QuoteRowView({ q }: { q: QuoteRow }) {
  const advance = Number(q.advance_minor) || Number(q.total_minor) || 0;
  const paid = Number(q.paid_advance_minor ?? 0);
  const project = q.projects;
  return (
    <li className="relative z-0 overflow-visible hover:z-20">
      <PeekRow href={quoteHref(q)} peek={quotePeek(q)}>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">
            {project?.name || q.title}
          </p>
          <p className="truncate font-mono text-xs text-[#9aaba2]">
            {q.quote_number}
            {` · ${formatInr(paid)} paid · ${formatInr(Math.max(0, advance - paid))} pending`}
            {q.valid_until ? ` · until ${formatDate(q.valid_until)}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right font-mono text-xs">
          <p className="text-[#d4b45a]">{formatInr(Number(q.total_minor))}</p>
          <p className={STATUS_TONE[String(q.status)] ?? "text-[#9aaba2]"}>
            {labelOf(QUOTE_STATUS_LABEL, String(q.status))}
          </p>
        </div>
      </PeekRow>
    </li>
  );
}

export default async function ClientQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await requireClient();
  const quotes = (await fetchQuotes(profile.organization_ids, {
    q: sp.q,
    status: sp.status,
    clientEmail: profile.email,
  })) as QuoteRow[];

  const needsYou = quotes.filter((q) => quoteNeedsAction(String(q.status)));
  const decided = quotes.filter((q) => quoteIsSettled(String(q.status)));

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          Quotes
        </p>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">
          Quotes for you
        </h2>
        </div>

      <FilterBar
        basePath="/client/quotes"
        placeholder="Search by number or title…"
        resultCount={quotes.length}
        selects={[
          {
            name: "status",
            label: "Status",
            emptyLabel: "All quotes",
            options: [
              { value: "sent", label: "Waiting for you" },
              { value: "opened", label: "Opened" },
              { value: "accepted", label: "Accepted" },
              { value: "converted", label: "In production" },
              { value: "expired", label: "Expired" },
            ],
          },
        ]}
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          body="When Lynx sends a quotation, it appears here. You can open it, read it, then accept or decline."
        />
      ) : (
        <div className="space-y-6">
          <ActionLane
            title="Needs your answer"
            count={needsYou.length}
          >
            {needsYou.length === 0 ? (
              <EmptyState
                title="Nothing waiting"
                body="No quotes need a reply right now."
              />
            ) : (
              <LaneList>
                {needsYou.map((q) => (
                  <QuoteRowView key={q.id} q={q} />
                ))}
              </LaneList>
            )}
          </ActionLane>

          <SettledLane
            title="Already decided"
            count={decided.length}
          >
            {decided.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#5f6f68]">
                No decided quotes yet.
              </p>
            ) : (
              <LaneList>
                {decided.map((q) => (
                  <QuoteRowView key={q.id} q={q} />
                ))}
              </LaneList>
            )}
          </SettledLane>
        </div>
      )}

      {needsYou[0] ? (
        <div className="rounded-lg border border-[#b08d1f]/35 bg-[#b08d1f]/10 px-5 py-5">
          <p className="font-[family-name:var(--font-syne)] text-xl">
            Start with {needsYou[0].title}
          </p>
          <p className="mt-2 text-base text-[#9aaba2]">
            Big button on purpose. Tap once to open the full quote.
          </p>
          <Link
            href={quoteHref(needsYou[0])}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-4 inline-flex min-h-12 px-6 text-base",
            )}
          >
            Open quote
          </Link>
        </div>
      ) : null}
    </div>
  );
}
