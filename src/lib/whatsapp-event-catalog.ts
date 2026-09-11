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

export const WHATSAPP_EVENTS: readonly WhatsAppEventDefinition[] = [
  {
    key: "lead_received",
    label: "Lead / inquiry received",
    description:
      "Acknowledge the client on WhatsApp after a contact form or quote request is submitted (requires phone).",
    defaultEnabled: false,
  },
  {
    key: "payment_received",
    label: "Payment received",
    description:
      "Send purchase / payment confirmation when Cashfree marks an advance or invoice paid.",
    defaultEnabled: true,
  },
  {
    key: "quotation_sent",
    label: "Quotation generated / sent",
    description:
      "Send the quotation link when an admin creates or sends a quote.",
    defaultEnabled: true,
  },
  {
    key: "invoice_sent",
    label: "Invoice generated / sent",
    description:
      "Send the invoice notice when an admin issues an invoice to a client.",
    defaultEnabled: true,
  },
] as const;

export type WhatsAppEventSettings = Record<WhatsAppEventKey, boolean>;

export function defaultWhatsAppEventSettings(): WhatsAppEventSettings {
  return Object.fromEntries(
    WHATSAPP_EVENTS.map((event) => [event.key, event.defaultEnabled]),
  ) as WhatsAppEventSettings;
}
