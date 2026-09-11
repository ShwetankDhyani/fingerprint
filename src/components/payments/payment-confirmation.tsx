"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Receipt = {
  paid: boolean;
  orderId: string;
  orderStatus?: string;
  paymentStatus?: string;
  amountLabel?: string;
  customerName?: string | null;
  planName?: string | null;
  invoiceNumber?: string | null;
  quoteNumber?: string | null;
  invoiceId?: string | null;
  kind?: "quote" | "invoice" | "plan" | "unknown";
};

export function PaymentConfirmationClient({ orderId }: { orderId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) {
      setError(
        "Missing payment reference. If you were charged, contact Lynx with your bank/UPI reference.",
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/payments/cashfree/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Could not verify payment.");
        setReceipt(data as Receipt);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Verification failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="mt-4 space-y-3" role="status">
        <div className="h-8 w-2/3 animate-pulse rounded bg-[#1a2420]" />
        <div className="h-4 w-full animate-pulse rounded bg-[#1a2420]" />
        <p className="text-sm text-[#9aaba2]">Confirming your Cashfree payment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl">
          We couldn&apos;t confirm that payment
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">{error}</p>
        <p className="mt-3 text-xs text-[#9aaba2]">
          Reference:{" "}
          <span className="font-mono text-[#e8eee9]">{orderId || "—"}</span>
        </p>
      </div>
    );
  }

  if (!receipt?.paid) {
    return (
      <div className="mt-4 rounded-xl border border-[#b08d1f]/40 bg-[#b08d1f]/10 p-5">
        <h1 className="font-[family-name:var(--font-syne)] text-2xl">
          Payment still processing
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          Status: {receipt?.paymentStatus || receipt?.orderStatus || "pending"}.
          If the amount was debited it usually settles within a few minutes —
          refresh this page or open billing.
        </p>
        <p className="mt-3 font-mono text-xs text-[#9aaba2]">
          Order {receipt?.orderId || orderId}
        </p>
      </div>
    );
  }

  const title =
    receipt.kind === "invoice"
      ? "Invoice payment received"
      : receipt.kind === "quote"
        ? "Advance payment received"
        : "Payment received";

  const rows: Array<[string, string]> = [
    ["Amount", receipt.amountLabel || "—"],
    ["For", receipt.planName || "—"],
  ];
  if (receipt.invoiceNumber) rows.push(["Invoice", receipt.invoiceNumber]);
  if (receipt.quoteNumber) rows.push(["Quotation", receipt.quoteNumber]);
  rows.push(["Payment reference", receipt.orderId]);

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-[#2f7d5c] bg-[#10231b] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7fe0b0]">
          Confirmed
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-syne)] text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#9aaba2]">
          Thank you
          {receipt.customerName
            ? `, ${receipt.customerName.split(" ")[0]}`
            : ""}
          . A receipt is on its way by email
          {receipt.kind === "quote" || receipt.kind === "invoice"
            ? " (and WhatsApp when the Cloud API is configured)"
            : ""}
          .
        </p>
      </div>

      <dl className="mt-6 divide-y divide-[#24302b] rounded-xl border border-[#24302b]">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aaba2]">
              {label}
            </dt>
            <dd className="text-right text-sm text-[#e8eee9]">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-[#9aaba2]">
        Keep this screen or your email as proof of payment. Plan bookings include a client portal invite in the receipt email. Your portal billing
        page shows the refreshed balance.
      </p>

      {receipt.kind === "invoice" ? (
        <Link
          href="/client/billing"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex")}
        >
          View updated invoice
        </Link>
      ) : null}
      {receipt.kind === "plan" ? (
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex")}
        >
          Open client portal
        </Link>
      ) : null}
      {receipt.kind === "quote" && receipt.quoteNumber ? (
        <Link
          href={`/q/${encodeURIComponent(receipt.quoteNumber)}`}
          className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex")}
        >
          View quotation
        </Link>
      ) : null}
    </div>
  );
}
