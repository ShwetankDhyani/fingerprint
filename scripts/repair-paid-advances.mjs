/**
 * Re-settle paid quote-advance transactions that never produced an invoice /
 * client org (legacy settlement gap). Idempotent.
 *
 *   node --env-file=.env.local scripts/repair-paid-advances.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL / service role key");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `LWX-INV-${year}-`;
  const { data } = await admin
    .from("invoices")
    .select("invoice_number")
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number ?? "";
  const n = Number(String(last).slice(prefix.length)) || 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

async function ensureOrg({ name, email, phone, fallbackName }) {
  const normalized = email?.trim().toLowerCase() || null;
  if (normalized) {
    const { data: byBilling } = await admin
      .from("organizations")
      .select("id, slug")
      .ilike("billing_email", normalized)
      .limit(1)
      .maybeSingle();
    if (byBilling?.id && byBilling.slug !== "lynx-studio") return byBilling.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .maybeSingle();
    if (profile?.id) {
      const { data: memberships } = await admin
        .from("organization_members")
        .select("organization_id, organizations(slug)")
        .eq("user_id", profile.id);
      for (const row of memberships ?? []) {
        const slug = row.organizations?.slug;
        if (slug && slug !== "lynx-studio") return row.organization_id;
      }
    }
  }

  const contact =
    String(name || "").trim() ||
    String(fallbackName || "").trim() ||
    (normalized ? normalized.split("@")[0] : "") ||
    "Client";
  const base = slugify(contact) || slugify(normalized) || "client";
  const slug = `${base}-${Date.now().toString(36).slice(-4)}`;
  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: contact,
      slug,
      billing_email: normalized,
      phone: phone || null,
      primary_contact_name: contact,
      notes_internal: normalized
        ? `Auto-repaired from orphan payment / recipient ${normalized}.`
        : "Auto-repaired from orphan payment.",
      meta: { source: "payment_repair" },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function ensurePaymentRow({ invoiceId, tx }) {
  const { data: existing } = await admin
    .from("invoice_payments")
    .select("id")
    .eq("transaction_id", tx.id)
    .maybeSingle();
  if (existing) return;
  const { error } = await admin.from("invoice_payments").insert({
    invoice_id: invoiceId,
    transaction_id: tx.id,
    amount_minor: tx.amount_minor,
    method: "cashfree",
    note: `Cashfree ${tx.provider_order_id ?? tx.id}`.trim(),
  });
  if (error) throw new Error(error.message);
}

async function repairTx(tx) {
  const raw = tx.raw || {};
  let quoteId = tx.quote_id || raw.quoteId || null;
  if (!quoteId && (raw.quoteNumber || raw.quote_number)) {
    const number = raw.quoteNumber || raw.quote_number;
    const { data: q } = await admin
      .from("quotes")
      .select("id")
      .eq("quote_number", number)
      .maybeSingle();
    quoteId = q?.id ?? null;
    if (quoteId) {
      await admin.from("transactions").update({ quote_id: quoteId }).eq("id", tx.id);
    }
  }

  if (quoteId) {
    const { data: quote } = await admin
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();
    if (quote) {
      const orgId =
        quote.organization_id ||
        (await ensureOrg({
          name: tx.customer_name || quote.recipient_name,
          email: tx.customer_email || quote.recipient_email,
          phone: tx.customer_phone || quote.recipient_phone,
          fallbackName: quote.title,
        }));

      const advanceTarget =
        Number(quote.advance_minor) ||
        Number(quote.total_minor) ||
        tx.amount_minor;

      await admin
        .from("quotes")
        .update({
          organization_id: orgId,
          status: "converted",
          accepted_at: quote.accepted_at || new Date().toISOString(),
          paid_advance_minor: Math.min(
            Math.max(Number(quote.paid_advance_minor ?? 0), tx.amount_minor),
            advanceTarget,
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", quote.id);

      let invoiceId = tx.invoice_id;
      const { data: existingInv } = await admin
        .from("invoices")
        .select("id, invoice_number")
        .eq("quote_id", quote.id)
        .maybeSingle();

      if (existingInv) {
        invoiceId = existingInv.id;
      } else {
        const invoiceNumber = await nextInvoiceNumber();
        const { data: created, error } = await admin
          .from("invoices")
          .insert({
            organization_id: orgId,
            project_id: quote.project_id,
            quote_id: quote.id,
            invoice_number: invoiceNumber,
            status: "paid",
            currency: quote.currency || "INR",
            subtotal_minor: advanceTarget,
            tax_minor: 0,
            total_minor: advanceTarget,
            amount_paid_minor: Math.min(tx.amount_minor, advanceTarget),
            issued_at: new Date().toISOString().slice(0, 10),
            due_at: new Date().toISOString().slice(0, 10),
            paid_at: new Date().toISOString(),
            notes: `Advance for ${quote.quote_number} (repaired)`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        invoiceId = created.id;
        await admin.from("invoice_line_items").insert({
          invoice_id: invoiceId,
          sort_order: 0,
          label: `Advance — ${quote.title}`,
          description: quote.quote_number,
          quantity: 1,
          unit_amount_minor: advanceTarget,
          amount_minor: advanceTarget,
        });
      }

      await ensurePaymentRow({ invoiceId, tx });
      await admin
        .from("transactions")
        .update({
          invoice_id: invoiceId,
          organization_id: orgId,
          quote_id: quoteId,
          raw: { ...raw, settled_at: new Date().toISOString(), repaired: true },
        })
        .eq("id", tx.id);

      return {
        ok: true,
        mode: "quote",
        quote: quote.quote_number,
        orgId,
        invoiceId,
      };
    }
  }

  const orgId = await ensureOrg({
    name: tx.customer_name,
    email: tx.customer_email,
    phone: tx.customer_phone,
    fallbackName: raw.quoteNumber || raw.quote_number || "Paid advance",
  });
  const invoiceNumber = await nextInvoiceNumber();
  const { data: created, error } = await admin
    .from("invoices")
    .insert({
      organization_id: orgId,
      invoice_number: invoiceNumber,
      status: "paid",
      currency: tx.currency || "INR",
      subtotal_minor: tx.amount_minor,
      tax_minor: 0,
      total_minor: tx.amount_minor,
      amount_paid_minor: tx.amount_minor,
      issued_at: new Date().toISOString().slice(0, 10),
      due_at: new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      notes: `Orphan advance repair${
        raw.quoteNumber || raw.quote_number
          ? ` for ${raw.quoteNumber || raw.quote_number}`
          : ""
      }`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("invoice_line_items").insert({
    invoice_id: created.id,
    sort_order: 0,
    label:
      raw.quoteNumber || raw.quote_number
        ? `Advance — ${raw.quoteNumber || raw.quote_number}`
        : "Advance payment",
    description: tx.provider_order_id || tx.id,
    quantity: 1,
    unit_amount_minor: tx.amount_minor,
    amount_minor: tx.amount_minor,
  });

  await ensurePaymentRow({ invoiceId: created.id, tx });
  await admin
    .from("transactions")
    .update({
      invoice_id: created.id,
      organization_id: orgId,
      raw: { ...raw, settled_at: new Date().toISOString(), repaired: true },
    })
    .eq("id", tx.id);

  return {
    ok: true,
    mode: "orphan",
    quote: raw.quoteNumber || raw.quote_number || null,
    orgId,
    invoiceId: created.id,
  };
}

const { data: txs, error } = await admin
  .from("transactions")
  .select("*")
  .eq("status", "paid")
  .or("plan_slug.eq.quote-advance,quote_id.not.is.null")
  .order("created_at", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const orphans = (txs || []).filter((tx) => !tx.invoice_id);
console.log(`Found ${orphans.length} paid advance tx(s) without invoice`);

for (const tx of orphans) {
  try {
    const result = await repairTx(tx);
    console.log("repaired", tx.provider_order_id || tx.id, result);
  } catch (err) {
    console.error("failed", tx.id, err.message || err);
  }
}

console.log("done");
