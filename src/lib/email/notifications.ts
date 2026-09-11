import "server-only";

import { emailSettings, siteUrl } from "@/lib/env";
import { sendMail, type MailResult } from "@/lib/email/mailer";
import type { EmailBlock } from "@/lib/email/render";
import { formatInr } from "@/lib/portal/format";
import { siteConfig } from "@/lib/site";

export function inviteUrlFor(token: string) {
  return `${siteUrl()}/invite/${token}`;
}

export function quoteUrlFor(quoteNumber: string, shareToken?: string | null) {
  const base = `${siteUrl()}/q/${encodeURIComponent(quoteNumber)}`;
  return shareToken ? `${base}?t=${encodeURIComponent(shareToken)}` : base;
}

function isStaffInviteRole(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";
}

export async function sendInviteEmail(input: {
  email: string;
  fullName: string;
  token: string;
  role?: string | null;
  organizationName?: string | null;
  organizationId?: string | null;
  invitedBy?: string | null;
}): Promise<MailResult & { url: string }> {
  const url = inviteUrlFor(input.token);
  const staffInvite = isStaffInviteRole(input.role);
  const portalLabel = staffInvite ? "admin portal" : "client portal";
  const firstName = input.fullName ? input.fullName.split(" ")[0] : "";

  const result = await sendMail({
    to: input.email,
    subject: `Your ${siteConfig.name} ${portalLabel} access`,
    template: staffInvite ? "staff-invite" : "client-invite",
    organizationId: input.organizationId ?? null,
    entityType: "invite",
    content: {
      preheader: staffInvite
        ? "Set your password and open the Lynx admin panel."
        : "Set your password and open your project workspace.",
      heading: `Welcome${firstName ? `, ${firstName}` : ""}`,
      blocks: [
        {
          kind: "paragraph",
          text: staffInvite
            ? `${input.invitedBy ?? siteConfig.name} has invited you to the Lynx ${portalLabel}${
                input.role ? ` as ${String(input.role).replaceAll("_", " ").toLowerCase()}` : ""
              }. Use the button below to choose a password — it takes about a minute.`
            : `${input.invitedBy ?? siteConfig.name} has set up a ${portalLabel} account${
                input.organizationName ? ` for ${input.organizationName}` : ""
              }. Use the button below to choose a password — it takes about a minute.`,
        },
        {
          kind: "list",
          items: staffInvite
            ? [
                "Manage clients, projects, quotes and invoices",
                "Publish progress updates and screenshots",
                "Handle support tickets and client messages",
                "Invite teammates and keep the panel running",
              ]
            : [
                "See project progress with screenshots and milestones",
                "Review and accept quotations, pay the advance online",
                "Raise support tickets and message the team directly",
                "Download invoices and payment receipts",
              ],
        },
        {
          kind: "callout",
          text: "This invitation link expires in 14 days and can only be used once.",
        },
      ],
      button: { label: "Set your password", href: url },
      footerNote: staffInvite
        ? `You are receiving this because ${input.email} was invited to the Lynx admin team. If this wasn't expected, ignore this email or reply to let us know.`
        : `You are receiving this because ${input.email} was added as a contact. If this wasn't expected, ignore this email or reply to let us know.`,
    },
  });
  return { ...result, url };
}

export async function sendQuoteEmail(input: {
  to: string;
  recipientName?: string | null;
  quoteNumber: string;
  title: string;
  totalMinor: number;
  advanceMinor: number;
  validUntil?: string | null;
  shareToken?: string | null;
  organizationId?: string | null;
  quoteId?: string | null;
}): Promise<MailResult & { url: string }> {
  const url = quoteUrlFor(input.quoteNumber, input.shareToken);
  const rows: Array<[string, string]> = [
    ["Quotation", input.quoteNumber],
    ["Scope", input.title],
    ["Total", formatInr(input.totalMinor)],
    ["Advance to start", formatInr(input.advanceMinor)],
  ];
  if (input.validUntil) {
    rows.push([
      "Valid until",
      new Date(input.validUntil).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ]);
  }

  const result = await sendMail({
    to: input.to,
    subject: `Quotation ${input.quoteNumber} from ${siteConfig.name}`,
    template: "quote-sent",
    organizationId: input.organizationId ?? null,
    entityType: "quote",
    entityId: input.quoteId ?? null,
    content: {
      preheader: `${input.title} — ${formatInr(input.totalMinor)}`,
      heading: `Your quotation is ready`,
      blocks: [
        {
          kind: "paragraph",
          text: `Hi${input.recipientName ? ` ${input.recipientName.split(" ")[0]}` : ""}, here is the quotation for ${input.title}. Open it to review the scope, then accept and pay the advance online to start the project.`,
        },
        { kind: "keyValue", rows },
        {
          kind: "paragraph",
          text: "Payment is handled by Cashfree — UPI, cards, net banking and international cards are all supported.",
        },
      ],
      button: { label: "View quotation", href: url },
      footerNote:
        "Questions or need a revision? Just reply to this email and we'll turn it around.",
    },
  });
  return { ...result, url };
}

