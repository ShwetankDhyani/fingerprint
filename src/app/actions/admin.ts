"use server";

import { revalidatePath } from "next/cache";
import {
  clearAdminSession,
  createAdminSession,
  verifyAdminPassword,
  verifyAdminSession,
} from "@/lib/admin/auth";
import {
  createBusinessDocument,
  documentAmountLabel,
  documentPublicUrl,
} from "@/lib/documents";
import {
  notifyInvoiceSent,
  notifyQuotationSent,
} from "@/lib/whatsapp/dispatch";
import {
  WHATSAPP_EVENT_KEYS,
  type WhatsAppEventKey,
  type WhatsAppEventSettings,
} from "@/lib/whatsapp/events";
import { updateWhatsAppEventSettings } from "@/lib/whatsapp/settings";

export type AdminActionResult = {
  ok: boolean;
  message: string;
  link?: string;
};

export async function adminLoginAction(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    return { ok: false, message: "Incorrect password." };
  }
  const created = await createAdminSession();
  if (!created) {
    return {
      ok: false,
      message:
        "Admin password is not configured. Set ADMIN_PASSWORD in the environment.",
    };
  }
  revalidatePath("/admin");
  return { ok: true, message: "Signed in." };
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSession();
  revalidatePath("/admin");
}

export async function saveWhatsAppEventSettingsAction(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  if (!(await verifyAdminSession())) {
    return { ok: false, message: "Session expired. Sign in again." };
  }

  const patch = {} as Partial<WhatsAppEventSettings>;
  for (const key of WHATSAPP_EVENT_KEYS) {
    patch[key as WhatsAppEventKey] = formData.get(key) === "on";
  }

  const saved = await updateWhatsAppEventSettings(patch);
  revalidatePath("/admin");
  return {
    ok: true,
    message: `WhatsApp event toggles saved (${saved.source}).`,
  };
}

export async function createDocumentAndNotifyAction(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  if (!(await verifyAdminSession())) {
    return { ok: false, message: "Session expired. Sign in again." };
  }

  const typeRaw = String(formData.get("type") ?? "quotation");
  const type = typeRaw === "invoice" ? "invoice" : "quotation";
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const currency = String(formData.get("currency") ?? "INR").trim() || "INR";
  const amountMajor = Number(String(formData.get("amount") ?? "0"));

  if (!customerName || !customerPhone || !summary || !(amountMajor > 0)) {
    return {
      ok: false,
      message: "Name, phone, amount, and summary are required.",
    };
  }

  const amountMinor = Math.round(amountMajor * 100);
  const created = await createBusinessDocument({
    type,
    customerName,
    customerPhone,
    customerEmail: customerEmail || undefined,
    company: company || undefined,
    amountMinor,
    currency,
    summary,
  });

  if (created.error || !created.document) {
    return {
      ok: false,
      message: created.error || "Could not create document.",
    };
  }

  const doc = created.document;
  const link = documentPublicUrl(doc.publicToken);
  const amountLabel = documentAmountLabel(doc);

  const result =
    type === "invoice"
      ? await notifyInvoiceSent({
          phone: doc.customerPhone,
          name: doc.customerName,
          documentNumber: doc.number,
          amountLabel,
          link,
        })
      : await notifyQuotationSent({
          phone: doc.customerPhone,
          name: doc.customerName,
          documentNumber: doc.number,
          amountLabel,
          link,
        });

  const delivery = result.sent
    ? "WhatsApp sent."
    : result.mocked
      ? "WhatsApp mocked (API keys not set yet)."
      : result.skipped
        ? `WhatsApp skipped (${result.reason}).`
        : `WhatsApp failed${result.error ? `: ${result.error}` : "."}`;

  revalidatePath("/admin");
  return {
    ok: true,
    message: `${type === "invoice" ? "Invoice" : "Quotation"} ${doc.number} created. ${delivery}`,
    link,
  };
}
