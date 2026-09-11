export const WHATSAPP_EVENT_KEYS = [
  "lead_received",
  "payment_received",
  "quotation_sent",
  "invoice_sent",
] as const;

export type WhatsAppEventKey = (typeof WHATSAPP_EVENT_KEYS)[number];

export type WhatsAppEventDefinition = {
  key: WhatsAppEventKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

/** Admin-togglable triggers for automated company WhatsApp messages. */
export const WHATSAPP_EVENTS: readonly WhatsAppEventDefinition[] = [
  {
    key: "lead_received",
    label: "Lead / inquiry received",
    description:
      "Acknowledge the client on WhatsApp after a contact form or quote request is submitted (requires phone).",
    defaultEnabled: true,
  },
  {
    key: "payment_received",
    label: "Payment received",
    description:
      "Send purchase / payment confirmation when Razorpay or Stripe marks a transaction paid.",
    defaultEnabled: true,
  },
  {
    key: "quotation_sent",
    label: "Quotation generated",
    description:
      "Send the quotation link when an admin generates a quote for a client.",
    defaultEnabled: true,
  },
  {
    key: "invoice_sent",
    label: "Invoice generated",
    description:
      "Send the invoice link when an admin generates an invoice for a client.",
    defaultEnabled: true,
  },
] as const;

export type WhatsAppEventSettings = Record<WhatsAppEventKey, boolean>;

export function defaultWhatsAppEventSettings(): WhatsAppEventSettings {
  return Object.fromEntries(
    WHATSAPP_EVENTS.map((event) => [event.key, event.defaultEnabled]),
  ) as WhatsAppEventSettings;
}
