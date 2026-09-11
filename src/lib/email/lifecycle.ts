import "server-only";

import { sendMail, type MailResult } from "@/lib/email/mailer";
import { quoteUrlFor } from "@/lib/email/notifications";
import { siteUrl } from "@/lib/env";
import { formatDate, formatInr } from "@/lib/portal/format";
import { siteConfig } from "@/lib/site";

/**
 * The automated half of the lifecycle: messages nobody presses a button to
 * send. Each one lives here so the wording for a given moment exists in
 * exactly one place, and each writes to email_log so it shows up on the
 * customer timeline next to the event that caused it.
 */

/** Quote sent but never opened — one nudge, same link, no pressure. */
export async function sendQuoteFollowupEmail(input: {
  to: string;
  recipientName?: string | null;
  quoteNumber: string;
  title: string;
  totalMinor: number;
  advanceMinor: number;
  validUntil?: string | null;
  shareToken?: string | null;
  organizationId?: string | null;
  quoteId: string;
}): Promise<MailResult & { url: string }> {
  const url = quoteUrlFor(input.quoteNumber, input.shareToken);
  const first = input.recipientName?.trim().split(/\s+/)[0];

  const result = await sendMail({
    to: input.to,
    subject: `Still thinking it over? ${input.quoteNumber}`,
    template: "quote-followup",
    organizationId: input.organizationId ?? null,
    entityType: "quote",
    entityId: input.quoteId,
    content: {
      preheader: `${input.title} — ${formatInr(input.totalMinor)}`,
      heading: first ? `Hi ${first}` : "Your quotation is still open",
      blocks: [
        {
          kind: "paragraph",
          text: `We sent the quotation for ${input.title} a few days ago and haven't heard back. No rush — this is just so it doesn't get buried.`,
        },
        {
          kind: "keyValue",
          rows: [
            ["Quotation", input.quoteNumber],
            ["Total", formatInr(input.totalMinor)],
            ["Advance to start", formatInr(input.advanceMinor)],
            ...(input.validUntil
              ? ([["Valid until", formatDate(input.validUntil)]] as Array<
                  [string, string]
                >)
              : []),
          ],
        },
        {
          kind: "paragraph",
          text: "If the scope or the number needs to change, reply to this email and we'll send a revision. If the timing is wrong, tell us when to check back.",
        },
      ],
      button: { label: "Open the quotation", href: url },
    },
  });
  return { ...result, url };
}

/** Invoice approaching its due date, or already past it. */
export async function sendInvoiceReminderEmail(input: {
  to: string;
  invoiceNumber: string;
  amountDueMinor: number;
  dueAt?: string | null;
  overdue: boolean;
  daysOverdue?: number;
  organizationId?: string | null;
  invoiceId: string;
}): Promise<MailResult> {
  const rows: Array<[string, string]> = [
    ["Invoice", input.invoiceNumber],
    ["Amount due", formatInr(input.amountDueMinor)],
  ];
  if (input.dueAt) rows.push(["Due", formatDate(input.dueAt)]);

  return sendMail({
    to: input.to,
    subject: input.overdue
      ? `Overdue: invoice ${input.invoiceNumber}`
      : `Invoice ${input.invoiceNumber} is due soon`,
    template: input.overdue ? "invoice-overdue" : "invoice-due-soon",
    organizationId: input.organizationId ?? null,
    entityType: "invoice",
    entityId: input.invoiceId,
    content: {
      preheader: `${formatInr(input.amountDueMinor)} outstanding`,
      heading: input.overdue
        ? `Invoice ${input.invoiceNumber} is past due`
        : `Invoice ${input.invoiceNumber} is due soon`,
      blocks: [
        {
          kind: "paragraph",
          text: input.overdue
            ? `${formatInr(input.amountDueMinor)} on ${input.invoiceNumber} is now ${
                input.daysOverdue && input.daysOverdue > 0
                  ? `${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} `
                  : ""
              }past its due date. You can settle it online in a minute.`
            : `A quick heads-up that ${formatInr(input.amountDueMinor)} on ${input.invoiceNumber} is due in the next few days.`,
        },
        { kind: "keyValue", rows },
        {
          kind: "paragraph",
          text: "Already paid, or need different terms? Reply to this email and we'll sort it out — no automated chasing.",
        },
      ],
      button: { label: "View and pay", href: `${siteUrl()}/client/billing` },
    },
  });
}

/** A milestone crossed the line — say what landed, not that "progress was made". */
export async function sendMilestoneCompletedEmail(input: {
  to: string[];
  projectName: string;
  projectId: string;
  milestoneTitle: string;
  note?: string | null;
  organizationId?: string | null;
  milestoneId: string;
}): Promise<MailResult | null> {
  if (input.to.length === 0) return null;

  return sendMail({
    to: input.to,
    subject: `${input.projectName}: ${input.milestoneTitle} is done`,
    template: "milestone-completed",
    organizationId: input.organizationId ?? null,
    entityType: "milestone",
    entityId: input.milestoneId,
    content: {
      preheader: `${input.milestoneTitle} — ${input.projectName}`,
      heading: `${input.milestoneTitle} is complete`,
      blocks: [
        {
          kind: "paragraph",
          text: `We've finished ${input.milestoneTitle} on ${input.projectName}. The portal has the detail, including anything we need from you before the next step.`,
        },
        ...(input.note
          ? [{ kind: "callout" as const, text: input.note }]
          : []),
      ],
      button: {
        label: "See what's new",
        href: `${siteUrl()}/client/projects/${input.projectId}`,
      },
    },
  });
}

/** Project handed over: what you own, what's still covered, how to reach us. */
export async function sendProjectHandoverEmail(input: {
  to: string[];
  projectName: string;
  projectId: string;
  handoverNote?: string | null;
  outstandingMinor: number;
  organizationId?: string | null;
}): Promise<MailResult | null> {
  if (input.to.length === 0) return null;

  const settled = input.outstandingMinor <= 0;

  return sendMail({
    to: input.to,
    subject: `${input.projectName} is delivered`,
    template: "project-handover",
    organizationId: input.organizationId ?? null,
    entityType: "project",
    entityId: input.projectId,
    content: {
      preheader: `Handover notes and support terms for ${input.projectName}`,
      heading: `${input.projectName} is delivered`,
      blocks: [
        {
          kind: "paragraph",
          text: `${input.projectName} is complete and handed over. Everything we built is live and yours — the portal keeps the full history, invoices and files.`,
        },
        ...(input.handoverNote
          ? [{ kind: "callout" as const, text: input.handoverNote }]
          : []),
        {
          kind: "list",
          items: [
            "Bugs traced to work we shipped are fixed free for 30 days",
            "New features or scope changes are quoted separately",
            "Raise anything through the portal's support tab so it's tracked",
            settled
              ? "Your account is fully settled — thank you"
              : `${formatInr(input.outstandingMinor)} is still outstanding on this project`,
          ],
        },
        {
          kind: "paragraph",
          text: `If you have five minutes, reply and tell us what was good and what wasn't. We read every one of these and it shapes how ${siteConfig.shortName} works.`,
        },
      ],
      button: {
        label: "Open your portal",
        href: `${siteUrl()}/client/projects/${input.projectId}`,
      },
      footerNote: settled
        ? undefined
        : "The outstanding balance is payable from the billing section of your portal.",
    },
  });
}
