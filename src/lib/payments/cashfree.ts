import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { Cashfree, CFEnvironment } from "cashfree-pg";
import { env, isCashfreeConfigured } from "@/lib/env";
import {
  getAdvanceAmountInr,
  getPlanBySlug,
} from "@/lib/plans";
import { siteConfig } from "@/lib/site";
import {
  getTransactionByOrderId,
  insertPendingTransaction,
} from "@/lib/supabase/admin";

export type CashfreeMode = "sandbox" | "production";

export function getCashfreeMode(): CashfreeMode {
  const mode = (env.CASHFREE_ENV ?? env.NEXT_PUBLIC_CASHFREE_MODE ?? "sandbox")
    .toLowerCase()
    .trim();
  return mode === "production" ? "production" : "sandbox";
}

export function getCashfreeClient(): Cashfree | null {
  if (!isCashfreeConfigured()) return null;
  const environment =
    getCashfreeMode() === "production"
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;
  const client = new Cashfree(
    environment,
    env.CASHFREE_APP_ID!,
    env.CASHFREE_SECRET_KEY!,
  );
  // Stable PG API version (unknown versions are rejected).
  client.XApiVersion = "2023-08-01";
  return client;
}

/** Cashfree webhook: HMAC-SHA256(timestamp + rawBody) → base64 */
export function verifyCashfreeWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}): boolean {
  if (!env.CASHFREE_SECRET_KEY || !input.signature || !input.timestamp) {
    return false;
  }

  // Reject stale webhooks (~5 minute window).
  const ts = Number(input.timestamp);
  if (Number.isFinite(ts)) {
    const ageMs = Date.now() - (ts > 1e12 ? ts : ts * 1000);
    if (ageMs > 5 * 60 * 1000 || ageMs < -60_000) {
      return false;
    }
  }

  const expected = createHmac("sha256", env.CASHFREE_SECRET_KEY)
    .update(input.timestamp + input.rawBody)
    .digest("base64");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(input.signature, "utf8"),
    );
  } catch {
    return false;
  }
}

function buildOrderId(planSlug: string) {
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `lynx_${planSlug}_${stamp}_${rand}`.slice(0, 50);
}

function customerIdFrom(input: {
  customerEmail?: string;
  customerPhone?: string;
}) {
  const seed =
    input.customerEmail?.toLowerCase() ||
    input.customerPhone ||
    crypto.randomUUID();
  return `cust_${Buffer.from(seed).toString("base64url").slice(0, 40)}`;
}

