import "server-only";

import { env, siteUrl } from "@/lib/env";
import { formatInr } from "@/lib/portal/utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type WhatsAppSettings = {
  configured: boolean;
  phoneNumberId?: string;
  accessToken?: string;
  paymentTemplate: string;
  quoteTemplate: string;
  languageCode: string;
};

export function whatsappSettings(): WhatsAppSettings {
  const phoneNumberId =
    env.WHATSAPP_PHONE_NUMBER_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    undefined;
  const accessToken =
    env.WHATSAPP_ACCESS_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    undefined;
  return {
    configured: Boolean(phoneNumberId && accessToken),
    phoneNumberId,
    accessToken,
    paymentTemplate:
      env.WHATSAPP_PAYMENT_TEMPLATE ||
      process.env.WHATSAPP_PAYMENT_TEMPLATE?.trim() ||
      "payment_confirmation",
    quoteTemplate:
      process.env.WHATSAPP_QUOTE_TEMPLATE?.trim() || "quotation_ready",
    languageCode:
      env.WHATSAPP_TEMPLATE_LANG ||
      process.env.WHATSAPP_TEMPLATE_LANG?.trim() ||
      "en",
  };
}

export function isWhatsAppConfigured() {
  return whatsappSettings().configured;
}

function toE164(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

async function logWhatsApp(row: {
  toPhone: string;
  template: string;
  body: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("whatsapp_log").insert({
    to_phone: row.toPhone,
    template: row.template,
    body: row.body,
    status: row.status,
    provider: "meta",
    provider_message_id: row.providerMessageId ?? null,
    error: row.error ?? null,
    organization_id: row.organizationId ?? null,
    entity_type: row.entityType ?? null,
    entity_id: row.entityId ?? null,
    meta: row.meta ?? {},
  });
}

export type WhatsAppSendResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
};

/** Sends an approved WhatsApp Cloud API template message. */
export async function sendWhatsAppTemplate(input: {
  toPhone: string;
  template: string;
  bodyPreview: string;
  bodyParameters?: string[];
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): Promise<WhatsAppSendResult> {
  const settings = whatsappSettings();
  const to = toE164(input.toPhone);
  if (to.length < 10) {
    await logWhatsApp({
      toPhone: input.toPhone,
      template: input.template,
      body: input.bodyPreview,
      status: "skipped",
      error: "Invalid phone number",
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return { sent: false, skipped: true, error: "Invalid phone number" };
  }

  if (!settings.configured) {
    await logWhatsApp({
      toPhone: to,
      template: input.template,
      body: input.bodyPreview,
      status: "skipped",
      error: "WhatsApp Cloud API is not configured",
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return {
      sent: false,
      skipped: true,
      error: "WhatsApp Cloud API is not configured",
    };
  }

  const components =
    input.bodyParameters && input.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: input.bodyParameters.map((text) => ({
              type: "text",
              text: String(text).slice(0, 1024),
            })),
          },
        ]
      : undefined;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: input.template,
            language: { code: settings.languageCode },
            ...(components ? { components } : {}),
          },
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      const error = json.error?.message || `WhatsApp API ${res.status}`;
      await logWhatsApp({
        toPhone: to,
        template: input.template,
        body: input.bodyPreview,
        status: "failed",
        error,
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: { response: json },
      });
      return { sent: false, error };
    }
    const messageId = json.messages?.[0]?.id;
    await logWhatsApp({
      toPhone: to,
      template: input.template,
      body: input.bodyPreview,
      status: "sent",
      providerMessageId: messageId,
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return { sent: true, messageId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WhatsApp send failed";
    await logWhatsApp({
      toPhone: to,
      template: input.template,
      body: input.bodyPreview,
      status: "failed",
      error: message,
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return { sent: false, error: message };
  }
}

async function gatedEvent(
  event: "lead_received" | "payment_received" | "quotation_sent" | "invoice_sent",
) {
  const { isWhatsAppEventEnabled } = await import("@/lib/whatsapp-events");
  return isWhatsAppEventEnabled(event);
}

export async function sendPaymentWhatsApp(input: {
  toPhone?: string | null;
  clientName?: string | null;
  amountMinor: number;
  reference: string;
  documentLabel: string;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  if (!(await gatedEvent("payment_received"))) {
    return {
      sent: false as const,
      skipped: true,
      error: "Event disabled in Admin → Settings",
    };
  }
  if (!input.toPhone) {
    return { sent: false as const, skipped: true, error: "No phone on file" };
  }
  const settings = whatsappSettings();
  const amount = formatInr(input.amountMinor);
  const name = input.clientName?.trim().split(/\s+/)[0] || "there";
  const preview = `Hi ${name}, Lynx received ${amount} for ${input.documentLabel}. Ref: ${input.reference}. Thank you.`;
  return sendWhatsAppTemplate({
    toPhone: input.toPhone,
    template: settings.paymentTemplate,
    bodyPreview: preview,
    bodyParameters: [name, amount, input.documentLabel, input.reference],
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

/** Quote just went out by email — a WhatsApp line so it isn't missed. */
export async function sendQuoteWhatsApp(input: {
  toPhone?: string | null;
  clientName?: string | null;
  quoteNumber: string;
  title: string;
  totalMinor: number;
  url: string;
  organizationId?: string | null;
  quoteId: string;
}) {
  if (!(await gatedEvent("quotation_sent"))) {
    return {
      sent: false as const,
      skipped: true,
      error: "Event disabled in Admin → Settings",
    };
  }
  if (!input.toPhone) {
    return { sent: false as const, skipped: true, error: "No phone on file" };
  }
  const settings = whatsappSettings();
  const name = input.clientName?.trim().split(/\s+/)[0] || "there";
  const amount = formatInr(input.totalMinor);
  const preview = `Hi ${name}, your Lynx quotation ${input.quoteNumber} for ${input.title} (${amount}) is ready: ${input.url}`;
  return sendWhatsAppTemplate({
    toPhone: input.toPhone,
    template: settings.quoteTemplate,
    bodyPreview: preview,
    bodyParameters: [name, input.quoteNumber, input.title, amount, input.url],
    organizationId: input.organizationId,
    entityType: "quote",
    entityId: input.quoteId,
  });
}

export async function sendInvoiceWhatsApp(input: {
  toPhone?: string | null;
  clientName?: string | null;
  invoiceNumber: string;
  amountMinor: number;
  dueAt?: string | null;
  url?: string | null;
  organizationId?: string | null;
  invoiceId: string;
}) {
  if (!(await gatedEvent("invoice_sent"))) {
    return {
      sent: false as const,
      skipped: true,
      error: "Event disabled in Admin → Settings",
    };
  }
  if (!input.toPhone) {
    return { sent: false as const, skipped: true, error: "No phone on file" };
  }
  const settings = whatsappSettings();
  const name = input.clientName?.trim().split(/\s+/)[0] || "there";
  const amount = formatInr(input.amountMinor);
  const due = input.dueAt ? ` Due ${input.dueAt}.` : "";
  const link = input.url ? ` ${input.url}` : "";
  const preview = `Hi ${name}, your Lynx invoice ${input.invoiceNumber} for ${amount} is ready.${due}${link}`;
  const template =
    process.env.WHATSAPP_INVOICE_TEMPLATE?.trim() || "invoice_ready";
  return sendWhatsAppTemplate({
    toPhone: input.toPhone,
    template,
    bodyPreview: preview,
    bodyParameters: [
      name,
      input.invoiceNumber,
      amount,
      input.dueAt || "on receipt",
      input.url || siteUrl() || "lynxweb.in",
    ],
    organizationId: input.organizationId,
    entityType: "invoice",
    entityId: input.invoiceId,
  });
}

export async function sendLeadReceivedWhatsApp(input: {
  toPhone?: string | null;
  clientName?: string | null;
  company?: string | null;
  selectedPlan?: string | null;
  leadId?: string | null;
}) {
  if (!(await gatedEvent("lead_received"))) {
    return {
      sent: false as const,
      skipped: true,
      error: "Event disabled in Admin → Settings",
    };
  }
  if (!input.toPhone) {
    return { sent: false as const, skipped: true, error: "No phone on file" };
  }
  const name = input.clientName?.trim().split(/\s+/)[0] || "there";
  const company = input.company?.trim() || "your project";
  const plan = input.selectedPlan?.trim()
    ? ` Plan interest: ${input.selectedPlan.trim()}.`
    : "";
  const preview = `Hi ${name}, thanks for reaching out to Lynx about ${company}.${plan} A Lynx engineer will reply within one business day.`;
  const template =
    process.env.WHATSAPP_LEAD_TEMPLATE?.trim() || "lead_received";
  return sendWhatsAppTemplate({
    toPhone: input.toPhone,
    template,
    bodyPreview: preview,
    bodyParameters: [name, company, input.selectedPlan?.trim() || "general enquiry"],
    organizationId: null,
    entityType: "lead",
    entityId: input.leadId,
  });
}

export async function fetchWhatsAppLog(limit = 25) {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("whatsapp_log")
    .select(
      "id, created_at, to_phone, template, status, error, provider_message_id",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
