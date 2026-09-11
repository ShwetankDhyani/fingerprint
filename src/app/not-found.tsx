import Link from "next/link";
import { LynxLogo } from "@/components/brand/lynx-logo";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden bg-mist dark:bg-card">
      <div className="lynx-grid absolute inset-0 opacity-30" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-start px-5 py-28 sm:px-8 sm:py-36">
        <LynxLogo href={null} size="md" />
        <p className="mt-8 font-display text-sm tracking-[0.2em] text-forest/60 uppercase dark:text-gold/80">
          404
        </p>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-forest sm:text-5xl dark:text-foreground">
          Page not found.
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          That URL isn’t part of {siteConfig.shortName}. Head home, browse plans,
          or send a brief — we’ll help you find the right next step.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground",
            )}
          >
            Back home
          </Link>
          <Link
            href="/plans"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
          >
            View plans
          </Link>
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11")}
          >
            Contact
          </Link>
        </div>
      </div>
    </section>
  );
}
