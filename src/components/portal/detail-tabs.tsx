"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DetailTab = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

/**
 * Work happens on the detail page: quotes, invoices, projects and tickets for
 * this one customer live here instead of sending staff back to global boards.
 */
export function DetailTabs({
  tabs,
  defaultTab,
  className,
}: {
  tabs: DetailTab[];
  defaultTab?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="tablist"
        aria-label="Customer records"
        className="flex flex-wrap gap-1 rounded-2xl border border-[#1c2622] bg-[#0d1411]/70 p-1.5"
      >
        {tabs.map((tab) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={cn(
                "rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                selected
                  ? "bg-[#18211d] text-[#e8eee9] ring-1 ring-[#d4b45a]/30"
                  : "text-[#5f6f68] hover:bg-[#121a17] hover:text-[#9aaba2]",
              )}
            >
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="ml-1.5 text-[#9aaba2]">{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
