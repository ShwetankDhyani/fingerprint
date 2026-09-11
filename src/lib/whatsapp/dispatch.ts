import "server-only";

import {
  sendWhatsAppText,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/client";
import type { WhatsAppEventKey } from "@/lib/whatsapp/events";
import {
  invoiceSentMessage,
  leadReceivedMessage,
  paymentReceivedMessage,
  quotationSentMessage,
} from "@/lib/whatsapp/messages";
import { isWhatsAppEventEnabled } from "@/lib/whatsapp/settings";

async function gatedSend(input: {
  event: WhatsAppEventKey;
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  const enabled = await isWhatsAppEventEnabled(input.event);
  if (!enabled) {
    return {
      sent: false,
      mocked: false,
      skipped: true,
      reason: "event_disabled",
    };
  }
  return sendWhatsAppText({
    to: input.to,
    body: input.body,
    context: input.event,
  });
}

export async function notifyLeadReceived(input: {
  phone?: string | null;
  name: string;
  company: string;
  selectedPlan?: string | null;
}): Promise<WhatsAppSendResult> {
  return gatedSend({
    event: "lead_received",
    to: input.phone ?? "",
    body: leadReceivedMessage(input),
  });
}

export async function notifyPaymentReceived(input: {
  phone?: string | null;
  name?: string | null;
  planName: string;
  amountMinor: number;
  currency: string;
  invoiceNumber?: string | null;
}): Promise<WhatsAppSendResult> {
  return gatedSend({
    event: "payment_received",
    to: input.phone ?? "",
    body: paymentReceivedMessage(input),
  });
}

export async function notifyQuotationSent(input: {
  phone: string;
  name?: string | null;
  documentNumber: string;
  amountLabel: string;
  link: string;
}): Promise<WhatsAppSendResult> {
  return gatedSend({
    event: "quotation_sent",
    to: input.phone,
    body: quotationSentMessage(input),
  });
}

export async function notifyInvoiceSent(input: {
  phone: string;
  name?: string | null;
  documentNumber: string;
  amountLabel: string;
  link: string;
}): Promise<WhatsAppSendResult> {
  return gatedSend({
    event: "invoice_sent",
    to: input.phone,
    body: invoiceSentMessage(input),
  });
}
