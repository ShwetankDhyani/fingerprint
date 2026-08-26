import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { services, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Services",
  description:
    "High-end web development, custom SaaS engineering, ecommerce, and SEO/growth architecture from Lynx Web Solutions.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: `Services | ${siteConfig.name}`,
    description:
      "Deep-dive technical offerings: full-stack delivery, architecture consulting, and performance/SEO optimization.",
    url: `${siteConfig.url}/services`,
  },
};

export default function ServicesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/80 bg-mist dark:bg-card">
        <div className="lynx-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Services"
            title="What we actually take on."
            description="Architectural consulting, full-stack delivery, and performance/SEO work — scoped tightly and owned by the people who pitch it."
          />
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-6xl space-y-16 px-5 py-20 sm:px-8 sm:py-28">
          {services.map((service, index) => (
            <Reveal key={service.slug} delay={index * 0.04}>
              <article
                id={service.slug}
                className="scroll-mt-24 grid gap-8 border-t border-forest/20 pt-10 lg:grid-cols-[0.9fr_1.1fr] dark:border-white/15"
              >
                <div>
                  <h2 className="font-display text-3xl tracking-tight text-forest dark:text-foreground">
                    {service.title}
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {service.summary}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium tracking-wide text-foreground uppercase">
                    In practice
                  </h3>
                  <ul className="mt-4 space-y-3 text-muted-foreground">
                    {service.details.map((detail) => (
                      <li
                        key={detail}
                        className="border-l-2 border-gold/70 pl-4"
                      >
                        {detail}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-sm text-muted-foreground">
                    Engagements usually start with a scoped discovery or a
                    fixed first milestone — not an open-ended retainer by
                    default.
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-xl text-lg text-white/80">
            Not sure which lane fits? Send the brief — we’ll map it without the
            buzzword fog.
          </p>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
            )}
          >
            Start a project
          </Link>
        </div>
      </section>
    </>
  );
}
