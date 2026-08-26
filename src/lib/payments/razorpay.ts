import "server-only";

import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { env, isRazorpayConfigured } from "@/lib/env";
import { getPlanBySlug } from "@/lib/plans";
import { upsertPendingTransaction } from "@/lib/supabase/admin";

export function getRazorpayClient() {
  if (!isRazorpayConfigured()) return null;
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID!,
    key_secret: env.RAZORPAY_KEY_SECRET!,
  });
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(input.signature, "utf8"),
    );
  } catch {
    return false;
  }
}

export async function createRazorpayOrder(input: {
  planSlug: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}) {
  const plan = getPlanBySlug(input.planSlug);
  if (!plan) throw new Error("Unknown plan.");

  const amountPaise = plan.priceInr * 100;
  const invoiceNumber = `LYNX-IN-${Date.now()}`;
  const idempotencyKey = `rzp_${plan.slug}_${input.customerEmail ?? "anon"}_${amountPaise}`;

  const client = getRazorpayClient();
  if (!client) {
    const mockOrderId = `order_mock_${crypto.randomUUID().slice(0, 8)}`;
    await upsertPendingTransaction({
      provider: "razorpay",
      planSlug: plan.slug,
      planName: plan.name,
      amountMinor: amountPaise,
      currency: "INR",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      providerOrderId: mockOrderId,
      idempotencyKey: `${idempotencyKey}_mock`,
      invoiceNumber,
      raw: { mocked: true },
    });
    return {
      mocked: true as const,
      orderId: mockOrderId,
      amount: amountPaise,
      currency: "INR",
      keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "rzp_test_mock",
      planName: plan.name,
      invoiceNumber,
    };
  }

  const order = await client.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: invoiceNumber,
    notes: {
      plan_slug: plan.slug,
      plan_name: plan.name,
    },
  });

  await upsertPendingTransaction({
    provider: "razorpay",
    planSlug: plan.slug,
    planName: plan.name,
    amountMinor: amountPaise,
    currency: "INR",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    providerOrderId: order.id,
    idempotencyKey,
    invoiceNumber,
    raw: { order },
  });

  return {
    mocked: false as const,
    orderId: order.id,
    amount: amountPaise,
    currency: "INR",
    keyId: env.RAZORPAY_KEY_ID!,
    planName: plan.name,
    invoiceNumber,
  };
}
