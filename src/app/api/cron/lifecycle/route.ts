import { NextResponse } from "next/server";

import {
  sendInvoiceReminderEmail,
  sendQuoteFollowupEmail,
} from "@/lib/email/lifecycle";
import { formatInr } from "@/lib/portal/format";
import { notifyStaff } from "@/lib/portal/notify";
import { logActivity } from "@/lib/portal/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

/**
 * Leads that came in and were never picked up. Internal only — chasing a
 * prospect twice in 48 hours reads as desperate, but the team should know.
 */
async function nudgeStaleLeads(admin: Admin, now: Date) {
  const cutoff = new Date(now.getTime() - 2 * DAY).toISOString();

  const { data: leads } = await admin
    .from("leads")
    .select("id, name, company, email, created_at, status, last_contacted_at, nudged_at")
    .in("status", ["new"])
    .is("last_contacted_at", null)
    .is("nudged_at", null)
    .lte("created_at", cutoff)
    .limit(50);

  let nudged = 0;
  for (const lead of leads ?? []) {
    await notifyStaff({
      kind: "lead",
      title: `No reply yet — ${lead.name}`,
      body: `${lead.company || lead.email || "Enquiry"} has been waiting ${daysBetween(
        new Date(String(lead.created_at)),
        now,
      )} days for a first response.`,
      href: `/admin/leads/${lead.id}`,
      entityType: "lead",
      entityId: String(lead.id),
      dedupeKey: `lead-stale:${lead.id}`,
    });
    await admin
      .from("leads")
      .update({ nudged_at: now.toISOString() })
      .eq("id", lead.id);
    nudged += 1;
  }
  return nudged;
}

/** Quote sent, never opened, three days gone. One follow-up, then silence. */
async function followUpQuietQuotes(admin: Admin, now: Date) {
  const cutoff = new Date(now.getTime() - 3 * DAY).toISOString();

  const { data: quotes } = await admin
    .from("quotes")
    .select(
      "id, quote_number, title, status, total_minor, advance_minor, valid_until, share_token, recipient_email, recipient_name, organization_id, sent_at, opened_at, followup_sent_at",
    )
    .eq("status", "sent")
    .is("opened_at", null)
    .is("followup_sent_at", null)
    .not("recipient_email", "is", null)
    .lte("sent_at", cutoff)
    .limit(50);

  let sent = 0;
  for (const quote of quotes ?? []) {
    const result = await sendQuoteFollowupEmail({
      to: String(quote.recipient_email),
      recipientName: quote.recipient_name as string | null,
      quoteNumber: String(quote.quote_number),
      title: String(quote.title),
      totalMinor: Number(quote.total_minor ?? 0),
      advanceMinor: Number(quote.advance_minor ?? 0),
      validUntil: quote.valid_until as string | null,
      shareToken: quote.share_token as string | null,
      organizationId: quote.organization_id as string | null,
      quoteId: String(quote.id),
    });

    // Stamp either way — a provider outage must not queue up a second send.
    await admin
      .from("quotes")
      .update({ followup_sent_at: now.toISOString() })
      .eq("id", quote.id);

    await admin.from("quote_events").insert({
      quote_id: quote.id,
      event_type: result.sent ? "emailed" : "email_failed",
      summary: result.sent
        ? `Follow-up sent to ${quote.recipient_email}`
        : `Follow-up to ${quote.recipient_email} failed: ${result.error ?? "unknown error"}`,
    });

    if (result.sent) sent += 1;
  }
  return sent;
}

/**
 * Invoices due in three days, and invoices already past due. The client gets
 * one reminder per stage; the team gets a bell entry once it goes overdue.
 */
async function chaseInvoices(admin: Admin, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 3 * DAY).toISOString().slice(0, 10);

  const { data: invoices } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, total_minor, amount_paid_minor, due_at, organization_id, reminder_sent_at, overdue_notice_at, organizations(name, billing_email)",
    )
    .in("status", ["sent", "partial", "overdue"])
    .not("due_at", "is", null)
    .lte("due_at", soon)
    .limit(100);

  let reminded = 0;
  let chased = 0;

  for (const invoice of invoices ?? []) {
    const dueAt = String(invoice.due_at);
    const balance =
      Number(invoice.total_minor ?? 0) - Number(invoice.amount_paid_minor ?? 0);
    if (balance <= 0) continue;

    const org = invoice.organizations as {
      name?: string;
      billing_email?: string;
    } | null;
    const overdue = dueAt < today;

    if (overdue && !invoice.overdue_notice_at) {
      const daysOverdue = daysBetween(new Date(dueAt), now);
      if (org?.billing_email) {
        await sendInvoiceReminderEmail({
          to: org.billing_email,
          invoiceNumber: String(invoice.invoice_number),
          amountDueMinor: balance,
          dueAt,
          overdue: true,
          daysOverdue,
          organizationId: invoice.organization_id as string | null,
          invoiceId: String(invoice.id),
        });
      }

      await admin
        .from("invoices")
        .update({ status: "overdue", overdue_notice_at: now.toISOString() })
        .eq("id", invoice.id);

      await logActivity(admin, {
        organizationId: invoice.organization_id as string | null,
        action: "overdue",
        entityType: "invoice",
        entityId: String(invoice.id),
        summary: `${invoice.invoice_number} went overdue with ${formatInr(balance)} outstanding`,
        meta: { amountMinor: balance, daysOverdue },
      });

      await notifyStaff({
        kind: "money",
        title: `Overdue — ${invoice.invoice_number}`,
        body: `${org?.name ?? "A client"} owes ${formatInr(balance)}, ${daysOverdue} day${
          daysOverdue === 1 ? "" : "s"
        } past due.`,
        href: `/admin/invoices/${invoice.id}`,
        organizationId: invoice.organization_id as string | null,
        entityType: "invoice",
        entityId: String(invoice.id),
        dedupeKey: `invoice-overdue:${invoice.id}`,
      });

      chased += 1;
      continue;
    }

    if (!overdue && !invoice.reminder_sent_at && org?.billing_email) {
      await sendInvoiceReminderEmail({
        to: org.billing_email,
        invoiceNumber: String(invoice.invoice_number),
        amountDueMinor: balance,
        dueAt,
        overdue: false,
        organizationId: invoice.organization_id as string | null,
        invoiceId: String(invoice.id),
      });
      await admin
        .from("invoices")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", invoice.id);
      reminded += 1;
    }
  }

  return { reminded, chased };
}

/**
 * The scheduled half of the lifecycle. Everything here is stamped in the
 * database before it counts as done, so a retried cron run is a no-op rather
 * than a second email in the client's inbox.
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

  const now = new Date();
  const [staleLeads, quoteFollowups, invoiceWork] = await Promise.all([
    nudgeStaleLeads(admin, now).catch((error) => {
      console.error("[cron/lifecycle] lead nudge failed", error);
      return 0;
    }),
    followUpQuietQuotes(admin, now).catch((error) => {
      console.error("[cron/lifecycle] quote follow-up failed", error);
      return 0;
    }),
    chaseInvoices(admin, now).catch((error) => {
      console.error("[cron/lifecycle] invoice chase failed", error);
      return { reminded: 0, chased: 0 };
    }),
  ]);

  return NextResponse.json({
    ok: true,
    ranAt: now.toISOString(),
    staleLeads,
    quoteFollowups,
    invoiceReminders: invoiceWork.reminded,
    invoicesMarkedOverdue: invoiceWork.chased,
  });
}