export async function sendQuoteAcceptedEmails(input: {
  clientEmail?: string | null;
  clientName?: string | null;
  quoteNumber: string;
  title: string;
  amountMinor: number;
  orderId: string;
  invoiceNumber?: string | null;
  organizationId?: string | null;
  /**
   * Portal access CTA from onboarding. When needsPasswordSetup is true this is
   * an invite link; otherwise it's the login URL for an existing account.
   */
  portalAccess?: {
    url: string;
    needsPasswordSetup: boolean;
  } | null;
}) {
  const settings = emailSettings();
  const rows: Array<[string, string]> = [
    ["Quotation", input.quoteNumber],
    ["Amount paid", formatInr(input.amountMinor)],
    ["Payment reference", input.orderId],
  ];
  if (input.invoiceNumber) rows.push(["Invoice", input.invoiceNumber]);

  const jobs: Promise<MailResult>[] = [
    sendMail({
      to: settings.teamInbox,
      subject: `Advance received · ${input.quoteNumber} · ${formatInr(input.amountMinor)}`,
      template: "quote-paid-team",
      organizationId: input.organizationId ?? null,
      entityType: "quote",
      replyTo: input.clientEmail ?? undefined,
      content: {
        heading: "Advance payment received",
        blocks: [
          {
            kind: "paragraph",
            text: `${input.clientName ?? "A client"} accepted ${input.quoteNumber} (${input.title}) and paid the advance.`,
          },
          { kind: "section", title: "Payment details" },
          { kind: "keyValue", rows },
        ],
        button: { label: "Open admin panel", href: `${siteUrl()}/admin/quotes` },
      },
    }),
  ];

  if (input.clientEmail) {
    const portal = input.portalAccess;
    const clientBlocks: EmailBlock[] = [
      {
        kind: "paragraph",
        text: `Your payment for ${input.title} is confirmed. We'll kick off and share the project plan within one business day.`,
      },
      { kind: "section", title: "Payment details" },
      { kind: "keyValue", rows },
    ];

    if (portal?.needsPasswordSetup) {
      clientBlocks.push(
        { kind: "section", title: "Client portal access included" },
        {
          kind: "paragraph",
          text: "Your client portal is ready — follow progress, review milestones, message the team, and download invoices from one place.",
        },
        {
          kind: "list",
          items: [
            "Track delivery and milestone updates",
            "Message the Lynx team and raise support tickets",
            "Download invoices and payment receipts",
            "Review quotations and upcoming work",
          ],
        },
        {
          kind: "callout",
          text: "Choose a password with the button below to activate access. The link expires in 14 days and works once.",
        },
      );
    } else if (portal) {
      clientBlocks.push(
        { kind: "section", title: "Client portal access included" },
        {
          kind: "paragraph",
          text: "Sign in with the email on this receipt to follow progress, message the team, and download invoices.",
        },
      );
    }

    jobs.push(
      sendMail({
        to: input.clientEmail,
        subject: portal
          ? `Payment received — client portal access included`
          : `Payment received — ${input.quoteNumber}`,
        template: "quote-paid-client",
        organizationId: input.organizationId ?? null,
        entityType: "quote",
        content: {
          preheader: portal
            ? `${formatInr(input.amountMinor)} received for ${input.quoteNumber}. Client portal access is included.`
            : `${formatInr(input.amountMinor)} received for ${input.quoteNumber}.`,
          heading: "Thank you — we've received your advance",
          blocks: clientBlocks,
          button: portal
            ? {
                label: portal.needsPasswordSetup
                  ? "Activate client portal"
                  : "Open client portal",
                href: portal.url,
              }
            : undefined,
          footerNote: "Keep this email as your payment receipt.",
        },
      }),
    );
  }

  return Promise.all(jobs);
}


