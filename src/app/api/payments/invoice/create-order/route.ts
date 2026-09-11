import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePortalProfile } from "@/lib/auth/session";
import { createInvoiceOrder } from "@/lib/payments/cashfree";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({
  invoiceId: z.string().uuid(),
  customerPhone: z
    .string()
    .trim()
    .min(10)
    .max(15)
    .regex(/^[0-9+]+$/),
});

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  if (!rateLimit(`cf-invoice:${ip}`, 10, 60_000).ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const profile = await requirePortalProfile();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid invoice and 10-digit mobile number are required." },
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

  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, total_minor, amount_paid_minor, organization_id",
    )
    .eq("id", parsed.data.invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const isStaff = profile.role === "ADMIN" || profile.role === "STAFF";
  if (
    !isStaff &&
    !profile.organization_ids.includes(String(invoice.organization_id))
  ) {
    return NextResponse.json({ error: "Not your invoice." }, { status: 403 });
  }

  const due =
    Number(invoice.total_minor) - Number(invoice.amount_paid_minor ?? 0);
  if (due <= 0) {
    return NextResponse.json(
      { error: "This invoice is already settled." },
      { status: 409 },
    );
  }

  try {
    const digits = parsed.data.customerPhone.replace(/\D/g, "").slice(-10);
    const order = await createInvoiceOrder({
      invoiceId: String(invoice.id),
      invoiceNumber: String(invoice.invoice_number),
      amountMinor: due,
      organizationId: String(invoice.organization_id),
      customerName: profile.full_name || profile.email,
      customerEmail: profile.email,
      customerPhone: digits,
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error("[payments/invoice/create-order]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 180)
            : "Unable to start the payment.",
      },
      { status: 500 },
    );
  }
}
