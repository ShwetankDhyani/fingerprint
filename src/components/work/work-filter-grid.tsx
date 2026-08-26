"use client";

import { useMemo, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { PortfolioCard } from "@/components/work/portfolio-card";
import { portfolioCategories, portfolioProjects } from "@/lib/site";
import { cn } from "@/lib/utils";

export function WorkFilterGrid({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [filter, setFilter] =
    useState<(typeof portfolioCategories)[number]>("All");

  const items = useMemo(() => {
    const base =
      filter === "All"
        ? [...portfolioProjects]
        : portfolioProjects.filter((item) => item.category === filter);

    if (!compact) return base;

    const featured = base.filter((item) => item.featured);
    return (featured.length >= 4 ? featured : base).slice(0, 6);
  }, [filter, compact]);

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter work by category"
      >
        {portfolioCategories.map((item) => {
          const active = filter === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                active
                  ? "border-forest bg-forest text-primary-foreground dark:border-gold dark:bg-gold dark:text-gold-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-forest/40 hover:text-foreground",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          No projects in this category yet.
        </p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project, index) => (
            <Reveal
              key={project.slug}
              as="li"
              delay={index * 0.04}
              className={cn(
                !compact && index === 0 && filter === "All" && "sm:col-span-2 lg:col-span-2",
              )}
            >
              <PortfolioCard
                project={project}
                featured={!compact && index === 0 && filter === "All"}
              />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
