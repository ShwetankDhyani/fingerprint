import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { PlansPricingGrid } from "@/components/plans/plans-pricing-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { sellableAddOns, sellableServices } from "@/lib/plans";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plans & Pricing",
  description:
    "Website plans from Lynx Web Solutions — book with a professional advance (50% or 25%), balance before go-live. Starter from ₹14,999, Growth ₹34,999, Premium ₹69,999.",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: `Plans & Pricing | ${siteConfig.name}`,
    description:
      "Book Starter, Growth, or Premium with a project advance — remaining balance before go-live.",
    url: `${siteConfig.url}/plans`,
  },
};

export default function PlansPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/80 bg-mist dark:bg-card">
        <div className="lynx-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Plans"
            title="Clear packages. Professional advance to book."
            description="Pay a booking advance online (not the full fee), kick off within 48 hours, and settle the balance before go-live — Cashfree for India and international cards."
          />
        </div>
      </section>

      <section className="bg-background" id="website-plans">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            eyebrow="Website plans"
            title="Most in-demand offers."
            description="Simple scopes for local businesses, lead-gen sites, and premium brand or ecommerce builds. Industry-standard advance payment — you never pay 100% before work starts."
          />

          <div className="mt-14">
            <PlansPricingGrid />
          </div>

          <div className="mt-10 max-w-3xl space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">How payment works:</span>{" "}
              Starter books at 50% advance; Growth and Premium at 25%. Kickoff
              starts after the advance clears. Remaining balance is invoiced
              before launch (Premium may split into milestones).
            </p>
            <p>
              Need a custom web app, marketplace, or SaaS dashboard? We scope and
              quote separately — use contact and pick “Custom SaaS / web app.”
            </p>
          </div>
        </div>
      </section>

      <section
        id="services-stack"
        className="border-t border-border/80 bg-mist dark:bg-card"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            eyebrow="Service stack"
            title="Everything else we sell."
            description="Core development plus high-ROI services that improve conversion and create retainers."
          />
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {sellableServices.map((service, index) => (
              <Reveal key={service.slug} as="li" delay={index * 0.04}>
                <article className="h-full border-t border-forest/20 pt-5 dark:border-white/15">
                  <h3 className="font-display text-xl tracking-tight text-forest dark:text-foreground">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {service.summary}
                  </p>
                  <p className="mt-3 text-xs font-medium tracking-wide text-gold uppercase">
                    {service.note}
                  </p>
                </article>
              </Reveal>
            ))}
          </ul>
          <Link
            href="/contact?type=addon"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-10 h-11 bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground",
            )}
          >
            Ask about a service
          </Link>
        </div>
      </section>

      <section id="add-ons" className="border-t border-border/80 bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <SectionHeading
            eyebrow="Add-ons"
            title="Quick upgrades clients book happily."
            description="Small, high-leverage extras that pair cleanly with a new site or an existing one."
          />
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {sellableAddOns.map((addon, index) => (
              <Reveal key={addon.slug} as="li" delay={index * 0.05}>
                <article className="flex h-full flex-col rounded-2xl border border-forest/10 bg-card/70 p-6 dark:border-white/10">
                  <h3 className="font-display text-xl tracking-tight text-forest dark:text-foreground">
                    {addon.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {addon.summary}
                  </p>
                  <Link
                    href={`/contact?addon=${addon.slug}`}
                    className="mt-6 text-sm font-medium text-forest hover:underline dark:text-gold"
                  >
                    Add to inquiry →
                  </Link>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-xl text-lg text-white/80">
            Not sure which plan fits? Send a short brief — we’ll map Starter,
            Growth, Premium, or a custom quote.
          </p>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
            )}
          >
            Start a conversation
          </Link>
        </div>
      </section>
    </>
  );
}
