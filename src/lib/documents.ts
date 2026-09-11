import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { env, isSupabaseConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/normalize";

export type BusinessDocumentType = "quotation" | "invoice";

export type BusinessDocument = {
  id: string;
  type: BusinessDocumentType;
  number: string;
  publicToken: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  company?: string | null;
  amountMinor: number;
  currency: string;
  summary: string;
  createdAt: string;
};

const LOCAL_DOCS_PATH = path.join(process.cwd(), ".data", "documents.json");

function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL || siteConfig.url;
}

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

async function readLocalDocs(): Promise<BusinessDocument[]> {
  try {
    const text = await fs.readFile(LOCAL_DOCS_PATH, "utf8");
    return JSON.parse(text) as BusinessDocument[];
  } catch {
    return [];
  }
}

async function writeLocalDocs(docs: BusinessDocument[]): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_DOCS_PATH), { recursive: true });
  await fs.writeFile(
    LOCAL_DOCS_PATH,
    `${JSON.stringify(docs, null, 2)}\n`,
    "utf8",
  );
}

function prefixFor(type: BusinessDocumentType): string {
  return type === "quotation" ? "QT" : "INV";
}

export function documentPublicUrl(publicToken: string): string {
  return `${siteUrl().replace(/\/$/, "")}/docs/${publicToken}`;
}

export function documentAmountLabel(doc: BusinessDocument): string {
  return moneyLabel(doc.amountMinor, doc.currency);
}

export async function createBusinessDocument(input: {
  type: BusinessDocumentType;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  company?: string;
  amountMinor: number;
  currency: string;
  summary: string;
}): Promise<{ document: BusinessDocument; mocked: boolean; error?: string }> {
  const phone = normalizeWhatsAppPhone(input.customerPhone);
  if (!phone) {
    return {
      document: null as never,
      mocked: false,
      error: "A valid WhatsApp / mobile number is required.",
    };
  }

  const id = crypto.randomUUID();
  const publicToken = crypto.randomUUID().replace(/-/g, "");
  const createdAt = new Date().toISOString();
  const stamp = createdAt.slice(0, 10).replace(/-/g, "");
  const number = `${prefixFor(input.type)}-${stamp}-${id.slice(0, 4).toUpperCase()}`;

  const document: BusinessDocument = {
    id,
    type: input.type,
    number,
    publicToken,
    customerName: input.customerName.trim(),
    customerPhone: phone,
    customerEmail: input.customerEmail?.trim() || null,
    company: input.company?.trim() || null,
    amountMinor: input.amountMinor,
    currency: input.currency.toUpperCase(),
    summary: input.summary.trim(),
    createdAt,
  };

  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    if (client) {
      const { error } = await client.from("documents").insert({
        id: document.id,
        type: document.type,
        number: document.number,
        public_token: document.publicToken,
        customer_name: document.customerName,
        customer_phone: document.customerPhone,
        customer_email: document.customerEmail,
        company: document.company,
        amount_minor: document.amountMinor,
        currency: document.currency,
        summary: document.summary,
        created_at: document.createdAt,
      });
      if (error) {
        console.error("[documents] insert failed", error.message);
        return { document, mocked: false, error: error.message };
      }
      return { document, mocked: false };
    }
  }

  const existing = await readLocalDocs();
  existing.unshift(document);
  await writeLocalDocs(existing.slice(0, 200));
  return { document, mocked: true };
}

export async function getBusinessDocumentByToken(
  token: string,
): Promise<BusinessDocument | null> {
  if (!token) return null;

  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    if (client) {
      const { data, error } = await client
        .from("documents")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();
      if (!error && data) {
        return {
          id: data.id as string,
          type: data.type as BusinessDocumentType,
          number: data.number as string,
          publicToken: data.public_token as string,
          customerName: data.customer_name as string,
          customerPhone: data.customer_phone as string,
          customerEmail: (data.customer_email as string | null) ?? null,
          company: (data.company as string | null) ?? null,
          amountMinor: data.amount_minor as number,
          currency: data.currency as string,
          summary: data.summary as string,
          createdAt: data.created_at as string,
        };
      }
    }
  }

  const local = await readLocalDocs();
  return local.find((doc) => doc.publicToken === token) ?? null;
}
