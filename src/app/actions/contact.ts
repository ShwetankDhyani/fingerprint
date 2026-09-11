"use server";

import { headers } from "next/headers";
import { dispatchLeadEmails } from "@/lib/email/dispatch";
import { notifyStaff } from "@/lib/portal/notify";
import { logActivity } from "@/lib/portal/utils";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  contactSchema,
  type ContactInput,
} from "@/lib/schemas/contact";
import { sanitizeEmail, sanitizePhone, sanitizeText } from "@/lib/sanitize";
import { getSupabaseAdmin, insertLead } from "@/lib/supabase/admin";
import { sendLeadReceivedWhatsApp } from "@/lib/whatsapp";

export type ContactActionState = {
  ok: boolean;
  message: string;
  leadId?: string;
  errors?: Partial<Record<keyof ContactInput, string>>;
};

function sanitizeEnquiry(raw: ContactInput) {
  return {
    name: sanitizeText(raw.name, 120),
    email: sanitizeEmail(raw.email),
    phone: sanitizePhone(raw.phone),
    message: sanitizeText(raw.message, 2000),
    selectedPlan: raw.selectedPlan
      ? sanitizeText(raw.selectedPlan, 160)
      : undefined,
    company: raw.company ? sanitizeText(raw.company, 160) : "",
  };
}

export async function submitProjectInquiry(
  _prev: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  const limited = rateLimit(`contact:${ip}`, 6, 60_000);
  if (!limited.ok) {
    return {
      ok: false,
      message: "Too many submissions. Please wait a minute and try again.",
    };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    message: String(formData.get("message") ?? ""),
    selectedPlan: String(formData.get("selectedPlan") ?? "") || undefined,
    company: String(formData.get("company") ?? "") || undefined,
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: ContactActionState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactInput;
      if (!errors[key]) errors[key] = issue.message;
    }
    return {
      ok: false,
      message: "Fix the highlighted fields and try again.",
      errors,
    };
  }

  const enquiry = sanitizeEnquiry(parsed.data);
  const company = enquiry.company || enquiry.name;
  const projectType = enquiry.selectedPlan ? "plan-booking" : "other";
  const budget = enquiry.selectedPlan
    ? `plan-${enquiry.selectedPlan}`
    : "not-sure";
  const timeline = "exploring";

  try {
    const stored = await insertLead({
      name: enquiry.name,
      email: enquiry.email,
      company,
      projectType,
      budget,
      timeline,
      selectedPlan: enquiry.selectedPlan,
      scope: enquiry.message,
      source: "contact_form",
      meta: {
        ip,
        phone: enquiry.phone,
        phoneDisplay: formatPhoneDisplay(enquiry.phone),
        shortForm: true,
      },
    });

    if (stored.error || !stored.id) {
      console.error("[contact] lead persist error", stored.error);
      return {
        ok: false,
        message:
          "We couldn’t save your inquiry right now. Please try again or email care@lynxweb.in.",
      };
    }

    const admin = getSupabaseAdmin();
    if (admin && !stored.mocked) {
      await logActivity(admin, {
        action: "created",
        entityType: "lead",
        entityId: stored.id,
        summary: `Enquiry from ${enquiry.name}${company ? ` (${company})` : ""}`,
        meta: {
          email: enquiry.email,
          phone: enquiry.phone,
          selectedPlan: enquiry.selectedPlan ?? null,
          source: "contact_form",
          shortForm: true,
        },
      }).catch((error) => console.error("[contact] activity log failed", error));

      await notifyStaff({
        kind: "lead",
        title: `New enquiry — ${enquiry.name}`,
        body: `${formatPhoneDisplay(enquiry.phone)} · ${enquiry.selectedPlan || "general enquiry"} · ${enquiry.message.slice(0, 120)}`,
        href: `/admin/leads/${stored.id}`,
        entityType: "lead",
        entityId: stored.id,
        dedupeKey: `lead-created:${stored.id}`,
      }).catch((error) => console.error("[contact] notify failed", error));
    }

    const mail = await dispatchLeadEmails({
      lead: {
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        selectedPlan: enquiry.selectedPlan,
        company: enquiry.company || undefined,
      },
      leadId: stored.id,
    });

    if (mail.error) {
      console.error("[contact] email error", mail.error);
    }

    await sendLeadReceivedWhatsApp({
      toPhone: enquiry.phone,
      clientName: enquiry.name,
      company: enquiry.company || null,
      selectedPlan: enquiry.selectedPlan || null,
      leadId: stored.id,
    }).catch((error) => console.error("[contact] whatsapp failed", error));

    return {
      ok: true,
      leadId: stored.id,
      message:
        "Got it. A Lynx engineer will reply within one business day — or message us on WhatsApp if it’s urgent.",
    };
  } catch (error) {
    console.error("[contact] unexpected", error);
    return {
      ok: false,
      message: "Something went wrong saving your inquiry. Please try again.",
    };
  }
}
