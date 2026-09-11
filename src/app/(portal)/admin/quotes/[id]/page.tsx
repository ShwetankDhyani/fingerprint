import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createInvoiceFromQuoteAction,
  emailQuoteAction,
  regenerateQuoteShareAction,
  setQuoteStatusAction,
  deleteQuoteAction,
} from "@/app/actions/portal";
import { CopyField } from "@/components/portal/copy-field";
import { PortalSelect } from "@/components/portal/select-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteUrl } from "@/lib/env";
import { fetchQuote } from "@/lib/portal/data";
import { formatDate, formatInr, relativeTime } from "@/lib/portal/utils";
import { getPortalProfile, isSuperAdminRole } from "@/lib/auth/session";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";
import {
  PaymentSplit,
  moneySplit,
  quoteAdvanceSplit,
} from "@/components/portal/payment-split";
import { cn } from "@/lib/utils";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await fetchQuote(id);
  if (!quote) notFound();
  const actor = await getPortalProfile();
  const isSuperAdmin = actor ? isSuperAdminRole(actor.role) : false;

  const lines = (quote.quote_line_items as Array<Record<string, unknown>>) ?? [];
  const events =
    ((quote.quote_events as Array<Record<string, unknown>>) ?? []).slice().sort(
      (a, b) =>
        new Date(String(b.created_at)).getTime() -
        new Date(String(a.created_at)).getTime(),
    );
  const org = quote.organizations as { name?: string } | null;
  const shareToken = quote.share_token as string | null;
  const shareUrl = `${siteUrl()}/q/${encodeURIComponent(
    String(quote.quote_number),
  )}${shareToken ? `?t=${shareToken}` : ""}`;
  const advance = Number(quote.advance_minor) || Number(quote.total_minor);
  const paid = Number(quote.paid_advance_minor ?? 0);
  const advanceMoney = quoteAdvanceSplit({
    total_minor: Number(quote.total_minor),
    advance_minor: Number(quote.advance_minor),
    paid_advance_minor: paid,
  });
  const quoteMoney = moneySplit(Number(quote.total_minor), paid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {String(quote.quote_number)}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl">
            {String(quote.title)}
          </h2>
          <p className="text-sm text-[#9aaba2]">
            {org?.name ?? quote.recipient_name ?? "Prospect"} ·{" "}
            {String(quote.status)}
            {quote.valid_until
              ? ` · valid until ${formatDate(String(quote.valid_until))}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={shareUrl}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open as client
          </Link>
          <form action={createInvoiceFromQuoteAction}>
            <input type="hidden" name="quoteId" value={String(quote.id)} />
            <Button type="submit">Create advance invoice</Button>
          </form>
          {isSuperAdmin ? (
            <SuperAdminDeleteButton
              action={deleteQuoteAction}
              entityLabel="quote"
              consequence="Line items and events are removed. Linked invoices keep their rows but lose the quote link."
              hidden={{ quoteId: String(quote.id) }}
              buttonLabel="Delete quote"
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <PaymentSplit
          total={advanceMoney.total}
          paid={advanceMoney.paid}
          pending={advanceMoney.pending}
          totalLabel="Advance due"
          paidLabel="Advance paid"
          pendingLabel="Advance pending"
        />
        <PaymentSplit
          total={quoteMoney.total}
          paid={quoteMoney.paid}
          pending={quoteMoney.pending}
          totalLabel="Quote total"
          paidLabel="Collected"
          pendingLabel="Still open"
        />
      </div>

      <section className="space-y-4 rounded-lg border border-[#24302b] bg-[#121a17] p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          Share &amp; send
        </h3>
        <CopyField
          label="Client link"
          value={shareUrl}
          whatsappMessage={`Hi${
            quote.recipient_name ? ` ${String(quote.recipient_name).split(" ")[0]}` : ""
          }, here is your quotation ${String(quote.quote_number)} from Lynx Web Solutions — ${formatInr(
            Number(quote.total_minor),
          )}. You can review it and pay the advance here:`}
          hint={
            quote.share_expires_at
              ? `Link expires ${formatDate(String(quote.share_expires_at))}. Anyone with it can view and pay the advance.`
              : "Anyone with this link can view the quotation and pay the advance."
          }
        />

        <div className="grid gap-3 md:grid-cols-2">
          <form
            action={emailQuoteAction}
            className="space-y-2 rounded-lg border border-[#24302b] p-3"
          >
            <input type="hidden" name="quoteId" value={String(quote.id)} />
            <Label htmlFor="email">Email this quotation</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={
                (quote.recipient_email as string | null) ?? "client@company.com"
              }
              defaultValue={(quote.recipient_email as string | null) ?? ""}
            />
            <Button type="submit" size="sm" className="w-full">
              Send email
            </Button>
            <p className="font-mono text-[11px] text-[#9aaba2]">
              {quote.last_emailed_at
                ? `Last sent ${relativeTime(String(quote.last_emailed_at))}`
                : "Not emailed yet"}
            </p>
          </form>

          <form
            action={regenerateQuoteShareAction}
            className="space-y-2 rounded-lg border border-[#24302b] p-3"
          >
            <input type="hidden" name="quoteId" value={String(quote.id)} />
            <Label htmlFor="validDays">Regenerate link</Label>
            <Input
              id="validDays"
              name="validDays"
              type="number"
              min={1}
              max={180}
              defaultValue={14}
            />
            <Button type="submit" size="sm" variant="outline" className="w-full">
              New link + expiry
            </Button>
            <p className="font-mono text-[11px] text-[#9aaba2]">
              Invalidates the old link immediately.
            </p>
          </form>
        </div>

        <form
          action={setQuoteStatusAction}
          className="flex flex-wrap items-end gap-2 border-t border-[#24302b] pt-3"
        >
          <input type="hidden" name="quoteId" value={String(quote.id)} />
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <PortalSelect
              id="status"
              name="status"
              label="Status"
              defaultValue={String(quote.status)}
              options={[
                "draft",
                "sent",
                "opened",
                "accepted",
                "declined",
                "expired",
                "converted",
              ].map((value) => ({ value, label: value }))}
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Update status
          </Button>
          <p className="ml-auto font-mono text-[11px] text-[#9aaba2]">
            Opened {Number(quote.open_count ?? 0)}×
            {quote.opened_at ? ` · first ${relativeTime(String(quote.opened_at))}` : ""}
          </p>
        </form>
      </section>

      <div className="overflow-hidden rounded-lg border border-[#24302b]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#121a17] font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aaba2]">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={String(line.id)} className="border-t border-[#24302b]">
                <td className="px-3 py-2">
                  <p>{String(line.label)}</p>
                  {line.description ? (
                    <p className="text-xs text-[#9aaba2]">
                      {String(line.description)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {String(line.quantity)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {formatInr(Number(line.amount_minor))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t border-[#24302b] bg-[#121a17] px-3 py-3 text-right font-mono text-xs">
          <p>Subtotal {formatInr(Number(quote.subtotal_minor))}</p>
          <p>Tax {formatInr(Number(quote.tax_minor))}</p>
          <p>Discount −{formatInr(Number(quote.discount_minor))}</p>
          <p className="text-sm text-[#d4b45a]">
            Total {formatInr(Number(quote.total_minor))}
          </p>
          <p>Advance {formatInr(advance)}</p>
          <p className="text-emerald-400">Paid {formatInr(paid)}</p>
          <p className={advanceMoney.pending > 0 ? "text-[#d4b45a]" : "text-emerald-400"}>
            Pending{" "}
            {advanceMoney.pending > 0
              ? formatInr(advanceMoney.pending)
              : "Settled"}
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aaba2]">
          Timeline
        </h3>
        <ul className="space-y-1 rounded-lg border border-[#24302b] bg-[#0b1210] p-3 font-mono text-xs">
          {events.length === 0 ? (
            <li className="text-[#9aaba2]">No events yet.</li>
          ) : (
            events.map((event) => (
              <li key={String(event.id)}>
                <span className="text-[#b08d1f]">
                  [{relativeTime(String(event.created_at))}]
                </span>{" "}
                {String(event.summary)}
              </li>
            ))
          )}
        </ul>
      </section>

      {isSuperAdmin ? (
        <section className="space-y-3 rounded-xl border border-[#5a2020]/70 bg-[#1a0e0e]/50 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#d48080]">
            Super Admin · absolute control
          </p>
          <p className="text-sm text-[#9aaba2]">
            Permanently delete this quote and its line items.
          </p>
          <SuperAdminDeleteButton
            action={deleteQuoteAction}
            entityLabel="quote"
            consequence="This quote will be permanently removed."
            hidden={{ quoteId: String(quote.id) }}
            buttonLabel="Delete quote permanently"
          />
        </section>
      ) : null}
    </div>
  );
}
