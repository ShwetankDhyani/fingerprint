"use server";

import { headers } from "next/headers";
import { dispatchLeadEmails } from "@/lib/email/dispatch";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { contactSchema, type ContactInput } from "@/lib/schemas/contact";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";
import { insertLead } from "@/lib/supabase/admin";
import { notifyLeadReceived } from "@/lib/whatsapp/dispatch";

export type ContactActionState = {
  ok: boolean;
  message: string;
  leadId?: string;
  errors?: Partial<Record<keyof ContactInput, string>>;
};

function sanitizeLead(raw: ContactInput): ContactInput {
  return {
    name: sanitizeText(raw.name, 120),
    email: sanitizeEmail(raw.email),
    phone: sanitizeText(raw.phone, 20),
    company: sanitizeText(raw.company, 160),
    projectType: sanitizeText(raw.projectType, 80),
    budget: sanitizeText(raw.budget, 80),
    timeline: sanitizeText(raw.timeline, 80),
    selectedPlan: raw.selectedPlan
      ? sanitizeText(raw.selectedPlan, 160)
      : undefined,
    scope: sanitizeText(raw.scope, 4000),
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
    company: String(formData.get("company") ?? ""),
    projectType: String(formData.get("projectType") ?? ""),
    budget: String(formData.get("budget") ?? ""),
    timeline: String(formData.get("timeline") ?? ""),
    selectedPlan: String(formData.get("selectedPlan") ?? "") || undefined,
    scope: String(formData.get("scope") ?? ""),
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

  const lead = sanitizeLead(parsed.data);

  try {
    const stored = await insertLead({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      projectType: lead.projectType,
      budget: lead.budget,
      timeline: lead.timeline,
      selectedPlan: lead.selectedPlan,
      scope: lead.scope,
      source: "contact_form",
      meta: { ip },
    });

    if (stored.error) {
      console.error("[contact] lead persist error", stored.error);
    }

    const mail = await dispatchLeadEmails({
      lead,
      leadId: stored.id,
    });

    if (mail.error) {
      console.error("[contact] email error", mail.error);
    }

    const wa = await notifyLeadReceived({
      phone: lead.phone,
      name: lead.name,
      company: lead.company,
      selectedPlan: lead.selectedPlan,
    });
    if (wa.error) {
      console.error("[contact] whatsapp error", wa.error);
    }

    return {
      ok: true,
      leadId: stored.id ?? undefined,
      message:
        "Got it. A Lynx engineer will reply within one business day with fit, timing, and a first milestone.",
    };
  } catch (error) {
    console.error("[contact] unexpected", error);
    return {
      ok: false,
      message: "Something went wrong saving your inquiry. Please try again.",
    };
  }
}
