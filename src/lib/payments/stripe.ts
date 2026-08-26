import "server-only";

import Stripe from "stripe";
import { env, isStripeConfigured } from "@/lib/env";
import { getPlanBySlug } from "@/lib/plans";
import { upsertPendingTransaction } from "@/lib/supabase/admin";
import { siteConfig } from "@/lib/site";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

/** Approximate USD cents from INR list prices for international rail. */
export function planPriceUsdCents(priceInr: number): number {
  const map: Record<number, number> = {
    14999: 17900,
    34999: 41900,
    69999: 84900,
  };
  return map[priceInr] ?? Math.round((priceInr / 83) * 100);
}

export async function createStripeCheckoutSession(input: {
  planSlug: string;
  customerEmail?: string;
  customerName?: string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const plan = getPlanBySlug(input.planSlug);
  if (!plan) throw new Error("Unknown plan.");

  const amountCents = planPriceUsdCents(plan.priceInr);
  const baseUrl =
    env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url.replace(/\/$/, "");
  const invoiceNumber = `LYNX-GL-${Date.now()}`;
  const idempotencyKey = `stripe_${plan.slug}_${input.customerEmail ?? "anon"}_${amountCents}`;

  const stripe = getStripe();
  if (!stripe) {
    const mockSessionId = `cs_mock_${crypto.randomUUID().slice(0, 8)}`;
    await upsertPendingTransaction({
      provider: "stripe",
      planSlug: plan.slug,
      planName: plan.name,
      amountMinor: amountCents,
      currency: "USD",
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      providerSessionId: mockSessionId,
      idempotencyKey: `${idempotencyKey}_mock`,
      invoiceNumber,
      raw: { mocked: true },
    });
    return {
      mocked: true as const,
      url: `${baseUrl}/plans?checkout=mock&session=${mockSessionId}`,
      sessionId: mockSessionId,
      invoiceNumber,
    };
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: plan.name,
              description: `${siteConfig.name} · ${plan.blurb}`,
            },
          },
        },
      ],
      success_url:
        input.successUrl ??
        `${baseUrl}/plans?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl ?? `${baseUrl}/plans?checkout=cancel`,
      metadata: {
        plan_slug: plan.slug,
        plan_name: plan.name,
        invoice_number: invoiceNumber,
      },
    },
    { idempotencyKey },
  );

  await upsertPendingTransaction({
    provider: "stripe",
    planSlug: plan.slug,
    planName: plan.name,
    amountMinor: amountCents,
    currency: "USD",
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    providerSessionId: session.id,
    idempotencyKey,
    invoiceNumber,
    raw: { sessionId: session.id },
  });

  return {
    mocked: false as const,
    url: session.url!,
    sessionId: session.id,
    invoiceNumber,
  };
}
