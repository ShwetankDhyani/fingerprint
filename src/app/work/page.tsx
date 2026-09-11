import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { WorkFilterGrid } from "@/components/work/work-filter-grid";
import { buttonVariants } from "@/components/ui/button";
import { portfolioProjects, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Live client websites built by Lynx Web Solutions — ecommerce, travel, platforms, corporate, and wellness.",
  alternates: { canonical: "/work" },
  openGraph: {
    title: `Work | ${siteConfig.name}`,
    description:
      "Filterable portfolio of Lynx client websites across India and global markets.",
    url: `${siteConfig.url}/work`,
  },
};

export default function WorkPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/80 bg-mist dark:bg-card">
        <div className="lynx-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionHeading
            eyebrow="Work"
            title="Live sites. Real businesses."
            description={`A curated selection of ${portfolioProjects.length} live sites — product platforms and brand work first, then the broader Lynx portfolio. Filter by lane and open any project.`}
          />
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <WorkFilterGrid />
        </div>
      </section>

      <section className="border-t border-border/80 bg-forest text-primary-foreground dark:bg-[#07110d]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-xl text-lg text-white/80">
            Building something in the same league? Start with a short intake —
            we’ll tell you quickly if we’re the right fit.
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
