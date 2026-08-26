import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description:
    "Lynx Web Solutions has shipped web products since 2011 — India and global, for founders and product teams who want a direct line to the builders, and support any day of the week.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About | ${siteConfig.name}`,
    description:
      "A decade-plus of shipping. The Lynx story since 2011.",
    url: `${siteConfig.url}/about`,
  },
};

const milestones = [
  {
    year: "2011",
    title: "First builds",
    copy: "Started delivering client web work when responsive design was still a debate — learning production the hard way.",
  },
  {
    year: "2014–2019",
    title: "Craft under pressure",
    copy: "Took on denser product, ecommerce, and SEO work across India and international clients — still hands-on on every build.",
  },
  {
    year: "2020+",
    title: "Modern stack discipline",
    copy: "Standardized on modern React/Next architectures, design systems, and measurable Core Web Vitals as non-negotiables.",
  },
  {
    year: "Today",
    title: "Lynx Web Solutions",
    copy: "One brand, one standard. India hub + global delivery for founders who want clarity, not theater — and support any day of the week.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/80 bg-mist dark:bg-card">
        <div className="lynx-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="About"
            title="Over a decade of shipping — still hands-on."
            description="Lynx Web Solutions owns the work end to end. Peer-to-peer conversations with founders, CTOs, and operators — and support whenever you need it."
          />
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="font-display text-3xl tracking-tight text-forest dark:text-foreground">
                Engineering discipline. Direct execution.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="space-y-5 text-muted-foreground leading-relaxed sm:text-lg">
                <p>
                  We’ve been building for the web since {siteConfig.founded} —
                  long enough to remember when “mobile-first” was a slogan and
                  short enough to stay hungry about what ships next.
                </p>
                <p>
                  You always talk to the people designing and coding — not an
                  account layer. We take the work we can finish well, so each
                  project gets real attention. When something breaks or you need
                  a decision, we’re reachable 24×7.
                </p>
                <p>
                  We speak plainly. If a timeline is wrong, we say so. If SEO is
                  broken at the architecture layer, we fix the architecture — we
                  don’t sprinkle keywords on a slow site and call it growth.
                </p>
              </div>
            </Reveal>
          </div>

          <ol className="mt-20 grid gap-8 md:grid-cols-2">
            {milestones.map((item, index) => (
              <Reveal key={item.year} as="li" delay={index * 0.05}>
                <article className="border-t border-forest/20 pt-6 dark:border-white/15">
                  <p className="font-display text-sm tracking-[0.18em] text-gold uppercase">
                    {item.year}
                  </p>
                  <h3 className="mt-3 font-display text-2xl tracking-tight text-forest dark:text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {item.copy}
                  </p>
                </article>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-xl font-display text-2xl tracking-tight sm:text-3xl">
            Want the full capability map? See services — or skip ahead to a
            project brief.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/services"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white",
              )}
            >
              Services
            </Link>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 bg-gold text-gold-foreground hover:bg-gold/90",
              )}
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
