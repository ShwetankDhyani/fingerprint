import { NextResponse } from "next/server";
import {
  assertAdvanceAmountMatches,
  verifyCashfreeWebhookSignature,
} from "@/lib/payments/cashfree";
import { markTransactionPaid } from "@/lib/supabase/admin";
import {
  isInvoiceTransaction,
  isQuoteTransaction,
  settleInvoicePayment,
  settlePlanAdvance,
  settleQuoteAdvance,
} from "@/lib/payments/settlement";

type CashfreeWebhookPayload = {
  type?: string;
  data?: {
    order?: {
      order_id?: string;
      order_status?: string;
      order_amount?: number;
    };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
    };
  };
};

const PAID_EVENTS = new Set([
  "PAYMENT_SUCCESS_WEBHOOK",
  "PAYMENT_SUCCESS",
  "ORDER_PAID",
]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (
    !verifyCashfreeWebhookSignature({
      rawBody,
      signature,
      timestamp,
    })
  ) {
    console.warn("[webhooks/cashfree] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody) as CashfreeWebhookPayload;
    const eventType = String(payload.type ?? "").toUpperCase();
    const orderId = payload.data?.order?.order_id;
    const payment = payload.data?.payment;
    const paymentStatus = String(payment?.payment_status ?? "").toUpperCase();
    const orderStatus = String(
      payload.data?.order?.order_status ?? "",
    ).toUpperCase();
    const paymentAmount =
      typeof payment?.payment_amount === "number"
        ? payment.payment_amount
        : typeof payload.data?.order?.order_amount === "number"
          ? payload.data.order.order_amount
          : null;

    const shouldMarkPaid =
      PAID_EVENTS.has(eventType) ||
      paymentStatus === "SUCCESS" ||
      orderStatus === "PAID";

    if (shouldMarkPaid && orderId) {
      const amountCheck = await assertAdvanceAmountMatches({
        orderId,
        paymentAmountInr: paymentAmount,
      });

      if (!amountCheck.ok) {
        console.warn("[webhooks/cashfree] amount/tx check failed", amountCheck);
        return NextResponse.json(
          { received: true, updated: false, reason: amountCheck.reason },
          { status: 200 },
        );
      }

      const expectedMinor = amountCheck.transaction.amount_minor;
      const result = await markTransactionPaid({
        provider: "cashfree",
        providerOrderId: orderId,
        providerPaymentId:
          payment?.cf_payment_id != null
            ? String(payment.cf_payment_id)
            : undefined,
        expectedAmountMinor: expectedMinor,
        raw: payload as unknown as Record<string, unknown>,
      });

      // Settle on first mark-paid and on alreadyPaid retries (idempotent).
      if (result.updated || result.alreadyPaid) {
        const tx = amountCheck.transaction;
        if (isQuoteTransaction(tx)) {
          await settleQuoteAdvance(tx).catch((err) =>
            console.error("[webhooks/cashfree] quote settlement", err),
          );
        } else if (isInvoiceTransaction(tx)) {
          await settleInvoicePayment(tx).catch((err) =>
            console.error("[webhooks/cashfree] invoice settlement", err),
          );
        } else {
          await settlePlanAdvance(tx).catch((err) =>
            console.error("[webhooks/cashfree] plan settlement", err),
          );
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
    console.error("[webhooks/cashfree]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
