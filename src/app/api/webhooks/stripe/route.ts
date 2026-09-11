import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/payments/stripe";
import { markTransactionPaid } from "@/lib/supabase/admin";
import { notifyPaymentReceived } from "@/lib/whatsapp/dispatch";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[webhooks/stripe] Stripe webhook not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.warn("[webhooks/stripe] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await markTransactionPaid({
        provider: "stripe",
        providerSessionId: session.id,
        providerPaymentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
        raw: session as unknown as Record<string, unknown>,
      });
      if ((result.updated || result.mocked) && !result.alreadyPaid) {
        const tx = result.transaction;
        const wa = await notifyPaymentReceived({
          phone: tx?.customer_phone,
          name: tx?.customer_name,
          planName: tx?.plan_name ?? "your Lynx plan",
          amountMinor: tx?.amount_minor ?? 0,
          currency: tx?.currency ?? "INR",
          invoiceNumber: tx?.invoice_number,
        });
        if (wa.error) {
          console.error("[webhooks/stripe] whatsapp error", wa.error);
        }
      }

      return NextResponse.json({
        received: true,
        updated: result.updated,
        alreadyPaid: result.alreadyPaid,
      });
    }

    return NextResponse.json({ received: true, ignored: true });
  } catch (error) {
    console.error("[webhooks/stripe]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
