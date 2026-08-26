import "server-only";

import { Resend } from "resend";
import { ClientAcknowledgmentEmail } from "@/emails/client-acknowledgment";
import { LeadNotificationEmail } from "@/emails/lead-notification";
import { env, isEmailConfigured } from "@/lib/env";
import type { ContactInput } from "@/lib/schemas/contact";

function getResend() {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

export async function dispatchLeadEmails(input: {
  lead: ContactInput;
  leadId?: string | null;
}): Promise<{ sent: boolean; mocked: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.info("[email] Resend not configured — skipping send", {
      to: input.lead.email,
      plan: input.lead.selectedPlan,
    });
    return { sent: false, mocked: true };
  }

  const resend = getResend();
  if (!resend) return { sent: false, mocked: true };

  try {
    const from = env.EMAIL_FROM!;
    const team = env.EMAIL_TO_TEAM!;

    const [ack, alert] = await Promise.all([
      resend.emails.send({
        from,
        to: input.lead.email,
        subject: "We received your Lynx inquiry",
        react: ClientAcknowledgmentEmail({
          name: input.lead.name,
          company: input.lead.company,
          selectedPlan: input.lead.selectedPlan,
        }),
      }),
      resend.emails.send({
        from,
        to: team,
        replyTo: input.lead.email,
        subject: `New lead: ${input.lead.name} · ${input.lead.company}`,
        react: LeadNotificationEmail({
          name: input.lead.name,
          email: input.lead.email,
          company: input.lead.company,
          projectType: input.lead.projectType,
          budget: input.lead.budget,
          timeline: input.lead.timeline,
          selectedPlan: input.lead.selectedPlan,
          scope: input.lead.scope,
          leadId: input.leadId ?? undefined,
        }),
      }),
    ]);

    if (ack.error || alert.error) {
      const message = ack.error?.message || alert.error?.message || "Email failed";
      console.error("[email] send error", message);
      return { sent: false, mocked: false, error: message };
    }

    return { sent: true, mocked: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email dispatch failed";
    console.error("[email] exception", message);
    return { sent: false, mocked: false, error: message };
  }
}
