"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailsMatch } from "@/lib/email-match";

type QuoteCheckoutProps = {
  quoteNumber: string;
  shareToken?: string | null;
  amountLabel: string;
  defaultName?: string | null;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
};

export function QuoteCheckout({
  quoteNumber,
  shareToken,
  amountLabel,
  defaultName,
  defaultEmail,
  defaultPhone,
}: QuoteCheckoutProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function pay() {
    setBusy(true);
    setStatus(null);
    try {
      if (name.trim().length < 2) throw new Error("Enter your full name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error("Enter a valid email address.");
      }
      if (!emailsMatch(email, confirmEmail)) {
        throw new Error("Emails don’t match. Check for a typo.");
      }
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) throw new Error("Enter a valid 10-digit mobile.");

      const res = await fetch("/api/payments/quote/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteNumber,
          shareToken: shareToken ?? undefined,
          customerName: name.trim(),
          customerEmail: email.trim(),
          confirmEmail: confirmEmail.trim(),
          customerPhone: digits.slice(-10),
        }),
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
          "Checkout closed. If the amount was debited it will reflect here within a few minutes.",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[#2f7d5c] bg-[#10231b] p-5">
        <p className="font-medium text-[#7fe0b0]">Advance received</p>
        <p className="mt-1 text-sm text-[#9aaba2]">{status}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => setOpen(true)}>
          Accept &amp; pay {amountLabel} advance
        </Button>
        <p className="text-xs text-[#9aaba2]">
          Secure Cashfree checkout · UPI, cards, net banking
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#24302b] bg-[#0e1714] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
        Pay advance · {amountLabel}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="q-name">Name</Label>
          <Input
            id="q-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="q-email">Email</Label>
          <Input
            id="q-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="q-confirm-email">Confirm email</Label>
          <Input
            id="q-confirm-email"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Type the same email again"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="q-phone">Mobile</Label>
          <Input
            id="q-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile"
            autoComplete="tel"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="lg" onClick={pay} disabled={busy}>
          {busy ? "Opening Cashfree…" : `Pay ${amountLabel} now`}
        </Button>
        <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {status ? (
        <p className="mt-3 text-sm text-[#d4b45a]" role="status">
          {status}
        </p>
      ) : (
        <p className="mt-3 text-xs text-[#9aaba2]">
          Receipt and client portal invite go to this email. You are paying the
          booking advance only — the balance follows the milestone schedule in
          this quotation.
        </p>
      )}
    </div>
  );
}
