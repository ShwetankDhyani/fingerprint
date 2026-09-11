import { NextResponse } from "next/server";
import {
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/razorpay";
import { markTransactionPaid } from "@/lib/supabase/admin";
import { notifyPaymentReceived } from "@/lib/whatsapp/dispatch";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.warn("[webhooks/razorpay] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
        order?: { entity?: { id?: string } };
      };
    };

    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    const orderId =
      payment?.order_id || payload.payload?.order?.entity?.id || undefined;

    if (
      event === "payment.captured" ||
      event === "order.paid" ||
      payment?.status === "captured"
    ) {
      const result = await markTransactionPaid({
        provider: "razorpay",
        providerOrderId: orderId,
        providerPaymentId: payment?.id,
        raw: payload as unknown as Record<string, unknown>,
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
          console.error("[webhooks/razorpay] whatsapp error", wa.error);
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
    console.error("[webhooks/razorpay]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