export async function sendTicketCreatedEmails(input: {
  ticketNumber: string;
  subject: string;
  body: string;
  priority: string;
  category: string;
  clientName: string;
  clientEmail?: string | null;
  organizationName?: string | null;
  organizationId?: string | null;
  threadId: string;
}) {
  const settings = emailSettings();
  const rows: Array<[string, string]> = [
    ["Ticket", input.ticketNumber],
    ["Priority", input.priority],
    ["Category", input.category],
    ["Raised by", input.clientName],
  ];
  if (input.organizationName) rows.push(["Client", input.organizationName]);

  const jobs = [
    sendMail({
      to: settings.teamInbox,
      subject: `[${input.ticketNumber}] ${input.subject}`,
      template: "ticket-created-team",
      organizationId: input.organizationId ?? null,
      entityType: "thread",
      entityId: input.threadId,
      replyTo: input.clientEmail ?? undefined,
      content: {
        heading: `New ${input.priority} priority ticket`,
        blocks: [
          { kind: "keyValue", rows },
          { kind: "callout", text: input.body },
        ],
        button: {
          label: "Open ticket",
          href: `${siteUrl()}/admin/tickets/${input.threadId}`,
        },
      },
    }),
  ];

  if (input.clientEmail) {
    jobs.push(
      sendMail({
        to: input.clientEmail,
        subject: `We received your request — ${input.ticketNumber}`,
        template: "ticket-created-client",
        organizationId: input.organizationId ?? null,
        entityType: "thread",
        entityId: input.threadId,
        content: {
          heading: "Your ticket is logged",
          blocks: [
            {
              kind: "paragraph",
              text: `Thanks — we've logged ${input.ticketNumber} and the team has been notified. Urgent issues are picked up the same day; everything else within one business day.`,
            },
            { kind: "keyValue", rows },
          ],
          button: {
            label: "Track this ticket",
            href: `${siteUrl()}/client/support/${input.threadId}`,
          },
        },
      }),
    );
  }

  return Promise.all(jobs);
}

export async function sendTicketReplyEmail(input: {
  to: string;
  ticketNumber: string;
  subject: string;
  body: string;
  authorName: string;
  threadId: string;
  toStaff: boolean;
  organizationId?: string | null;
}) {
  return sendMail({
    to: input.to,
    subject: `[${input.ticketNumber}] ${input.subject}`,
    template: input.toStaff ? "ticket-reply-team" : "ticket-reply-client",
    organizationId: input.organizationId ?? null,
    entityType: "thread",
    entityId: input.threadId,
    content: {
      heading: `New reply on ${input.ticketNumber}`,
      blocks: [
        { kind: "paragraph", text: `${input.authorName} wrote:` },
        { kind: "callout", text: input.body },
      ],
      button: {
        label: "Open conversation",
        href: input.toStaff
          ? `${siteUrl()}/admin/tickets/${input.threadId}`
          : `${siteUrl()}/client/support/${input.threadId}`,
      },
    },
  });
}

export async function sendSnapshotEmail(input: {
  to: string[];
  projectName: string;
  projectId: string;
  title: string;
  changelog: string;
  stagingUrl?: string | null;
  organizationId?: string | null;
}) {
  if (input.to.length === 0) return null;
  return sendMail({
    to: input.to,
    subject: `Progress update — ${input.projectName}`,
    template: "project-snapshot",
    organizationId: input.organizationId ?? null,
    entityType: "project",
    entityId: input.projectId,
    content: {
      preheader: input.title,
      heading: input.title,
      blocks: [
        { kind: "paragraph", text: `Here's what moved on ${input.projectName}.` },
        { kind: "callout", text: input.changelog },
        ...(input.stagingUrl
          ? [
              {
                kind: "paragraph" as const,
                text: `Preview build: ${input.stagingUrl}`,
              },
            ]
          : []),
      ],
      button: {
        label: "Open project",
        href: `${siteUrl()}/client/projects/${input.projectId}`,
      },
    },
  });
}

export async function sendInvoiceEmail(input: {
  to: string;
  invoiceNumber: string;
  amountDueMinor: number;
  dueAt?: string | null;
  organizationId?: string | null;
  invoiceId: string;
}) {
  const rows: Array<[string, string]> = [
    ["Invoice", input.invoiceNumber],
    ["Amount due", formatInr(input.amountDueMinor)],
  ];
  if (input.dueAt) rows.push(["Due by", input.dueAt]);

  return sendMail({
    to: input.to,
    subject: `Invoice ${input.invoiceNumber} from ${siteConfig.name}`,
    template: "invoice-sent",
    organizationId: input.organizationId ?? null,
    entityType: "invoice",
    entityId: input.invoiceId,
    content: {
      heading: `Invoice ${input.invoiceNumber}`,
      blocks: [
        {
          kind: "paragraph",
          text: "Your invoice is ready. You can pay online from the billing section of your portal.",
        },
        { kind: "keyValue", rows },
      ],
      button: { label: "View and pay", href: `${siteUrl()}/client/billing` },
    },
  });
}

