import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { createStripeCheckoutSession } from "@/lib/payments/stripe";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const bodySchema = z.object({
  planSlug: z.enum(["starter", "growth", "premium"]),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerEmail: z.string().trim().email().optional(),
});

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`stripe-checkout:${ip}`, 10, 60_000);
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
      return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
    }

    const data = parsed.data;
    const session = await createStripeCheckoutSession({
      planSlug: data.planSlug,
      customerName: data.customerName
        ? sanitizeText(data.customerName, 120)
        : undefined,
      customerEmail: data.customerEmail
        ? sanitizeEmail(data.customerEmail)
        : undefined,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.sessionId,
      invoiceNumber: session.invoiceNumber,
      mocked: session.mocked,
    });
  } catch (error) {
    console.error("[stripe/create-checkout]", error);
    return NextResponse.json(
      { error: "Unable to create Stripe checkout session." },
      { status: 500 },
    );
  }
}
