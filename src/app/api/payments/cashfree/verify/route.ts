import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertAdvanceAmountMatches,
  fetchCashfreeOrderStatus,
} from "@/lib/payments/cashfree";
import {
  isInvoiceTransaction,
  isQuoteTransaction,
  settleInvoicePayment,
  settlePlanAdvance,
  settleQuoteAdvance,
} from "@/lib/payments/settlement";
import { formatInr } from "@/lib/portal/utils";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import {
  getTransactionByOrderId,
  markTransactionPaid,
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

const bodySchema = z.object({
  orderId: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
});

async function buildReceipt(orderId: string, paid: boolean) {
  const tx = await getTransactionByOrderId({
    provider: "cashfree",
    providerOrderId: orderId,
  });
  if (!tx) {
    return {
      paid,
      orderId,
      kind: "unknown" as const,
      amountLabel: undefined as string | undefined,
      customerName: null as string | null,
      planName: null as string | null,
      invoiceNumber: null as string | null,
      quoteNumber: null as string | null,
      invoiceId: null as string | null,
    };
  }

  let kind: "quote" | "invoice" | "plan" | "unknown" = "plan";
  if (isQuoteTransaction(tx)) kind = "quote";
  else if (isInvoiceTransaction(tx)) kind = "invoice";

  let quoteNumber: string | null = null;
  let invoiceNumber = tx.invoice_number;
  const admin = getSupabaseAdmin();
  if (admin && tx.quote_id) {
    const { data: quote } = await admin
      .from("quotes")
      .select("quote_number")
      .eq("id", tx.quote_id)
      .maybeSingle();
    quoteNumber = (quote?.quote_number as string | null) ?? null;
  }
  if (admin && tx.invoice_id && !invoiceNumber) {
    const { data: invoice } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("id", tx.invoice_id)
      .maybeSingle();
    invoiceNumber = (invoice?.invoice_number as string | null) ?? null;
  }

  return {
    paid,
    orderId,
    kind,
    amountLabel: formatInr(tx.amount_minor),
    customerName: tx.customer_name,
    planName: tx.plan_name,
    invoiceNumber,
    quoteNumber,
    invoiceId: tx.invoice_id,
  };
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`cf-verify:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429 },
    );
  }

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    const status = await fetchCashfreeOrderStatus(parsed.data.orderId);

    if (status.paid) {
      const amountCheck = await assertAdvanceAmountMatches({
        orderId: status.orderId,
        paymentAmountInr: status.paymentAmount,
      });

      if (amountCheck.ok) {
        const result = await markTransactionPaid({
          provider: "cashfree",
          providerOrderId: status.orderId,
          providerPaymentId: status.paymentId ?? undefined,
          expectedAmountMinor: amountCheck.transaction.amount_minor,
          raw: {
            orderStatus: status.orderStatus,
            paymentStatus: status.paymentStatus,
            verifiedAt: new Date().toISOString(),
          },
        });

        // Settle on first mark-paid AND on alreadyPaid retries so portal
        // membership / status can catch up if a previous settle failed.
        if (result.updated || result.alreadyPaid) {
          const tx = amountCheck.transaction;
          if (isQuoteTransaction(tx)) {
            await settleQuoteAdvance(tx).catch((err) =>
              console.error("[cashfree/verify] quote settlement", err),
            );
          } else if (isInvoiceTransaction(tx)) {
            await settleInvoicePayment(tx).catch((err) =>
              console.error("[cashfree/verify] invoice settlement", err),
            );
          } else {
            await settlePlanAdvance(tx).catch((err) =>
              console.error("[cashfree/verify] plan settlement", err),
            );
          }
        }
      } else {
        console.warn("[cashfree/verify] amount/tx check failed", amountCheck);
      }
    }

    const receipt = await buildReceipt(status.orderId, status.paid);

    return NextResponse.json({
      orderStatus: status.orderStatus,
      paymentStatus: status.paymentStatus,
      mocked: status.mocked,
      ...receipt,
    });
  } catch (error) {
    console.error("[cashfree/verify]", error);
    return NextResponse.json(
      { error: "Unable to verify Cashfree payment." },
      { status: 500 },
    );
  }
}
