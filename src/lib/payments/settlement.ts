import "server-only";

import {
  sendInvoicePaidEmails,
  sendQuoteAcceptedEmails,
} from "@/lib/email/notifications";
import {
  ensureClientOrganization,
  ensureEmailMembership,
  ensureLeadRecord,
  markLeadConverted,
  resolveOrganizationIdForEmail,
} from "@/lib/portal/access";
import { ensureProjectForPaidQuote } from "@/lib/portal/ensure-project";
import { ensureClientPortalAccessInvite } from "@/lib/portal/onboarding-invite";
import { notifyStaff } from "@/lib/portal/notify";
import { sendPaymentWhatsApp } from "@/lib/whatsapp";
import { formatInr } from "@/lib/portal/format";
import { logActivity, nextInvoiceNumber } from "@/lib/portal/utils";
import { getSupabaseAdmin, type TransactionRow } from "@/lib/supabase/admin";

/**
 * True when this transaction already has a payment row or linked invoice.
 * Do NOT treat raw.settled_at alone as "fully settled" — older bugs stamped
 * settled_at without creating an invoice, and retries must still repair that.
 */
async function paymentAlreadyRecorded(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  transactionId: string,
) {
  const { data } = await admin
    .from("invoice_payments")
    .select("id")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (data?.id) return true;

  const { data: tx } = await admin
    .from("transactions")
    .select("invoice_id")
    .eq("id", transactionId)
    .maybeSingle();
  return Boolean(tx?.invoice_id);
}

async function advanceAlreadyCounted(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  tx: TransactionRow,
  quote: { paid_advance_minor?: number | null; advance_minor?: number | null },
) {
  if (await paymentAlreadyRecorded(admin, tx.id)) return true;
  const raw = (tx.raw ?? {}) as Record<string, unknown>;
  if (raw.settled_at) return true;
  const prior = Number(quote.paid_advance_minor ?? 0);
  const target =
    Number(quote.advance_minor) || Number(tx.amount_minor) || 0;
  return prior > 0 && prior >= Math.min(tx.amount_minor, target || tx.amount_minor);
}

/**
 * After a payment, make sure the payer/recipient can see the org in the portal.
 * Email is the primary identity — membership is linked even if they were invited
 * to a different org earlier.
 */
async function syncPortalAccessForPayment(input: {
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  organizationId?: string | null;
  emails: Array<string | null | undefined>;
}) {
  const orgId = input.organizationId;
  if (!orgId) return;
  const seen = new Set<string>();
  for (const raw of input.emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    await ensureEmailMembership(input.admin, {
      email,
      organizationId: orgId,
      memberRole: "owner",
    });
  }
}

/**
 * Applies a paid Cashfree transaction to the quotation it belongs to:
 * accepts the quote, raises (or settles) the advance invoice, records the
 * payment, and notifies both sides. Safe to call more than once.
 */
