import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { TerminalPreview } from "@/components/home/terminal-preview";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { WorkFilterGrid } from "@/components/work/work-filter-grid";
import { buttonVariants } from "@/components/ui/button";
import {
  metrics,
  services,
  siteConfig,
  testimonials,
} from "@/lib/site";
import { sellablePlans } from "@/lib/plans";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2400&q=80"
          alt="Bright modern workspace with long desks and large windows"
          fill
          priority
          className="animate-lynx-pan object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f18]/93 via-[#0f3d2e]/78 to-[#0c1612]/60" />
        <div className="grain absolute inset-0 opacity-[0.18] mix-blend-overlay" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-6xl items-end gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div>
            <p className="animate-lynx-rise font-display text-4xl leading-none font-semibold tracking-tight sm:text-6xl md:text-7xl">
              Lynx Web Solutions
            </p>
            <div className="animate-lynx-line mt-5 h-px w-24 bg-gold sm:w-32" />
            <h1 className="animate-lynx-rise delay-1 mt-6 max-w-xl font-display text-2xl leading-tight tracking-tight text-white/95 sm:text-3xl md:text-4xl">
              {siteConfig.tagline}
            </h1>
            <p className="animate-lynx-rise delay-2 mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Web engineering for founders and product teams — websites, SaaS,
              and ecommerce with ruthless performance and honest SEO. India and
              global. Shipping since {siteConfig.founded}. Support, any day.
            </p>
            <div className="animate-lynx-rise delay-3 mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 bg-gold px-6 text-gold-foreground hover:bg-gold/90",
                )}
              >
                Start a project
              </Link>
              <Link
                href="/work"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 border-white/35 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white",
                )}
              >
                Explore work
              </Link>
            </div>
          </div>
          <div className="animate-lynx-rise delay-4 hidden lg:block">
            <TerminalPreview />
          </div>
        </div>
      </section>

      <section
        aria-label="Trust metrics"
        className="border-y border-border/80 bg-mist dark:bg-card"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:px-8 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="font-display text-2xl tracking-tight text-forest sm:text-3xl dark:text-gold">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="relative bg-background">
        <div className="lynx-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Services"
            title="Four lanes. Full ownership."
            description="A focused menu — we only take work we can design, build, and stand behind ourselves."
          />
          <ul className="mt-14 grid gap-8 md:grid-cols-2">
            {services.map((service, index) => (
              <Reveal key={service.slug} as="li" delay={index * 0.05}>
                <Link
                  href={`/services#${service.slug}`}
                  className="group block border-t border-forest/20 pt-6 transition hover:border-gold dark:border-white/15"
                >
                  <h3 className="font-display text-2xl tracking-tight text-forest group-hover:underline dark:text-foreground">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {service.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-forest dark:text-gold">
                    Dig into {service.title.split(" ")[0].toLowerCase()}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            tone="inverse"
            eyebrow="Why Lynx"
            title="Direct ownership. Always on."
            description="You work with the people who design and ship — and you can reach us any hour, any day of the week."
          />
          <ul className="mt-14 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: "You talk to builders",
                copy: "Discovery, design, and code stay with the same people — so context never gets lost in a relay.",
              },
              {
                title: "Scope stays honest",
                copy: "We take what we can finish well. If a timeline or budget won’t work, we say so before you pay.",
              },
              {
                title: "Performance baked in",
                copy: "Speed, accessibility, and SEO are part of the first build — not a phase bolted on after launch.",
              },
              {
                title: "24×7 support",
                copy: "Reach us any hour, any day of the week. Production issues and launch questions don’t wait for Monday.",
              },
            ].map((item, index) => (
              <Reveal key={item.title} as="li" delay={index * 0.05}>
                <div className="border-t border-white/15 pt-6">
                  <h3 className="flex items-center gap-2 font-display text-xl tracking-tight">
                    <Check className="size-4 shrink-0 text-gold" />
                    {item.title}
                  </h3>
                  <p className="mt-3 text-white/70 leading-relaxed">
                    {item.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/80 bg-mist dark:bg-background">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Selected work"
              title="Live sites. Real businesses."
              description="Client websites across ecommerce, travel, platforms, and more — designed and shipped by Lynx."
            />
            <Link
              href="/work"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 shrink-0",
              )}
            >
              View all work
            </Link>
          </div>
          <div className="mt-12">
            <WorkFilterGrid compact />
          </div>
        </div>
      </section>

      <section
        id="process"
        className="border-t border-border/80 bg-background"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Process"
            title="Clear steps. No theater."
            description="A short engagement rhythm that keeps decisions visible and delivery honest."
          />
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Scope with teeth",
                copy: "We define outcomes, constraints, and the smallest shippable slice before a line of UI is drawn.",
              },
              {
                num: "02",
                title: "Design in motion",
                copy: "Brand, layout, and interaction land together so the first build already feels finished.",
              },
              {
                num: "03",
                title: "Ship and harden",
                copy: "Performance, accessibility, and handoff docs travel with the release — not as afterthoughts.",
              },
            ].map((step, index) => (
              <Reveal key={step.num} as="li" delay={index * 0.05}>
                <p className="font-display text-sm tracking-[0.18em] text-gold">
                  {step.num}
                </p>
                <h3 className="mt-3 font-display text-2xl tracking-tight text-forest dark:text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  {step.copy}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border/80 bg-mist dark:bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Plans"
              title="Packaged offers ready to book."
              description="Starter, Growth, and Premium website plans — clear scope, clear price, clear delivery windows."
            />
            <Link
              href="/plans"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 shrink-0",
              )}
            >
              View all plans
            </Link>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {sellablePlans.map((plan, index) => (
              <Reveal key={plan.slug} as="li" delay={index * 0.05}>
                <article
                  className={cn(
                    "flex h-full flex-col border-t pt-5",
                    plan.popular
                      ? "border-gold"
                      : "border-forest/20 dark:border-white/15",
                  )}
                >
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                    {plan.label}
                    {plan.popular ? " · Popular" : ""}
                  </p>
                  <h3 className="mt-2 font-display text-xl tracking-tight text-forest dark:text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-3 font-display text-3xl text-forest dark:text-gold">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
                    {plan.blurb}
                  </p>
                  <Link
                    href={`/contact?plan=${plan.slug}`}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-forest dark:text-gold"
                  >
                    Book {plan.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/80 bg-background">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Proof"
            title="Peer-to-peer, not brochure quotes."
          />
          <ul className="mt-14 grid gap-8 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <Reveal key={item.name} as="li" delay={index * 0.06}>
                <blockquote className="border-t border-forest/20 pt-6 dark:border-white/15">
                  <p className="text-foreground leading-relaxed">
                    “{item.quote}”
                  </p>
                  <footer className="mt-5">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.role}</p>
                  </footer>
                </blockquote>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-24">
          <div className="max-w-xl">
            <p className="font-display text-sm font-semibold tracking-[0.2em] text-gold uppercase">
              Next step
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-5xl">
              Tell us what you’re building.
            </h2>
            <p className="mt-4 text-white/70 sm:text-lg">
              Share scope, constraints, and timing. We’ll reply with fit and a
              first milestone — not a 40-slide pitch.
            </p>
          </div>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-gold px-6 text-gold-foreground hover:bg-gold/90",
            )}
          >
            Start a project
          </Link>
        </div>
      </section>
    </>
  );
}
