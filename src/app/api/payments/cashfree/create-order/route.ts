import { NextResponse } from "next/server";
import { z } from "zod";
import { emailsMatch } from "@/lib/email-match";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { createCashfreeOrder } from "@/lib/payments/cashfree";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const bodySchema = z
  .object({
    planSlug: z.enum(["starter", "growth", "premium"]),
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().trim().email(),
    confirmEmail: z
      .string()
      .trim()
      .min(1, "Re-enter your email to confirm.")
      .email("Re-enter a valid email."),
    customerPhone: z
      .string()
      .trim()
      .min(10)
      .max(15)
      .regex(/^[0-9+]+$/, "Phone must be digits (optional leading +)."),
  })
  .superRefine((value, ctx) => {
    if (!emailsMatch(value.customerEmail, value.confirmEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmEmail"],
        message: "Emails don’t match. Check for a typo.",
      });
    }
  });

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit(`cf-order:${ip}`, 10, 60_000);
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
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Name, email, and mobile are required to book.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const phone = sanitizeText(data.customerPhone, 15).replace(/[^\d+]/g, "");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit mobile number." },
        { status: 400 },
      );
    }

    const order = await createCashfreeOrder({
      planSlug: data.planSlug,
      customerName: sanitizeText(data.customerName, 120),
      customerEmail: sanitizeEmail(data.customerEmail),
      customerPhone: digits.slice(-10),
    });

    return NextResponse.json({
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      amount: order.amount,
      currency: order.currency,
      planName: order.planName,
      invoiceNumber: order.invoiceNumber,
      mode: order.mode,
      mocked: order.mocked,
      advancePercent: order.advancePercent,
      fullProjectInr: order.fullProjectInr,
    });
  } catch (error) {
    console.error("[cashfree/create-order]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("Cashfree")
            ? error.message.slice(0, 180)
            : "Unable to create advance payment. Please try again or contact us.",
      },
      { status: 500 },
    );
  }
}
