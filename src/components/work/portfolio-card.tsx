import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PortfolioItem = {
  slug: string;
  title: string;
  category: string;
  industry: string;
  market: string;
  summary: string;
  url: string;
  logo: string;
  featured?: boolean;
};

export function PortfolioCard({
  project,
  className,
  featured = false,
}: {
  project: PortfolioItem;
  className?: string;
  featured?: boolean;
}) {
  const host = project.url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .split("/")[0];

  return (
    <article
      id={project.slug}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-forest/10 bg-card/70 transition duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_24px_60px_-36px_rgba(15,61,46,0.55)] dark:border-white/10 dark:bg-card/50 dark:hover:border-gold/40",
        featured && "md:col-span-2 md:grid md:grid-cols-[0.9fr_1.1fr] md:items-stretch",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center bg-mist/80 p-8 dark:bg-[#0f1714]",
          featured ? "min-h-48 md:min-h-full" : "min-h-40",
        )}
      >
        <div className="lynx-grid absolute inset-0 opacity-30" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/40 to-transparent dark:from-background/30" />
        <Image
          src={project.logo}
          alt={`${project.title} logo`}
          width={featured ? 220 : 160}
          height={featured ? 88 : 64}
          className="relative z-10 max-h-16 w-auto object-contain md:max-h-20"
        />
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{project.category}</Badge>
          <span className="text-xs text-muted-foreground">{project.industry}</span>
          <span className="text-xs text-muted-foreground">· {project.market}</span>
        </div>
        <h3
          className={cn(
            "mt-4 font-display tracking-tight text-forest dark:text-foreground",
            featured ? "text-2xl sm:text-3xl" : "text-xl",
          )}
        >
          {project.title}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
          {project.summary}
        </p>
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-forest transition group-hover:text-gold dark:text-gold"
        >
          Visit {host}
          <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </article>
  );
}
