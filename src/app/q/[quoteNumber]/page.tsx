import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { LynxLogo } from "@/components/brand/lynx-logo";
import { CashfreeReturnHandler } from "@/components/payments/cashfree-return-handler";
import { QuoteCheckout } from "@/components/payments/quote-checkout";
import { buttonVariants } from "@/components/ui/button";
import { getPortalProfile, isStaffRole } from "@/lib/auth/session";
import {
  formatDate,
  formatInr,
  hashToken,
  isPast,
  olderThan,
} from "@/lib/portal/utils";
import { fetchQuoteByNumber } from "@/lib/portal/data";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

export const metadata = { title: "Quotation" };

const STATUS_COPY: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting your review",
  opened: "Awaiting your review",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "In production",
};

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { quoteNumber } = await params;
  const { t } = await searchParams;
  const quote = await fetchQuoteByNumber(decodeURIComponent(quoteNumber));
  if (!quote) notFound();

  const settled = ["accepted", "converted"].includes(String(quote.status));
  const expectedHash = quote.share_token_hash as string | null;
  const tokenValid = Boolean(t && expectedHash && hashToken(t!) === expectedHash);

  // Anyone signed in who owns this quote can open it without carrying a token.
  const profile = tokenValid ? null : await getPortalProfile();
  const isInsider = Boolean(
    profile &&
      (isStaffRole(profile.role) ||
        (quote.organization_id &&
          profile.organization_ids.includes(String(quote.organization_id)))),
  );

  // Public access needs the share token; settled quotes stay readable without one.
  if (!tokenValid && !isInsider && !settled) notFound();

  const expired = isPast(quote.share_expires_at as string | null);

  if (tokenValid && expired && !settled) {
    return (
      <QuoteFrame>
      <Suspense fallback={null}>
        <CashfreeReturnHandler />
      </Suspense>
        <LynxLogo href="/" size="md" />
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl">
          This quotation link has expired
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          Quotation {String(quote.quote_number)} is no longer open for online
          acceptance. Reply to your last email or write to {siteConfig.email} and
          we&apos;ll send a fresh link right away.
        </p>
        <Link
          href="/contact"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Contact Lynx
        </Link>
      </QuoteFrame>
    );
  }

  const admin = getSupabaseAdmin();
  if (admin && tokenValid) {
    const lastEvent = (quote.quote_events as Array<Record<string, unknown>>)
      ?.filter((event) => event.event_type === "opened")
      .map((event) => new Date(String(event.created_at)).getTime())
      .sort((a, b) => b - a)[0];

    // One timeline entry per visit session, so a refresh doesn't flood it.
    if (olderThan(lastEvent, 30 * 60 * 1000)) {
      const hdrs = await headers();
      await admin.from("quote_events").insert({
        quote_id: quote.id,
        event_type: "opened",
        summary: "Quote opened via share link",
        meta: { ua: hdrs.get("user-agent"), ip: hdrs.get("x-forwarded-for") },
      });
    }

    await admin
      .from("quotes")
      .update({
        status: quote.status === "sent" ? "opened" : quote.status,
        opened_at: quote.opened_at ?? new Date().toISOString(),
        open_count: Number(quote.open_count ?? 0) + 1,
      })
      .eq("id", quote.id);
  }

  const lines = (quote.quote_line_items as Array<Record<string, unknown>>) ?? [];
  const org = quote.organizations as { name?: string } | null;
  const advanceMinor =
    Number(quote.advance_minor) || Number(quote.total_minor) || 0;
  const paidMinor = Number(quote.paid_advance_minor ?? 0);
  const dueMinor = Math.max(0, advanceMinor - paidMinor);
  const canPay = dueMinor > 0 && !["declined", "expired"].includes(String(quote.status));

  return (
    <QuoteFrame>
      <header className="flex flex-col gap-6 border-b border-[#24302b] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <LynxLogo href="/" size="md" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#b08d1f]">
            Official quotation · {STATUS_COPY[String(quote.status)] ?? quote.status}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-syne)] text-3xl">
            {String(quote.title)}
          </h1>
          <p className="mt-1 font-mono text-xs text-[#9aaba2]">
            {String(quote.quote_number)}
            {org?.name ? ` · ${org.name}` : ""}
            {quote.recipient_name ? ` · Attn: ${String(quote.recipient_name)}` : ""}
          </p>
        </div>
        <div className="font-mono text-xs text-[#9aaba2] sm:text-right">
          <p className="text-[#e8eee9]">{siteConfig.name}</p>
          <p>{siteConfig.email}</p>
          <p>{siteConfig.phones[0]}</p>
          {quote.valid_until ? (
            <p className="mt-2 text-[#d4b45a]">
              Valid until {formatDate(String(quote.valid_until))}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aaba2]">
            <tr>
              <th className="py-2">Scope</th>
              <th className="py-2">Qty</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={String(line.id)} className="border-t border-[#24302b]">
                <td className="py-3 pr-3">
                  <p className="font-medium">{String(line.label)}</p>
                  {line.description ? (
                    <p className="text-xs text-[#9aaba2]">
                      {String(line.description)}
                    </p>
                  ) : null}
                </td>
                <td className="py-3 font-mono text-xs">{String(line.quantity)}</td>
                <td className="py-3 text-right font-mono text-xs">
                  {formatInr(Number(line.amount_minor))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 border-t border-[#24302b] pt-4 text-right font-mono text-xs">
        <p>Subtotal {formatInr(Number(quote.subtotal_minor))}</p>
        <p>Tax {formatInr(Number(quote.tax_minor))}</p>
        <p>Discount −{formatInr(Number(quote.discount_minor))}</p>
        <p className="text-base text-[#d4b45a]">
          Total {formatInr(Number(quote.total_minor))}
        </p>
        <p>Advance to start {formatInr(advanceMinor)}</p>
        <p className="text-[#7fe0b0]">Paid {formatInr(paidMinor)}</p>
        <p className={dueMinor > 0 ? "text-[#d4b45a]" : "text-[#7fe0b0]"}>
          Pending {dueMinor > 0 ? formatInr(dueMinor) : "Settled"}
        </p>
      </div>

      {quote.terms ? (
        <section className="mt-8 border-t border-[#24302b] pt-4 text-xs leading-relaxed text-[#9aaba2]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            Terms
          </p>
          <p className="mt-2 whitespace-pre-wrap">{String(quote.terms)}</p>
        </section>
      ) : null}

      <section className="mt-8 space-y-4 border-t border-[#24302b] pt-6">
        {canPay ? (
          <QuoteCheckout
            quoteNumber={String(quote.quote_number)}
            shareToken={
              t ?? (isInsider ? (quote.share_token as string | null) : null)
            }
            amountLabel={formatInr(dueMinor)}
            defaultName={(quote.recipient_name as string | null) ?? null}
            defaultEmail={(quote.recipient_email as string | null) ?? null}
            defaultPhone={(quote.recipient_phone as string | null) ?? null}
          />
        ) : (
          <div className="rounded-xl border border-[#2f7d5c] bg-[#10231b] p-5">
            <p className="font-medium text-[#7fe0b0]">
              Advance settled — thank you
            </p>
            <p className="mt-1 text-sm text-[#9aaba2]">
              We have everything needed to start. Track progress and invoices in
              your client portal.
            </p>
            <Link
              href="/client"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Open client portal
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/contact?quote=${encodeURIComponent(String(quote.quote_number))}&intent=revise`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Request a revision
          </Link>
          <a
            href={`mailto:${siteConfig.email}?subject=${encodeURIComponent(
              `Question about ${String(quote.quote_number)}`,
            )}`}
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Email us a question
          </a>
        </div>
      </section>
    </QuoteFrame>
  );
}

function QuoteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-[#0b1210] px-4 py-10 text-[#e8eee9]">
      <div className="mx-auto max-w-3xl rounded-xl border border-[#24302b] bg-[#121a17] p-6 shadow-[0_0_0_1px_rgba(176,141,31,0.08)] md:p-10">
        {children}
      </div>
    </div>
  );
}
