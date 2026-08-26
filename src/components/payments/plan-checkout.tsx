"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPlanBySlug,
  type SellablePlanSlug,
  sellablePlans,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

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
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"in" | "global" | null>(null);

  useEffect(() => {
    document.getElementById("plan-checkout")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [planSlug]);

  async function payIndia() {
    setBusy("in");
    setStatus(null);
    try {
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          customerEmail: email || undefined,
          customerName: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");

      if (data.mocked) {
        setStatus(
          "Razorpay isn’t configured yet — mock order created. Add RAZORPAY_* keys for live UPI/cards.",
        );
        return;
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout failed to load.");
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Lynx Web Solutions",
        description: data.planName,
        order_id: data.orderId,
        prefill: { name: name || "", email: email || "" },
        theme: { color: "#0f3d2e" },
        handler() {
          setStatus("Payment captured. We’ll confirm kickoff by email shortly.");
        },
      });
      rzp.on("payment.failed", () => {
        setStatus("Payment was not completed. You can try again.");
      });
      rzp.open();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function payGlobal() {
    setBusy("global");
    setStatus(null);
    try {
      const res = await fetch("/api/payments/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          customerEmail: email || undefined,
          customerName: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.mocked) {
        setStatus(
          "Stripe isn’t configured yet — mock session created. Add STRIPE_* keys for live international cards.",
        );
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside
      id="plan-checkout"
      className="mt-10 rounded-2xl border border-forest/15 bg-mist/80 p-6 sm:p-8 dark:border-white/10 dark:bg-card/60"
      aria-label={`Checkout for ${plan.name}`}
    >
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm tracking-[0.18em] text-forest/60 uppercase dark:text-gold/80">
            Checkout
          </p>
          <h3 className="mt-2 font-display text-2xl tracking-tight text-forest dark:text-foreground">
            {plan.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.priceLabel} · Delivery {plan.delivery}
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
        <div className="grid gap-1.5">
          <Label htmlFor="checkout-name">Name</Label>
          <Input
            id="checkout-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
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
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={payIndia}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 flex-1 bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90",
          )}
        >
          {busy === "in" ? "Preparing…" : "Pay in India (UPI / cards)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={payGlobal}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 flex-1",
          )}
        >
          {busy === "global" ? "Redirecting…" : "Pay internationally (Stripe)"}
        </button>
      </div>

      {status ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Prefer to talk first?{" "}
          <a
            href={`/contact?plan=${plan.slug}&mode=discuss`}
            className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
          >
            Discuss this plan
          </a>{" "}
          instead of paying now.
        </p>
      )}
    </aside>
  );
}
