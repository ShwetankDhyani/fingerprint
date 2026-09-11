"use client";

import { useEffect, useState } from "react";
import { load } from "@cashfreepayments/cashfree-js";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailsMatch } from "@/lib/email-match";
import {
  getPlanBySlug,
  type SellablePlanSlug,
  sellablePlans,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

type PlanCheckoutPanelProps = {
  planSlug: SellablePlanSlug;
  onClose: () => void;
};

export function PlanCheckoutPanel({
  planSlug,
  onClose,
}: PlanCheckoutPanelProps) {
  const plan = getPlanBySlug(planSlug) ?? sellablePlans[0];
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.getElementById("plan-checkout")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [planSlug]);

  async function payAdvance() {
    setBusy(true);
    setStatus(null);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (trimmedName.length < 2) {
        throw new Error("Enter your name to book.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("Enter a valid work email.");
      }
      if (!emailsMatch(trimmedEmail, confirmEmail)) {
        throw new Error("Emails don’t match. Check for a typo.");
      }

      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const res = await fetch("/api/payments/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          customerEmail: trimmedEmail,
          confirmEmail: confirmEmail.trim(),
          customerName: trimmedName,
          customerPhone: digits.slice(-10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");

      if (data.mocked) {
        setStatus(
          "Cashfree isn’t configured in this environment — mock advance order only. Live booking requires Cashfree keys.",
        );
        return;
      }

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
            : "Cashfree checkout failed.",
        );
      }

      if (result?.paymentDetails || result?.redirect === false) {
        const verifyRes = await fetch("/api/payments/cashfree/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.paid) {
          setStatus(
            `Advance of ${plan.advanceLabel} received. Check your email for the receipt and client portal invite. We'll message you within one business day to schedule kickoff. Balance (${plan.balanceLabel}) is due before go-live.`,
          );
        } else {
          setStatus(
            "Checkout closed. If payment went through, refresh or check your email shortly.",
          );
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      id="plan-checkout"
      className="mt-10 rounded-2xl border border-forest/15 bg-mist/80 p-6 sm:p-8 dark:border-white/10 dark:bg-card/60"
      aria-label={`Book advance for ${plan.name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm tracking-[0.18em] text-forest/60 uppercase dark:text-gold/80">
            Book with advance
          </p>
          <h3 className="mt-2 font-display text-2xl tracking-tight text-forest dark:text-foreground">
            {plan.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Project total {plan.priceLabel} · Due today {plan.advanceLabel} (
            {plan.advancePercent}% advance)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.paymentTerms} · Delivery {plan.delivery}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "shrink-0",
          )}
          aria-label="Close checkout"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="checkout-name">Name</Label>
          <Input
            id="checkout-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="checkout-email">Email</Label>
          <Input
            id="checkout-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="checkout-confirm-email">Confirm email</Label>
          <Input
            id="checkout-confirm-email"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Type the same email again"
            autoComplete="off"
            required
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="checkout-phone">Mobile</Label>
          <Input
            id="checkout-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled={busy}
          onClick={payAdvance}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 w-full bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90",
          )}
        >
          {busy
            ? "Preparing…"
            : `Book plan · ${plan.advanceLabel}`}
        </button>
      </div>

      {status ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Receipt and client portal invite go to this email. Secure Cashfree
          checkout (UPI, cards, net banking, international cards). You’re paying
          the booking advance only — remaining {plan.balanceLabel} before
          go-live. Prefer to talk first?{" "}
          <a
            href={`/contact?plan=${plan.slug}&mode=discuss`}
            className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
          >
            Discuss this plan
          </a>
          .
        </p>
      )}
    </aside>
  );
}
