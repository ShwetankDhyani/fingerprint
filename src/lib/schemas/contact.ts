import { z } from "zod";

import { isValidInternationalPhone } from "@/lib/phone";

/** Kept for admin filters / legacy lead rows — not required on the public form. */
export const budgetTiers = [
  { value: "plan-starter", label: "Plan: Starter (₹14,999)" },
  { value: "plan-growth", label: "Plan: Growth (₹34,999)" },
  { value: "plan-premium", label: "Plan: Premium (₹69,999)" },
  { value: "under-25k", label: "Under ₹25,000" },
  { value: "25k-50k", label: "₹25,000 – ₹50,000" },
  { value: "50k-1l", label: "₹50,000 – ₹1,00,000" },
  { value: "1l-plus", label: "₹1,00,000+" },
  { value: "not-sure", label: "Not sure yet" },
] as const;

export const projectTypes = [
  { value: "plan-booking", label: "Book a website plan" },
  { value: "marketing-site", label: "Marketing / product website" },
  { value: "saas", label: "Custom SaaS / web app" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "seo", label: "SEO / growth architecture" },
  { value: "addon", label: "Add-on / retainer" },
  { value: "other", label: "Something else" },
] as const;

export const timelines = [
  { value: "asap", label: "ASAP / already late" },
  { value: "1-3-months", label: "1–3 months" },
  { value: "3-6-months", label: "3–6 months" },
  { value: "exploring", label: "Exploring / planning" },
] as const;

/**
 * Public enquiry — short on purpose so cold traffic can start a conversation.
 * Optional plan context may arrive from /contact?plan=… as a hidden field.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters."),
  email: z.string().trim().email("Enter a valid work email."),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .refine(
      (value) => isValidInternationalPhone(value),
      "Enter a valid mobile number with country code.",
    ),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little about what you need (a sentence is enough).")
    .max(2000, "Keep it under 2000 characters."),
  selectedPlan: z.string().optional(),
  company: z.string().trim().max(160).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
