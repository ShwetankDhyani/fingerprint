import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  company: string;
  project_type: string;
  budget: string;
  timeline: string;
  selected_plan: string | null;
  scope: string;
  status: "new" | "contacted" | "converted" | "archived";
  source: string;
  meta: Record<string, unknown>;
};

export type TransactionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  provider: "cashfree";
  status: "pending" | "paid" | "failed" | "refunded";
  plan_slug: string;
  plan_name: string;
  amount_minor: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  invoice_number: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  provider_session_id: string | null;
  idempotency_key: string | null;
  lead_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  organization_id: string | null;
  raw: Record<string, unknown>;
};

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export async function insertLead(input: {
  name: string;
  email: string;
  company: string;
  projectType: string;
  budget: string;
  timeline: string;
  selectedPlan?: string;
  scope: string;
  source?: string;
  meta?: Record<string, unknown>;
}): Promise<{ id: string | null; mocked: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    if (env.NODE_ENV === "production") {
      return { id: null, mocked: false, error: "Database not configured." };
    }
    console.info("[leads] Supabase not configured — lead logged only", {
      email: input.email,
      company: input.company,
      selectedPlan: input.selectedPlan,
    });
    return { id: `mock_${crypto.randomUUID()}`, mocked: true };
  }

  const { data, error } = await client
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      company: input.company,
      project_type: input.projectType,
      budget: input.budget,
      timeline: input.timeline,
      selected_plan: input.selectedPlan ?? null,
      scope: input.scope,
      status: "new",
      source: input.source ?? "contact_form",
      meta: input.meta ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[leads] insert failed", error.message);
    return { id: null, mocked: false, error: error.message };
  }

  return { id: data.id as string, mocked: false };
}

/** Insert-only pending transaction — never overwrites a paid row. */
export async function insertPendingTransaction(input: {
  provider: "cashfree";
  planSlug: string;
  planName: string;
  amountMinor: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  providerOrderId?: string;
  providerSessionId?: string;
  idempotencyKey: string;
  invoiceNumber: string;
  quoteId?: string | null;
  invoiceId?: string | null;
  organizationId?: string | null;
  raw?: Record<string, unknown>;
}): Promise<{ id: string | null; mocked: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    if (env.NODE_ENV === "production") {
      return { id: null, mocked: false, error: "Database not configured." };
    }
    console.info("[transactions] Supabase not configured — pending tx logged", {
      provider: input.provider,
      planSlug: input.planSlug,
      amountMinor: input.amountMinor,
    });
    return { id: `mock_${crypto.randomUUID()}`, mocked: true };
  }

  const { data, error } = await client
    .from("transactions")
    .insert({
      provider: input.provider,
      status: "pending",
      plan_slug: input.planSlug,
      plan_name: input.planName,
      amount_minor: input.amountMinor,
      currency: input.currency,
      customer_name: input.customerName ?? null,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      provider_order_id: input.providerOrderId ?? null,
      provider_session_id: input.providerSessionId ?? null,
      idempotency_key: input.idempotencyKey,
      invoice_number: input.invoiceNumber,
      quote_id: input.quoteId ?? null,
      invoice_id: input.invoiceId ?? null,
      organization_id: input.organizationId ?? null,
      raw: input.raw ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[transactions] insert failed", error.message);
    return { id: null, mocked: false, error: error.message };
  }

  return { id: data.id as string, mocked: false };
}

export async function getTransactionByOrderId(input: {
  provider: "cashfree";
  providerOrderId: string;
}): Promise<TransactionRow | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from("transactions")
    .select("*")
    .eq("provider", input.provider)
    .eq("provider_order_id", input.providerOrderId)
    .maybeSingle();

  if (error) {
    console.error("[transactions] fetch by order failed", error.message);
    return null;
  }

  return (data as TransactionRow | null) ?? null;
}

export async function markTransactionPaid(input: {
  provider: "cashfree";
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSessionId?: string;
  expectedAmountMinor?: number;
  raw?: Record<string, unknown>;
}): Promise<{
  updated: boolean;
  alreadyPaid: boolean;
  mocked: boolean;
  error?: string;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    if (env.NODE_ENV === "production") {
      return {
        updated: false,
        alreadyPaid: false,
        mocked: false,
        error: "Database not configured.",
      };
    }
    console.info("[transactions] mark paid (mock)", input);
    return { updated: true, alreadyPaid: false, mocked: true };
  }

  // Prefer order id — payment id is usually unset on pending rows.
  let query = client
    .from("transactions")
    .select("id, status, amount_minor")
    .eq("provider", input.provider);

  if (input.providerOrderId) {
    query = query.eq("provider_order_id", input.providerOrderId);
  } else if (input.providerPaymentId) {
    query = query.eq("provider_payment_id", input.providerPaymentId);
  } else if (input.providerSessionId) {
    query = query.eq("provider_session_id", input.providerSessionId);
  } else {
    return { updated: false, alreadyPaid: false, mocked: false };
  }

  const { data: existing } = await query.maybeSingle();

  if (!existing) {
    return {
      updated: false,
      alreadyPaid: false,
      mocked: false,
      error: "transaction_not_found",
    };
  }

  if (existing.status === "paid") {
    return { updated: false, alreadyPaid: true, mocked: false };
  }

  if (
    typeof input.expectedAmountMinor === "number" &&
    existing.amount_minor !== input.expectedAmountMinor
  ) {
    console.warn("[transactions] amount mismatch", {
      expected: existing.amount_minor,
      received: input.expectedAmountMinor,
      id: existing.id,
    });
    return {
      updated: false,
      alreadyPaid: false,
      mocked: false,
      error: "amount_mismatch",
    };
  }

  // Re-fetch full row so we can merge raw without wiping advance metadata.
  const { data: fullRow } = await client
    .from("transactions")
    .select("*")
    .eq("id", existing.id)
    .maybeSingle();

  const previousRaw =
    fullRow && typeof fullRow.raw === "object" && fullRow.raw
      ? (fullRow.raw as Record<string, unknown>)
      : {};

  const patch: Record<string, unknown> = {
    status: "paid",
    raw: {
      ...previousRaw,
      ...(input.raw ?? {}),
      paidAt: new Date().toISOString(),
    },
  };
  if (input.providerPaymentId) patch.provider_payment_id = input.providerPaymentId;
  if (input.providerOrderId) patch.provider_order_id = input.providerOrderId;
  if (input.providerSessionId) patch.provider_session_id = input.providerSessionId;

  const { data: updated, error } = await client
    .from("transactions")
    .update(patch)
    .eq("id", existing.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[transactions] mark paid failed", error.message);
    return { updated: false, alreadyPaid: false, mocked: false, error: error.message };
  }

  if (!updated) {
    return { updated: false, alreadyPaid: false, mocked: false, error: "no_rows_updated" };
  }

  return { updated: true, alreadyPaid: false, mocked: false };
}