export async function createCashfreeOrder(input: {
  planSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}) {
  const plan = getPlanBySlug(input.planSlug);
  if (!plan) throw new Error("Unknown plan.");

  // Charge the booking advance only — not the full project fee.
  const amountInr = getAdvanceAmountInr(plan);
  const amountMinor = amountInr * 100;
  const invoiceNumber = `LYNX-ADV-${Date.now()}`;
  const orderId = buildOrderId(plan.slug);
  const idempotencyKey = `cf_adv_${orderId}`;
  const baseUrl = (
    env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url
  ).replace(/\/$/, "");
  const returnUrl = `${baseUrl}/payments/confirmation?order_id={order_id}`;
  const notifyUrl = `${baseUrl}/api/webhooks/cashfree`;

  const client = getCashfreeClient();
  if (!client) {
    if (env.NODE_ENV === "production") {
      throw new Error("Cashfree is not configured for production.");
    }
    const pending = await insertPendingTransaction({
      provider: "cashfree",
      planSlug: plan.slug,
      planName: plan.name,
      amountMinor,
      currency: "INR",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      providerOrderId: orderId,
      idempotencyKey: `${idempotencyKey}_mock`,
      invoiceNumber,
      raw: {
        mocked: true,
        paymentType: "advance",
        advancePercent: plan.advancePercent,
        fullProjectInr: plan.priceInr,
      },
    });
    if (!pending.id) {
      throw new Error(pending.error || "Failed to record mock transaction.");
    }
    return {
      mocked: true as const,
      orderId,
      paymentSessionId: `session_mock_${crypto.randomUUID().slice(0, 8)}`,
      amount: amountInr,
      currency: "INR" as const,
      planName: plan.name,
      invoiceNumber,
      mode: getCashfreeMode(),
      advancePercent: plan.advancePercent,
      fullProjectInr: plan.priceInr,
    };
  }

  let response;
  try {
    response = await client.PGCreateOrder({
      order_id: orderId,
      order_amount: amountInr,
      order_currency: "INR",
      order_note: `Advance ${plan.advancePercent}% · ${plan.slug} · ${invoiceNumber}`.slice(
        0,
        100,
      ),
      customer_details: {
        customer_id: customerIdFrom(input),
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
    });
  } catch (error) {
    const detail =
      error && typeof error === "object" && "response" in error
        ? JSON.stringify(
            (error as { response?: { data?: unknown } }).response?.data ??
              error,
          )
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("[cashfree] PGCreateOrder failed", detail);
    throw new Error("Cashfree could not create the advance payment order.");
  }

  const data = response.data;
  const paymentSessionId = data.payment_session_id;
  if (!paymentSessionId) {
    throw new Error("Cashfree did not return a payment_session_id.");
  }

  const pending = await insertPendingTransaction({
    provider: "cashfree",
    planSlug: plan.slug,
    planName: plan.name,
    amountMinor,
    currency: "INR",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    providerOrderId: data.order_id ?? orderId,
    providerSessionId: paymentSessionId,
    idempotencyKey,
    invoiceNumber,
    raw: {
      order: data as unknown as Record<string, unknown>,
      paymentType: "advance",
      advancePercent: plan.advancePercent,
      fullProjectInr: plan.priceInr,
    },
  });

  // Never block Cashfree checkout on bookkeeping failures — customer can still pay.
  // Webhook/verify will reconcile when Supabase is available.
  if (!pending.id) {
    console.error("[cashfree] pending tx insert failed — continuing checkout", {
      error: pending.error,
      orderId: data.order_id ?? orderId,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  return {
    mocked: false as const,
    orderId: data.order_id ?? orderId,
    paymentSessionId,
    amount: amountInr,
    currency: "INR" as const,
    planName: plan.name,
    invoiceNumber,
    mode: getCashfreeMode(),
    advancePercent: plan.advancePercent,
    fullProjectInr: plan.priceInr,
  };
}

export type QuoteOrderInput = {
  quoteId: string;
  quoteNumber: string;
  title: string;
  amountMinor: number;
  organizationId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

/**
 * Cashfree order for the advance on a specific quotation.
 * Unlike plan checkout the amount comes from the quote row, and the resulting
 * transaction is linked back to the quote so the webhook can accept it.
 */
export async function createQuoteAdvanceOrder(input: QuoteOrderInput) {
  if (input.amountMinor <= 0) {
    throw new Error("This quotation has no advance amount to collect.");
  }

  const amountInr = Math.round(input.amountMinor) / 100;
  const invoiceNumber = `LYNX-ADV-${input.quoteNumber}-${Date.now().toString(36).toUpperCase()}`;
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const orderId = `lynxq_${stamp}_${rand}`.slice(0, 50);
  const baseUrl = (env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url).replace(/\/$/, "");
  const returnUrl = `${baseUrl}/payments/confirmation?order_id={order_id}`;
  const notifyUrl = `${baseUrl}/api/webhooks/cashfree`;

  const client = getCashfreeClient();
  if (!client) {
    throw new Error("Cashfree is not configured — cannot collect payment.");
  }

  let response;
  try {
    response = await client.PGCreateOrder({
      order_id: orderId,
      order_amount: amountInr,
      order_currency: "INR",
      order_note: `Advance · ${input.quoteNumber}`.slice(0, 100),
      customer_details: {
        customer_id: customerIdFrom(input),
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: { return_url: returnUrl, notify_url: notifyUrl },
    });
  } catch (error) {
    const detail =
      error && typeof error === "object" && "response" in error
        ? JSON.stringify(
            (error as { response?: { data?: unknown } }).response?.data ?? error,
          )
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("[cashfree] quote PGCreateOrder failed", detail);
    throw new Error("Cashfree could not create the advance payment order.");
  }

  const data = response.data;
  const paymentSessionId = data.payment_session_id;
  if (!paymentSessionId) {
    throw new Error("Cashfree did not return a payment_session_id.");
  }

  const pending = await insertPendingTransaction({
    provider: "cashfree",
    planSlug: "quote-advance",
    planName: `${input.quoteNumber} — ${input.title}`.slice(0, 120),
    amountMinor: Math.round(input.amountMinor),
    currency: "INR",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    providerOrderId: data.order_id ?? orderId,
    providerSessionId: paymentSessionId,
    idempotencyKey: `cf_quote_${orderId}`,
    invoiceNumber,
    quoteId: input.quoteId,
    organizationId: input.organizationId ?? null,
    raw: {
      paymentType: "quote-advance",
      quoteId: input.quoteId,
      quoteNumber: input.quoteNumber,
      order: data as unknown as Record<string, unknown>,
    },
  });

  if (!pending.id) {
    console.error("[cashfree] quote pending tx insert failed", pending.error);
  }

  return {
    orderId: data.order_id ?? orderId,
    paymentSessionId,
    amount: amountInr,
    currency: "INR" as const,
    invoiceNumber,
    mode: getCashfreeMode(),
  };
}

export type InvoiceOrderInput = {
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  organizationId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

/** Cashfree order settling the outstanding balance on an invoice. */
export async function createInvoiceOrder(input: InvoiceOrderInput) {
  if (input.amountMinor <= 0) {
    throw new Error("This invoice has nothing outstanding.");
  }

  const amountInr = Math.round(input.amountMinor) / 100;
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const orderId = `lynxi_${stamp}_${rand}`.slice(0, 50);
  const baseUrl = (env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url).replace(/\/$/, "");

  const client = getCashfreeClient();
  if (!client) {
    throw new Error("Cashfree is not configured — cannot collect payment.");
  }

  let response;
  try {
    response = await client.PGCreateOrder({
      order_id: orderId,
      order_amount: amountInr,
      order_currency: "INR",
      order_note: `Invoice ${input.invoiceNumber}`.slice(0, 100),
      customer_details: {
        customer_id: customerIdFrom(input),
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: {
        return_url: `${baseUrl}/payments/confirmation?order_id={order_id}`,
        notify_url: `${baseUrl}/api/webhooks/cashfree`,
      },
    });
  } catch (error) {
    console.error("[cashfree] invoice PGCreateOrder failed", error);
    throw new Error("Cashfree could not create the payment order.");
  }

  const data = response.data;
  const paymentSessionId = data.payment_session_id;
  if (!paymentSessionId) {
    throw new Error("Cashfree did not return a payment_session_id.");
  }

  const pending = await insertPendingTransaction({
    provider: "cashfree",
    planSlug: "invoice",
    planName: `Invoice ${input.invoiceNumber}`,
    amountMinor: Math.round(input.amountMinor),
    currency: "INR",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    providerOrderId: data.order_id ?? orderId,
    providerSessionId: paymentSessionId,
    idempotencyKey: `cf_inv_${orderId}`,
    invoiceNumber: input.invoiceNumber,
    invoiceId: input.invoiceId,
    organizationId: input.organizationId,
    raw: {
      paymentType: "invoice",
      invoiceId: input.invoiceId,
      order: data as unknown as Record<string, unknown>,
    },
  });

  if (!pending.id) {
    console.error("[cashfree] invoice pending tx insert failed", pending.error);
  }

  return {
    orderId: data.order_id ?? orderId,
    paymentSessionId,
    amount: amountInr,
    currency: "INR" as const,
    mode: getCashfreeMode(),
  };
}

export async function fetchCashfreeOrderStatus(orderId: string) {
  const client = getCashfreeClient();
  if (!client) {
    return {
      mocked: true as const,
      orderId,
      orderStatus: "ACTIVE" as string,
      paymentStatus: null as string | null,
      paymentId: null as string | null,
      paymentAmount: null as number | null,
      paid: false,
    };
  }

  const orderRes = await client.PGFetchOrder(orderId);
  const order = orderRes.data;
  const orderStatus = String(order.order_status ?? "");

  let paymentStatus: string | null = null;
  let paymentId: string | null = null;
  let paymentAmount: number | null = null;

  try {
    const paymentsRes = await client.PGOrderFetchPayments(orderId);
    const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
    const success = payments.find(
      (p) => String(p.payment_status ?? "").toUpperCase() === "SUCCESS",
    );
    const pick = success ?? payments[0];
    if (pick) {
      paymentStatus = pick.payment_status ? String(pick.payment_status) : null;
      paymentId = pick.cf_payment_id != null ? String(pick.cf_payment_id) : null;
      paymentAmount =
        typeof pick.payment_amount === "number" ? pick.payment_amount : null;
    }
  } catch {
    // Order status alone is enough for a soft return-page check.
  }

  const paid =
    orderStatus.toUpperCase() === "PAID" ||
    paymentStatus?.toUpperCase() === "SUCCESS";

  return {
    mocked: false as const,
    orderId,
    orderStatus,
    paymentStatus,
    paymentId,
    paymentAmount,
    paid,
  };
}

export async function assertAdvanceAmountMatches(input: {
  orderId: string;
  paymentAmountInr?: number | null;
}) {
  const tx = await getTransactionByOrderId({
    provider: "cashfree",
    providerOrderId: input.orderId,
  });
  if (!tx) return { ok: false as const, reason: "transaction_not_found" as const };
  if (input.paymentAmountInr == null) {
    return { ok: true as const, transaction: tx };
  }
  const expected = tx.amount_minor / 100;
  if (Math.abs(expected - input.paymentAmountInr) > 0.01) {
    return {
      ok: false as const,
      reason: "amount_mismatch" as const,
      expected,
      received: input.paymentAmountInr,
      transaction: tx,
    };
  }
  return { ok: true as const, transaction: tx };
}
