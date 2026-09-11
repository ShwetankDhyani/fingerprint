"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Pay the outstanding balance on one invoice from the client portal. */
export function InvoiceCheckout({
  invoiceId,
  amountLabel,
  defaultPhone,
}: {
  invoiceId: string;
  amountLabel: string;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setStatus(null);
    try {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) throw new Error("Enter a valid 10-digit mobile.");

      const res = await fetch("/api/payments/invoice/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, customerPhone: digits.slice(-10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment.");

      const cashfree = await load({
        mode: data.mode === "production" ? "production" : "sandbox",
      });
      const result = await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_modal",
      });
      if (result?.error) {
        throw new Error(
          typeof result.error.message === "string"
            ? result.error.message
            : "Payment was not completed.",
        );
      }

      const verify = await fetch("/api/payments/cashfree/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderId }),
      });
      const verifyData = await verify.json();
      if (verify.ok && verifyData.paid) {
        router.push(
          `/payments/confirmation?order_id=${encodeURIComponent(data.orderId)}`,
        );
        return;
      } else {
        setStatus(
          "Checkout closed. If the amount was debited it will reflect here shortly.",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Pay {amountLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Mobile"
        inputMode="numeric"
        className="h-8 w-32"
        aria-label="Mobile number"
      />
      <Button size="sm" onClick={pay} disabled={busy}>
        {busy ? "Opening…" : `Pay ${amountLabel}`}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {status ? (
        <p className="w-full text-right text-xs text-[#d4b45a]" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
