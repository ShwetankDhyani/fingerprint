"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { PlanCheckoutPanel } from "@/components/payments/plan-checkout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  sellablePlans,
  type SellablePlanSlug,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PlansPricingGrid() {
  const [checkoutSlug, setCheckoutSlug] = useState<SellablePlanSlug | null>(
    null,
  );

  return (
    <div>
      <ul className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {sellablePlans.map((plan, index) => {
          const paying = checkoutSlug === plan.slug;
          return (
            <Reveal key={plan.slug} as="li" delay={index * 0.06}>
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-card/80 p-6 pt-7 sm:p-7",
                  plan.popular
                    ? "border-gold/60 shadow-[0_28px_70px_-40px_rgba(176,141,31,0.55)]"
                    : "border-forest/10 dark:border-white/10",
                  paying && "ring-2 ring-gold/50",
                )}
              >
                {plan.popular ? (
                  <div className="absolute -top-3 right-5">
                    <Badge className="bg-gold text-gold-foreground shadow-sm">
                      <Sparkles className="size-3" />
                      Most popular
                    </Badge>
                  </div>
                ) : null}

                <p className="font-display text-sm tracking-[0.18em] text-forest/60 uppercase dark:text-gold/80">
                  {plan.label}
                </p>
                <h2 className="mt-3 font-display text-2xl tracking-tight text-forest dark:text-foreground">
                  {plan.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
                <p className="mt-6 font-display text-4xl tracking-tight text-forest dark:text-gold">
                  {plan.priceLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Delivery {plan.delivery}
                </p>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 grid gap-2">
                  <Link
                    href={`/contact?plan=${plan.slug}`}
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-11",
                      plan.popular
                        ? "bg-gold text-gold-foreground hover:bg-gold/90"
                        : "bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90",
                    )}
                  >
                    Get started
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCheckoutSlug(plan.slug)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-11",
                    )}
                  >
                    {paying ? "Checkout open below" : "Pay now"}
                  </button>
                  <Link
                    href={`/contact?plan=${plan.slug}&mode=discuss`}
                    className="pt-1 text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Or discuss first
                  </Link>
                </div>
              </article>
            </Reveal>
          );
        })}
      </ul>

      {checkoutSlug ? (
        <PlanCheckoutPanel
          planSlug={checkoutSlug}
          onClose={() => setCheckoutSlug(null)}
        />
      ) : null}
    </div>
  );
}
