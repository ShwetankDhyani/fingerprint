import "server-only";

import { emailSettings } from "@/lib/env";
import { renderEmail, type EmailContent } from "@/lib/email/render";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MailResult = {
  sent: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string;
  error?: string;
};

export type MailInput = {
  to: string | string[];
  subject: string;
  content: EmailContent;
  /** Stable identifier used in the delivery log, e.g. "client-invite". */
  template: string;
  replyTo?: string;
  organizationId?: string | null;
  entityType?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

async function logDelivery(
  input: MailInput,
  result: MailResult,
  recipients: string[],
) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const status = result.sent ? "sent" : result.provider === "none" ? "skipped" : "failed";
  const rows = recipients.map((to) => ({
    template: input.template,
    to_email: to,
    subject: input.subject,
    status,
    provider: result.provider,
    provider_message_id: result.messageId ?? null,
    error: result.error ?? null,
    organization_id: input.organizationId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    meta: input.meta ?? {},
  }));
  const { error } = await admin.from("email_log").insert(rows);
  if (error) console.error("[email] delivery log failed", error.message);
}

async function sendViaResend(
  input: MailInput,
  recipients: string[],
  html: string,
  text: string,
): Promise<MailResult> {
  const settings = emailSettings();
  const { Resend } = await import("resend");
  const resend = new Resend(settings.resendApiKey!);
  const { data, error } = await resend.emails.send({
    from: settings.from,
    to: recipients,
    replyTo: input.replyTo ?? settings.replyTo,
    subject: input.subject,
    html,
    text,
  });
  if (error) {
    return { sent: false, provider: "resend", error: error.message };
  }
  return { sent: true, provider: "resend", messageId: data?.id };
}

async function sendViaSmtp(
  input: MailInput,
  recipients: string[],
  html: string,
  text: string,
): Promise<MailResult> {
  const settings = emailSettings();
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(settings.smtpUrl!);
  const info = await transport.sendMail({
    from: settings.from,
    to: recipients.join(", "),
    replyTo: input.replyTo ?? settings.replyTo,
    subject: input.subject,
    html,
    text,
  });
  return { sent: true, provider: "smtp", messageId: info.messageId };
}

/**
 * Single outbound path for every portal email.
 * Delivery never throws — callers get a result they can surface in the UI,
 * and each attempt is written to email_log for the admin diagnostics page.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { sent: false, provider: "none", error: "No recipient address." };
  }

  const settings = emailSettings();
  const { html, text } = renderEmail(input.content);

  let result: MailResult;
  if (settings.provider === "none") {
    result = {
      sent: false,
      provider: "none",
      error:
        "Email provider is not configured. Add RESEND_API_KEY (or SMTP_URL) in Vercel.",
    };
  } else {
    try {
      result =
        settings.provider === "resend"
          ? await sendViaResend(input, recipients, html, text)
          : await sendViaSmtp(input, recipients, html, text);
    } catch (error) {
      result = {
        sent: false,
        provider: settings.provider,
        error: error instanceof Error ? error.message : "Email send failed.",
      };
    }
  }

  if (!result.sent) {
    console.error("[email] not delivered", {
      template: input.template,
      provider: result.provider,
      error: result.error,
    });
  }

  await logDelivery(input, result, recipients).catch(() => {});
  return result;
}

export async function fetchEmailLog(limit = 40) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("email_log")
    .select("id, created_at, template, to_email, subject, status, provider, error")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
