import { siteConfig } from "@/lib/site";

function moneyLabel(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency.toUpperCase()} ${major.toFixed(2)}`;
  }
}

export function leadReceivedMessage(input: {
  name: string;
  company: string;
  selectedPlan?: string | null;
}): string {
  const plan = input.selectedPlan
    ? `\nPlan interest: ${input.selectedPlan}`
    : "";
  return [
    `Hi ${input.name}, thanks for reaching out to ${siteConfig.name}.`,
    `We received your inquiry for ${input.company}.${plan}`,
    "",
    "A Lynx engineer will reply within one business day with fit, timing, and a first milestone.",
    `Questions sooner? Call ${siteConfig.phones[0]} or reply here.`,
  ].join("\n");
}

export function paymentReceivedMessage(input: {
  name?: string | null;
  planName: string;
  amountMinor: number;
  currency: string;
  invoiceNumber?: string | null;
}): string {
  const who = input.name?.trim() ? input.name.trim() : "there";
  const invoice = input.invoiceNumber
    ? `\nInvoice / order: ${input.invoiceNumber}`
    : "";
  return [
    `Hi ${who}, payment confirmed.`,
    `${siteConfig.name} received ${moneyLabel(input.amountMinor, input.currency)} for ${input.planName}.${invoice}`,
    "",
    "Thank you — we will follow up with next steps shortly.",
    `Support: ${siteConfig.email} · ${siteConfig.phones[0]}`,
  ].join("\n");
}

export function quotationSentMessage(input: {
  name?: string | null;
  documentNumber: string;
  amountLabel: string;
  link: string;
}): string {
  const who = input.name?.trim() ? input.name.trim() : "there";
  return [
    `Hi ${who}, your quotation from ${siteConfig.name} is ready.`,
    `Quote: ${input.documentNumber} · ${input.amountLabel}`,
    "",
    `View & download: ${input.link}`,
    "",
    "Reply on WhatsApp if you have questions or want to proceed.",
  ].join("\n");
}

export function invoiceSentMessage(input: {
  name?: string | null;
  documentNumber: string;
  amountLabel: string;
  link: string;
}): string {
  const who = input.name?.trim() ? input.name.trim() : "there";
  return [
    `Hi ${who}, your invoice from ${siteConfig.name} is ready.`,
    `Invoice: ${input.documentNumber} · ${input.amountLabel}`,
    "",
    `View & pay details: ${input.link}`,
    "",
    `Questions? ${siteConfig.email}`,
  ].join("\n");
}
