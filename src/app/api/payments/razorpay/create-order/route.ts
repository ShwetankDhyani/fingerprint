import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const bodySchema = z.object({
  planSlug: z.enum(["starter", "growth", "premium"]),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerEmail: z.string().trim().email().optional(),
  customerPhone: z.string().trim().max(32).optional(),
});

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`rzp-order:${ip}`, 10, 60_000);
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
      return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
    }

    const data = parsed.data;
    const order = await createRazorpayOrder({
      planSlug: data.planSlug,
      customerName: data.customerName
        ? sanitizeText(data.customerName, 120)
        : undefined,
      customerEmail: data.customerEmail
        ? sanitizeEmail(data.customerEmail)
        : undefined,
      customerPhone: data.customerPhone
        ? sanitizeText(data.customerPhone, 32)
        : undefined,
    });

    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      planName: order.planName,
      invoiceNumber: order.invoiceNumber,
      mocked: order.mocked,
    });
  } catch (error) {
    console.error("[razorpay/create-order]", error);
    return NextResponse.json(
      { error: "Unable to create Razorpay order." },
      { status: 500 },
    );
  }
}
