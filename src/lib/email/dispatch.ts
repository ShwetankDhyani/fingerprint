import "server-only";

import { emailSettings, isEmailConfigured } from "@/lib/env";
import { sendMail } from "@/lib/email/mailer";
import { formatInr } from "@/lib/plans";
import { formatPhoneDisplay } from "@/lib/phone";
import type { ContactInput } from "@/lib/schemas/contact";
import { siteConfig } from "@/lib/site";

export async function dispatchLeadEmails(input: {
  lead: ContactInput;
  leadId?: string | null;
}): Promise<{ sent: boolean; mocked: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.info("[email] provider not configured — lead emails skipped", {
      to: input.lead.email,
      plan: input.lead.selectedPlan,
    });
    return { sent: false, mocked: true };
  }

  const settings = emailSettings();
  const { lead } = input;

  const [ack, alert] = await Promise.all([
    sendMail({
      to: lead.email,
      subject: `We received your ${siteConfig.shortName} enquiry`,
      template: "lead-acknowledgement",
      content: {
        heading: `Thanks${lead.name ? `, ${lead.name.split(" ")[0]}` : ""} — we've got it`,
        blocks: [
          {
            kind: "paragraph",
            text: "A senior engineer reads every enquiry. Expect a reply within one business day with next steps — or message us on WhatsApp if it's urgent.",
          },
          {
            kind: "keyValue",
            rows: [
              ["Mobile", formatPhoneDisplay(lead.phone)],
              ["Plan of interest", lead.selectedPlan || "—"],
              ["Company", lead.company || "—"],
            ],
          },
          { kind: "callout", text: lead.message },
        ],
        button: { label: "See our work", href: `${siteConfig.url}/work` },
      },
    }),
    sendMail({
      to: settings.teamInbox,
      replyTo: lead.email,
      subject: `New lead: ${lead.name}${lead.company ? ` · ${lead.company}` : ""}`,
      template: "lead-notification",
      entityType: "lead",
      entityId: input.leadId ?? null,
      content: {
        heading: `New enquiry from ${lead.name}`,
        blocks: [
          {
            kind: "keyValue",
            rows: [
              ["Name", lead.name],
              ["Email", lead.email],
              ["Mobile", formatPhoneDisplay(lead.phone)],
              ["Company", lead.company || "—"],
              ["Plan", lead.selectedPlan || "—"],
            ],
          },
          { kind: "callout", text: lead.message || "(no message)" },
        ],
      },
    }),
  ]);

  if (!ack.sent || !alert.sent) {
    return {
      sent: false,
      mocked: false,
      error: ack.error || alert.error || "Email failed",
    };
  }
  return { sent: true, mocked: false };
}

/** Client receipt + team alert after a plan advance is marked paid. */
export async function dispatchAdvancePaidEmails(input: {
  customerName: string;
  customerEmail?: string | null;
  planName: string;
  amountInr: number;
  orderId: string;
  invoiceNumber?: string | null;
  portalAccess?: {
    url: string;
    needsPasswordSetup: boolean;
  } | null;
}): Promise<{ sent: boolean; mocked: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.info("[email] provider not configured — receipt skipped", {
      orderId: input.orderId,
    });
    return { sent: false, mocked: true };
  }

  const settings = emailSettings();
  const rows: Array<[string, string]> = [
    ["Plan", input.planName],
    ["Amount", formatInr(input.amountInr)],
    ["Reference", input.orderId],
  ];
  if (input.invoiceNumber) rows.push(["Invoice", input.invoiceNumber]);

  const portal = input.portalAccess;

  const jobs = [
    sendMail({
      to: settings.teamInbox,
      replyTo: input.customerEmail ?? undefined,
      subject: `Advance paid: ${input.planName} · ${formatInr(input.amountInr)}`,
      template: "advance-paid-team",
      content: {
        heading: "Advance payment received",
        blocks: [
          {
            kind: "paragraph",
            text: `${input.customerName} booked ${input.planName}.${
              portal
                ? " Client portal invite is included on their receipt."
                : ""
            }`,
          },
          { kind: "keyValue", rows },
        ],
      },
    }),
  ];

  if (input.customerEmail) {
    const clientBlocks: Array<
      | { kind: "paragraph"; text: string }
      | { kind: "keyValue"; rows: Array<[string, string]> }
      | { kind: "callout"; text: string }
      | { kind: "list"; items: string[] }
    > = [
      {
        kind: "paragraph",
        text: "Thanks for the advance — your booking is confirmed.",
      },
      {
        kind: "list",
        items: [
          "Keep this email as your payment receipt",
          "Activate the client portal to track kickoff and message us",
          "We'll reach out within one business day to schedule the start",
        ],
      },
      { kind: "keyValue", rows },
    ];

    if (portal?.needsPasswordSetup) {
      clientBlocks.push({
        kind: "callout",
        text: "Your portal invite is ready — choose a password with the button below. The link expires in 14 days.",
      });
    } else if (portal) {
      clientBlocks.push({
        kind: "callout",
        text: "Sign in with this email to open the client portal.",
      });
    }

    jobs.push(
      sendMail({
        to: input.customerEmail,
        subject: portal
          ? "Payment received — client portal access included"
          : `Advance received — ${input.planName}`,
        template: "advance-paid-client",
        content: {
          heading: "Your booking is confirmed",
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

  const results = await Promise.all(jobs);
  const failed = results.find((result) => !result.sent);
  if (failed) {
    return { sent: false, mocked: false, error: failed.error };
  }
  return { sent: true, mocked: false };
}