export async function settleQuoteAdvance(tx: TransactionRow) {
  const admin = getSupabaseAdmin();
  if (!admin || !tx.quote_id) return { settled: false as const };

  const { data: quote } = await admin
    .from("quotes")
    .select("*")
    .eq("id", tx.quote_id)
    .maybeSingle();
  if (!quote) return { settled: false as const };

  const alreadyRecorded = await paymentAlreadyRecorded(admin, tx.id);
  const advanceCounted = await advanceAlreadyCounted(admin, tx, quote);

  // Always attach a client org — prospect quotes must become Clients after pay.
  let organizationId = (quote.organization_id as string | null) ?? null;
  if (!organizationId) {
    organizationId =
      tx.organization_id ??
      (await resolveOrganizationIdForEmail(
        admin,
        tx.customer_email ?? (quote.recipient_email as string | null),
      ));
  }
  if (!organizationId) {
    organizationId = await ensureClientOrganization(admin, {
      name: tx.customer_name ?? (quote.recipient_name as string | null),
      email: tx.customer_email ?? (quote.recipient_email as string | null),
      phone: tx.customer_phone ?? (quote.recipient_phone as string | null),
      fallbackName: quote.title as string | null,
      leadId:
        ((quote.meta as { lead_id?: string } | null)?.lead_id as
          | string
          | undefined) ?? null,
    });
  }
  if (organizationId) {
    await admin
      .from("quotes")
      .update({ organization_id: organizationId })
      .eq("id", quote.id)
      .is("organization_id", null);
    if (tx.organization_id !== organizationId) {
      await admin
        .from("transactions")
        .update({ organization_id: organizationId })
        .eq("id", tx.id);
    }

    // Advance paid → lead becomes a Client.
    const metaLeadId =
      ((quote.meta as { lead_id?: string } | null)?.lead_id as
        | string
        | undefined) ?? null;
    await markLeadConverted(admin, {
      leadId: metaLeadId,
      email: tx.customer_email ?? (quote.recipient_email as string | null),
      organizationId,
    });
  }

  const advanceTarget =
    Number(quote.advance_minor) || Number(quote.total_minor) || tx.amount_minor;
  const priorPaid = Number(quote.paid_advance_minor ?? 0);

  if (!advanceCounted) {
    // Never let webhook retries inflate paid_advance_minor past a sane ceiling.
    const paidSoFar = Math.min(priorPaid + tx.amount_minor, advanceTarget || priorPaid + tx.amount_minor);
    await admin
      .from("quotes")
      .update({
        status: "converted",
        accepted_at: quote.accepted_at ?? new Date().toISOString(),
        paid_advance_minor: paidSoFar,
        ...(organizationId ? { organization_id: organizationId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    await admin.from("quote_events").insert({
      quote_id: quote.id,
      event_type: "accepted",
      summary: `Advance paid online (${tx.provider_order_id ?? "cashfree"})`,
      meta: { amountMinor: tx.amount_minor, transactionId: tx.id },
    });
  } else {
    // Still ensure quote stays converted / org linked even on retries.
    // Also clamp prior overcounts from the old non-idempotent path.
    await admin
      .from("quotes")
      .update({
        status: "converted",
        accepted_at: quote.accepted_at ?? new Date().toISOString(),
        ...(organizationId ? { organization_id: organizationId } : {}),
        paid_advance_minor: Math.min(
          Math.max(priorPaid, tx.amount_minor),
          advanceTarget || Math.max(priorPaid, tx.amount_minor),
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);
  }

  let invoiceId: string | null = tx.invoice_id;
  let invoiceNumber: string | null = tx.invoice_number ?? null;

  if (organizationId) {
    const { data: existingInvoice } = await admin
      .from("invoices")
      .select("id, invoice_number, total_minor, amount_paid_minor")
      .eq("quote_id", quote.id)
      .maybeSingle();

    if (existingInvoice) {
      invoiceId = existingInvoice.id as string;
      invoiceNumber = existingInvoice.invoice_number as string;
      if (!alreadyRecorded) {
        const paid =
          Number(existingInvoice.amount_paid_minor ?? 0) + tx.amount_minor;
        await admin
          .from("invoices")
          .update({
            amount_paid_minor: paid,
            status:
              paid >= Number(existingInvoice.total_minor) ? "paid" : "partial",
            paid_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);
      }
    } else {
      // Always provision the advance invoice once money is in — even if an
      // earlier broken settle stamped settled_at without creating one.
      invoiceNumber = await nextInvoiceNumber(admin);
      const { data: created } = await admin
        .from("invoices")
        .insert({
          organization_id: organizationId,
          project_id: quote.project_id,
          quote_id: quote.id,
          invoice_number: invoiceNumber,
          status: tx.amount_minor >= advanceTarget ? "paid" : "partial",
          currency: quote.currency ?? "INR",
          subtotal_minor: advanceTarget,
          tax_minor: 0,
          total_minor: advanceTarget,
          amount_paid_minor: Math.min(tx.amount_minor, advanceTarget),
          issued_at: new Date().toISOString().slice(0, 10),
          due_at: new Date().toISOString().slice(0, 10),
          paid_at: new Date().toISOString(),
          notes: `Advance for ${quote.quote_number}`,
        })
        .select("id")
        .single();
      invoiceId = (created?.id as string) ?? null;

      if (invoiceId) {
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
    }

    if (invoiceId && !alreadyRecorded) {
      await admin.from("invoice_payments").insert({
        invoice_id: invoiceId,
        transaction_id: tx.id,
        amount_minor: tx.amount_minor,
        method: "cashfree",
        note: `Cashfree ${tx.provider_order_id ?? ""}`.trim(),
      });
    }
    const raw = {
      ...((tx.raw as Record<string, unknown> | null) ?? {}),
      settled_at: new Date().toISOString(),
    };
    await admin
      .from("transactions")
      .update({
        ...(invoiceId ? { invoice_id: invoiceId } : {}),
        organization_id: organizationId,
        raw,
      })
      .eq("id", tx.id);
  } else {
    console.error(
      "[settlement] quote advance paid but no organization could be provisioned",
      { quoteId: quote.id, txId: tx.id },
    );
  }

  await syncPortalAccessForPayment({
    admin,
    organizationId,
    emails: [
      tx.customer_email,
      quote.recipient_email as string | null,
    ],
  });

  // Advance paid ⇒ project appears in the client portal.
  let projectId = (quote.project_id as string | null) ?? null;
  if (organizationId) {
    projectId =
      (await ensureProjectForPaidQuote(
        admin,
        {
          id: quote.id as string,
          title: quote.title as string | null,
          quote_number: quote.quote_number as string | null,
          organization_id: organizationId,
          project_id: projectId,
          notes: quote.notes as string | null,
        },
        organizationId,
      )) ?? projectId;

    if (projectId && invoiceId) {
      await admin
        .from("invoices")
        .update({ project_id: projectId })
        .eq("id", invoiceId)
        .is("project_id", null);
    }
  }

  // Emails / WhatsApp only on first successful settlement to avoid spam.
  if (!alreadyRecorded) {
    const clientEmail =
      tx.customer_email ?? (quote.recipient_email as string | null);
    const clientName =
      tx.customer_name ?? (quote.recipient_name as string | null);

    let organizationName: string | null = null;
    if (organizationId) {
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();
      organizationName = (org?.name as string | null) ?? null;
    }

    // First payment onboarding: attach a client-portal invite to the receipt
    // so they can set a password and open the portal immediately.
    const portalAccess = organizationId
      ? await ensureClientPortalAccessInvite(admin, {
          email: clientEmail,
          fullName: clientName,
          organizationId,
          organizationName,
          phone: tx.customer_phone ?? (quote.recipient_phone as string | null),
          sourceRef: quote.quote_number as string,
        }).catch((error) => {
          console.error("[settlement] portal invite failed", error);
          return null;
        })
      : null;

    await sendQuoteAcceptedEmails({
      clientEmail,
      clientName,
      quoteNumber: quote.quote_number as string,
      title: quote.title as string,
      amountMinor: tx.amount_minor,
      orderId: tx.provider_order_id ?? tx.id,
      invoiceNumber,
      organizationId,
      portalAccess,
    }).catch((error) => console.error("[settlement] email failed", error));

    if (portalAccess?.inviteId) {
      await logActivity(admin, {
        organizationId,
        projectId,
        action: "invited",
        entityType: "invite",
        entityId: portalAccess.inviteId,
        summary: `Portal invite included with payment receipt for ${clientEmail}`,
        meta: {
          source: "payment_onboarding",
          quoteNumber: quote.quote_number,
          needsPasswordSetup: portalAccess.needsPasswordSetup,
        },
      }).catch(() => undefined);
    }

    await sendPaymentWhatsApp({
      toPhone: tx.customer_phone,
      clientName: tx.customer_name ?? (quote.recipient_name as string | null),
      amountMinor: tx.amount_minor,
      reference: tx.provider_order_id ?? tx.id,
      documentLabel: `Quotation ${quote.quote_number}`,
      organizationId,
      entityType: "quote",
      entityId: quote.id as string,
    }).catch((error) => console.error("[settlement] whatsapp failed", error));

    await logActivity(admin, {
      organizationId,
      projectId,
      action: "paid",
      entityType: "quote",
      entityId: quote.id as string,
      summary: `Advance received for ${quote.quote_number}`,
      meta: { amountMinor: tx.amount_minor, invoiceNumber, projectId },
    });

    await notifyStaff({
      kind: "money",
      title: `Advance paid — ${formatInr(tx.amount_minor)}`,
      body: `${tx.customer_name ?? quote.recipient_name ?? "A client"} accepted ${quote.quote_number}. ${
        projectId ? "Project is open" : "No project opened yet"
      }.`,
      href: organizationId ? `/admin/clients/${organizationId}` : `/admin/quotes/${quote.id}`,
      organizationId,
      entityType: "quote",
      entityId: quote.id as string,
      dedupeKey: `quote-advance-paid:${tx.id}`,
    }).catch((error) => console.error("[settlement] notify failed", error));
  }

  return { settled: true as const, invoiceId, invoiceNumber, alreadyRecorded, projectId };
}

export function isQuoteTransaction(tx: TransactionRow) {
  return Boolean(tx.quote_id) || tx.plan_slug === "quote-advance";
}

export function isInvoiceTransaction(tx: TransactionRow) {
  return Boolean(tx.invoice_id) && tx.plan_slug === "invoice";
}

/** Records a direct invoice payment made from the client billing page. */
export async function settleInvoicePayment(tx: TransactionRow) {
  const admin = getSupabaseAdmin();
  if (!admin || !tx.invoice_id) return { settled: false as const };

  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, total_minor, amount_paid_minor, organization_id, quote_id, project_id",
    )
    .eq("id", tx.invoice_id)
    .maybeSingle();
  if (!invoice) return { settled: false as const };

  const alreadyRecorded = await paymentAlreadyRecorded(admin, tx.id);

  let organizationId = (invoice.organization_id as string | null) ?? null;
  if (!organizationId) {
    organizationId =
      tx.organization_id ??
      (await resolveOrganizationIdForEmail(admin, tx.customer_email));
    if (organizationId) {
      await admin
        .from("invoices")
        .update({ organization_id: organizationId })
        .eq("id", invoice.id)
        .is("organization_id", null);
    }
  }

  if (!alreadyRecorded) {
    const paid = Number(invoice.amount_paid_minor ?? 0) + tx.amount_minor;
    await admin
      .from("invoices")
      .update({
        amount_paid_minor: paid,
        status: paid >= Number(invoice.total_minor) ? "paid" : "partial",
        paid_at: new Date().toISOString(),
        ...(organizationId && !invoice.organization_id
          ? { organization_id: organizationId }
          : {}),
      })
      .eq("id", invoice.id);

    await admin.from("invoice_payments").insert({
      invoice_id: invoice.id,
      transaction_id: tx.id,
      amount_minor: tx.amount_minor,
      method: "cashfree",
      note: `Cashfree ${tx.provider_order_id ?? ""}`.trim(),
    });

    await logActivity(admin, {
      organizationId,
      action: "paid",
      entityType: "invoice",
      entityId: invoice.id as string,
      summary: `Payment received for ${invoice.invoice_number}`,
      meta: { amountMinor: tx.amount_minor },
    });

    const remainingMinor = Math.max(0, Number(invoice.total_minor) - paid);
    await sendInvoicePaidEmails({
      clientEmail: tx.customer_email,
      clientName: tx.customer_name,
      invoiceNumber: invoice.invoice_number as string,
      amountMinor: tx.amount_minor,
      orderId: tx.provider_order_id ?? tx.id,
      organizationId,
      remainingMinor,
    }).catch((error) =>
      console.error("[settlement] invoice email failed", error),
    );

    await sendPaymentWhatsApp({
      toPhone: tx.customer_phone,
      clientName: tx.customer_name,
      amountMinor: tx.amount_minor,
      reference: tx.provider_order_id ?? tx.id,
      documentLabel: `Invoice ${invoice.invoice_number}`,
      organizationId,
      entityType: "invoice",
      entityId: invoice.id as string,
    }).catch((error) =>
      console.error("[settlement] invoice whatsapp failed", error),
    );

    await notifyStaff({
      kind: "money",
      title: `Invoice paid — ${formatInr(tx.amount_minor)}`,
      body: `${tx.customer_name ?? "A client"} paid ${invoice.invoice_number}. ${
        remainingMinor > 0
          ? `${formatInr(remainingMinor)} still outstanding.`
          : "Fully settled."
      }`,
      href: `/admin/invoices/${invoice.id}`,
      organizationId,
      entityType: "invoice",
      entityId: invoice.id as string,
      dedupeKey: `invoice-paid:${tx.id}`,
    }).catch((error) => console.error("[settlement] notify failed", error));
  }

  if (organizationId) {
    await admin
      .from("transactions")
      .update({ organization_id: organizationId })
      .eq("id", tx.id);
  }

  let quoteRecipient: string | null = null;
  let quoteRow: {
    id: string;
    title?: string | null;
    quote_number?: string | null;
    project_id?: string | null;
    notes?: string | null;
    recipient_email?: string | null;
  } | null = null;
  if (invoice.quote_id) {
    const { data: quote } = await admin
      .from("quotes")
      .select("id, title, quote_number, project_id, notes, recipient_email")
      .eq("id", invoice.quote_id)
      .maybeSingle();
    quoteRow = quote;
    quoteRecipient = (quote?.recipient_email as string | null) ?? null;
  }

  await syncPortalAccessForPayment({
    admin,
    organizationId,
    emails: [tx.customer_email, quoteRecipient],
  });

  // Paying an advance invoice should open the project for the client.
  if (organizationId && quoteRow) {
    const projectId = await ensureProjectForPaidQuote(
      admin,
      {
        id: quoteRow.id,
        title: quoteRow.title,
        quote_number: quoteRow.quote_number,
        organization_id: organizationId,
        project_id: quoteRow.project_id ?? null,
        notes: quoteRow.notes,
      },
      organizationId,
    );
    if (projectId) {
      await admin
        .from("invoices")
        .update({ project_id: projectId })
        .eq("id", invoice.id)
        .is("project_id", null);
    }
  }

  return { settled: true as const, alreadyRecorded };
}


/** Self-serve plan advance: provision client org, portal invite, lead, and receipt. */

export async function settlePlanAdvance(tx: TransactionRow) {
  const admin = getSupabaseAdmin();
  if (!admin) return { settled: false as const };

  if (isQuoteTransaction(tx) || isInvoiceTransaction(tx)) {
    return { settled: false as const };
  }

  const raw = (tx.raw ?? {}) as Record<string, unknown>;
  const alreadySettled = Boolean(raw.plan_settled_at);

  let organizationId =
    tx.organization_id ??
    (await resolveOrganizationIdForEmail(admin, tx.customer_email));

  if (!organizationId) {
    organizationId = await ensureClientOrganization(admin, {
      name: tx.customer_name,
      email: tx.customer_email,
      phone: tx.customer_phone,
      fallbackName: tx.plan_name,
    });
  }

  const leadId =
    tx.lead_id ??
    (await ensureLeadRecord(admin, {
      name: tx.customer_name,
      email: tx.customer_email,
      phone: tx.customer_phone,
      company: tx.customer_name,
      projectType: "plan-booking",
      scope: `Paid ${tx.plan_name} advance online (${formatInr(tx.amount_minor)}).`,
      source: "plan_checkout",
    }));

  if (organizationId && leadId) {
    await markLeadConverted(admin, {
      leadId,
      email: tx.customer_email,
      organizationId,
    });
  }

  if (organizationId) {
    await syncPortalAccessForPayment({
      admin,
      organizationId,
      emails: [tx.customer_email],
    });
    if (tx.organization_id !== organizationId || tx.lead_id !== leadId) {
      await admin
        .from("transactions")
        .update({
          organization_id: organizationId,
          ...(leadId ? { lead_id: leadId } : {}),
        })
        .eq("id", tx.id);
    }
  }

  let portalAccess: {
    url: string;
    needsPasswordSetup: boolean;
    inviteId?: string;
  } | null = null;

  if (organizationId && !alreadySettled) {
    let organizationName: string | null = null;
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    organizationName = (org?.name as string | null) ?? null;

    portalAccess = await ensureClientPortalAccessInvite(admin, {
      email: tx.customer_email,
      fullName: tx.customer_name,
      organizationId,
      organizationName,
      phone: tx.customer_phone,
      sourceRef: tx.plan_slug || tx.plan_name,
    }).catch((error) => {
      console.error("[settlement] plan portal invite failed", error);
      return null;
    });

    await admin
      .from("transactions")
      .update({
        raw: {
          ...raw,
          plan_settled_at: new Date().toISOString(),
          portal_invite_id: portalAccess?.inviteId ?? null,
        },
      })
      .eq("id", tx.id);

    const { dispatchAdvancePaidEmails } = await import("@/lib/email/dispatch");
    await dispatchAdvancePaidEmails({
      customerName: tx.customer_name ?? "there",
      customerEmail: tx.customer_email,
      planName: tx.plan_name,
      amountInr: tx.amount_minor / 100,
      orderId: tx.provider_order_id ?? tx.id,
      invoiceNumber: tx.invoice_number,
      portalAccess: portalAccess
        ? {
            url: portalAccess.url,
            needsPasswordSetup: portalAccess.needsPasswordSetup,
          }
        : null,
    }).catch((error) => console.error("[settlement] plan email failed", error));

    await notifyStaff({
      kind: "money",
      title: `Plan advance paid — ${formatInr(tx.amount_minor)}`,
      body: `${tx.customer_name ?? "A client"} booked ${tx.plan_name}. Portal ${
        portalAccess ? "invite ready" : "pending"
      }.`,
      href: organizationId
        ? `/admin/clients/${organizationId}`
        : "/admin/leads",
      organizationId,
      entityType: "transaction",
      entityId: tx.id,
      dedupeKey: `plan-advance-paid:${tx.id}`,
    }).catch((error) => console.error("[settlement] plan notify failed", error));

    await sendPaymentWhatsApp({
      toPhone: tx.customer_phone,
      clientName: tx.customer_name,
      amountMinor: tx.amount_minor,
      reference: tx.provider_order_id ?? tx.id,
      documentLabel: tx.plan_name,
      organizationId,
      entityType: "transaction",
      entityId: tx.id,
    }).catch((error) => console.error("[settlement] plan whatsapp failed", error));

    await logActivity(admin, {
      organizationId,
      action: "paid",
      entityType: "transaction",
      entityId: tx.id,
      summary: `Plan advance received for ${tx.plan_name}`,
      meta: {
        amountMinor: tx.amount_minor,
        planSlug: tx.plan_slug,
        portalInvite: Boolean(portalAccess),
      },
    }).catch(() => undefined);
  }

  return {
    settled: true as const,
    organizationId,
    leadId,
    portalAccess,
    alreadySettled,
  };
}
