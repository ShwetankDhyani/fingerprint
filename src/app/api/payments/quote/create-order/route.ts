import { NextResponse } from "next/server";
import { z } from "zod";

import { emailsMatch } from "@/lib/email-match";
import { createQuoteAdvanceOrder } from "@/lib/payments/cashfree";
import { hashToken } from "@/lib/portal/utils";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z
  .object({
    quoteNumber: z.string().trim().min(3).max(64),
    shareToken: z.string().trim().min(8).max(128).optional(),
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
  if (!rateLimit(`cf-quote:${ip}`, 10, 60_000).ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Name, email and mobile are required to pay.",
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Payments are temporarily unavailable." },
      { status: 503 },
    );
  }

  const { quoteNumber, shareToken } = parsed.data;
  const { data: quote } = await admin
    .from("quotes")
    .select(
      "id, quote_number, title, status, advance_minor, total_minor, paid_advance_minor, share_token_hash, share_expires_at, organization_id",
    )
    .eq("quote_number", quoteNumber)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  // A share token is the bearer credential for public quotes.
  const settled = ["accepted", "converted"].includes(String(quote.status));
  if (!settled) {
    const expected = quote.share_token_hash as string | null;
    if (!shareToken || !expected || hashToken(shareToken) !== expected) {
      return NextResponse.json(
        { error: "This payment link is no longer valid. Ask us for a fresh one." },
        { status: 403 },
      );
    }
  }

  if (
    quote.share_expires_at &&
    new Date(String(quote.share_expires_at)).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "This quotation link has expired. Ask us to regenerate it." },
      { status: 410 },
    );
  }

  const alreadyPaid = Number(quote.paid_advance_minor ?? 0);
  const advance = Number(quote.advance_minor) || Number(quote.total_minor);
  const due = advance - alreadyPaid;
  if (due <= 0) {
    return NextResponse.json(
      { error: "The advance for this quotation is already paid." },
      { status: 409 },
    );
  }

  try {
    const digits = parsed.data.customerPhone.replace(/\D/g, "");
    const order = await createQuoteAdvanceOrder({
      quoteId: quote.id as string,
      quoteNumber: quote.quote_number as string,
      title: quote.title as string,
      amountMinor: due,
      organizationId: (quote.organization_id as string | null) ?? null,
      customerName: sanitizeText(parsed.data.customerName, 120),
      customerEmail: sanitizeEmail(parsed.data.customerEmail),
      customerPhone: digits.slice(-10),
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("[payments/quote/create-order]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 180)
            : "Unable to start the payment. Please try again.",
      },
      { status: 500 },
    );
  }
}
