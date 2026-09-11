import "server-only";

import { env, isWhatsAppApiConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/normalize";

export type WhatsAppSendResult = {
  sent: boolean;
  mocked: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  error?: string;
};

/**
 * Sends a text message as the WhatsApp Business / company profile.
 * Without Cloud API credentials, logs the payload (mock) so flows stay testable.
 */
export async function sendWhatsAppText(input: {
  to: string;
  body: string;
  context?: string;
}): Promise<WhatsAppSendResult> {
  const to = normalizeWhatsAppPhone(input.to);
  if (!to) {
    return {
      sent: false,
      mocked: false,
      skipped: true,
      reason: "missing_or_invalid_phone",
    };
  }

  const body = input.body.trim();
  if (!body) {
    return {
      sent: false,
      mocked: false,
      skipped: true,
      reason: "empty_body",
    };
  }

  if (!isWhatsAppApiConfigured()) {
    console.info("[whatsapp] API not configured — mock send", {
      to,
      context: input.context,
      preview: body.slice(0, 280),
      as: siteConfig.name,
    });
    return {
      sent: false,
      mocked: true,
      messageId: `mock_${crypto.randomUUID()}`,
    };
  }

  const version = env.WHATSAPP_API_VERSION ?? "v21.0";
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID!;
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message =
        payload.error?.message || `WhatsApp API HTTP ${response.status}`;
      console.error("[whatsapp] send failed", message);
      return { sent: false, mocked: false, error: message };
    }

    return {
      sent: true,
      mocked: false,
      messageId: payload.messages?.[0]?.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WhatsApp send failed";
    console.error("[whatsapp] exception", message);
    return { sent: false, mocked: false, error: message };
  }
}