export async function sendTestEmail(to: string) {
  const settings = emailSettings();
  return sendMail({
    to,
    subject: `${siteConfig.name} — email delivery test`,
    template: "diagnostic-test",
    content: {
      heading: "Email delivery is working",
      blocks: [
        {
          kind: "paragraph",
          text: "This is a test message sent from the Lynx admin panel. If you can read this, invites, quotations, receipts and ticket notifications will all reach your clients.",
        },
        {
          kind: "keyValue",
          rows: [
            ["Provider", settings.provider],
            ["From", settings.from],
            ["Reply-to", settings.replyTo],
          ],
        },
      ],
    },
  });
}

/** Portal password reset — Lynx-branded, never the default Supabase mailer. */
export async function sendPasswordResetEmail(input: {
  to: string;
  fullName?: string | null;
  resetUrl: string;
}) {
  const first = input.fullName?.trim().split(/\s+/)[0];
  return sendMail({
    to: input.to,
    subject: `Reset your ${siteConfig.name} portal password`,
    template: "password-reset",
    entityType: "auth",
    content: {
      heading: first ? `Hi ${first},` : "Reset your password",
      blocks: [
        {
          kind: "paragraph",
          text: `We received a request to reset the password for your ${siteConfig.name} portal account (${input.to}).`,
        },
        {
          kind: "paragraph",
          text: "Use the button below to choose a new password. The link expires in about an hour and can only be used once.",
        },
        {
          kind: "callout",
          text: "If you didn’t ask for this, you can ignore this email — your password will stay the same.",
        },
      ],
      button: { label: "Choose a new password", href: input.resetUrl },
      footerNote: `Sent by ${siteConfig.name} · ${siteConfig.url.replace(/^https?:\/\//, "")}`,
    },
  });
}


export async function sendInvoicePaidEmails(input: {
  clientEmail?: string | null;
  clientName?: string | null;
  invoiceNumber: string;
  amountMinor: number;
  orderId: string;
  organizationId?: string | null;
  remainingMinor?: number;
}) {
  const settings = emailSettings();
  const rows: Array<[string, string]> = [
    ["Invoice", input.invoiceNumber],
    ["Amount paid", formatInr(input.amountMinor)],
    ["Payment reference", input.orderId],
  ];
  if (typeof input.remainingMinor === "number") {
    rows.push([
      "Balance remaining",
      input.remainingMinor > 0 ? formatInr(input.remainingMinor) : "Settled",
    ]);
  }

  const jobs: Promise<MailResult>[] = [
    sendMail({
      to: settings.teamInbox,
      subject: `Invoice paid · ${input.invoiceNumber} · ${formatInr(input.amountMinor)}`,
      template: "invoice-paid-team",
      organizationId: input.organizationId ?? null,
      entityType: "invoice",
      replyTo: input.clientEmail ?? undefined,
      content: {
        heading: "Invoice payment received",
        blocks: [
          {
            kind: "paragraph",
            text: `${input.clientName ?? "A client"} paid ${input.invoiceNumber}.`,
          },
          { kind: "keyValue", rows },
        ],
        button: {
          label: "Open invoices",
          href: `${siteUrl()}/admin/invoices`,
        },
      },
    }),
  ];

  if (input.clientEmail) {
    jobs.push(
      sendMail({
        to: input.clientEmail,
        subject: `Payment received — ${input.invoiceNumber}`,
        template: "invoice-paid-client",
        organizationId: input.organizationId ?? null,
        entityType: "invoice",
        content: {
          heading: "Thank you — payment confirmed",
          blocks: [
            {
              kind: "paragraph",
              text: `We've received your payment for ${input.invoiceNumber}. Your billing page in the portal shows the updated balance.`,
            },
            { kind: "keyValue", rows },
          ],
          button: {
            label: "View billing",
            href: `${siteUrl()}/client/billing`,
          },
          footerNote: "Keep this email as your payment receipt.",
        },
      }),
    );
  }

  return Promise.all(jobs);
}
