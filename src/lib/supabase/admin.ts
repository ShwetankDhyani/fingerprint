import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

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
  phone: string | null;
  meta: Record<string, unknown>;
};

export type TransactionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  provider: "razorpay" | "stripe";
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
  raw: Record<string, unknown>;
};

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(
      env.SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
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
  phone?: string;
  source?: string;
  meta?: Record<string, unknown>;
}): Promise<{ id: string | null; mocked: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    console.info("[leads] Supabase not configured — lead stored in logs only", {
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
      phone: input.phone ?? null,
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

export async function upsertPendingTransaction(input: {
  provider: "razorpay" | "stripe";
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
  raw?: Record<string, unknown>;
}): Promise<{ id: string | null; mocked: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) {
    console.info("[transactions] Supabase not configured — pending tx logged", {
      provider: input.provider,
      planSlug: input.planSlug,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });
    return { id: `mock_${crypto.randomUUID()}`, mocked: true };
  }

  const { data, error } = await client
    .from("transactions")
    .upsert(
      {
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
        raw: input.raw ?? {},
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("[transactions] upsert failed", error.message);
    return { id: null, mocked: false, error: error.message };
  }

  return { id: data.id as string, mocked: false };
}

export async function markTransactionPaid(input: {
  provider: "razorpay" | "stripe";
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSessionId?: string;
  raw?: Record<string, unknown>;
}): Promise<{
  updated: boolean;
  alreadyPaid: boolean;
  mocked: boolean;
  transaction?: TransactionRow | null;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    console.info("[transactions] mark paid (mock)", input);
    return { updated: true, alreadyPaid: false, mocked: true, transaction: null };
  }

  const selectCols =
    "id, created_at, updated_at, provider, status, plan_slug, plan_name, amount_minor, currency, customer_name, customer_email, customer_phone, invoice_number, provider_order_id, provider_payment_id, provider_session_id, idempotency_key, lead_id, raw";

  let query = client.from("transactions").select(selectCols).eq("provider", input.provider);

  if (input.providerPaymentId) {
    query = query.eq("provider_payment_id", input.providerPaymentId);
  } else if (input.providerOrderId) {
    query = query.eq("provider_order_id", input.providerOrderId);
  } else if (input.providerSessionId) {
    query = query.eq("provider_session_id", input.providerSessionId);
  } else {
    return { updated: false, alreadyPaid: false, mocked: false, transaction: null };
  }

  const { data: existing } = await query.maybeSingle();

  if (existing?.status === "paid") {
    return {
      updated: false,
      alreadyPaid: true,
      mocked: false,
      transaction: existing as TransactionRow,
    };
  }

  const patch: Record<string, unknown> = {
    status: "paid",
    raw: input.raw ?? {},
  };
  if (input.providerPaymentId) patch.provider_payment_id = input.providerPaymentId;
  if (input.providerOrderId) patch.provider_order_id = input.providerOrderId;
  if (input.providerSessionId) patch.provider_session_id = input.providerSessionId;

  let update = client
    .from("transactions")
    .update(patch)
    .eq("provider", input.provider)
    .select(selectCols);
  if (existing?.id) {
    update = update.eq("id", existing.id);
  } else if (input.providerOrderId) {
    update = update.eq("provider_order_id", input.providerOrderId);
  } else if (input.providerSessionId) {
    update = update.eq("provider_session_id", input.providerSessionId);
  }

  const { data: updatedRow, error } = await update.maybeSingle();
  if (error) {
    console.error("[transactions] mark paid failed", error.message);
    return { updated: false, alreadyPaid: false, mocked: false, transaction: null };
  }

  return {
    updated: true,
    alreadyPaid: false,
    mocked: false,
    transaction: (updatedRow as TransactionRow | null) ?? null,
  };
}
