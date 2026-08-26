import { siteConfig } from "@/lib/site";

const DEFAULT_WHATSAPP = siteConfig.whatsappE164;

export function getWhatsAppNumber(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return fromEnv && fromEnv.length >= 8 ? fromEnv : DEFAULT_WHATSAPP;
}

export function buildWhatsAppUrl(message: string): string {
  const phone = getWhatsAppNumber();
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function defaultWhatsAppMessage(context?: string): string {
  if (context) {
    return `Hi Lynx team, I'm interested in discussing ${context}.`;
  }
  return "Hi Lynx team, I'm interested in discussing a custom web development project.";
}

export function leadWhatsAppMessage(input: {
  name: string;
  company: string;
  projectType: string;
  budget: string;
  timeline: string;
  selectedPlan?: string;
  scope: string;
}): string {
  const planLine = input.selectedPlan
    ? `\nPlan: ${input.selectedPlan}`
    : "";
  return [
    `Hi Lynx team — new brief from ${input.name} (${input.company}).`,
    `Type: ${input.projectType}`,
    `Budget: ${input.budget}`,
    `Timeline: ${input.timeline}${planLine}`,
    "",
    "Scope:",
    input.scope.slice(0, 900),
  ].join("\n");
}
