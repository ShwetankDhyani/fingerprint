"use client";

import { ActivityFeed, type ActivityLine } from "@/components/portal/activity-feed";
import { cn } from "@/lib/utils";

/** Activity stays collapsed until opened. */
export function ActivityPanel({
  lines,
  className,
}: {
  lines: ActivityLine[];
  className?: string;
}) {
  const count = lines.length;

  return (
    <details
      className={cn(
        "group rounded-xl border border-[#1c2622] bg-[#0d1411]/50 open:bg-[#0d1411]",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <p className="font-[family-name:var(--font-syne)] text-base text-[#c8d3cd]">
          Activity
          <span className="ml-2 font-mono text-sm text-[#5f6f68]">{count}</span>
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] group-open:hidden">
          Show
        </span>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aaba2] group-open:inline">
          Hide
        </span>
      </summary>
      <div className="border-t border-[#1c2622] p-3">
        <ActivityFeed lines={lines} />
      </div>
    </details>
  );
}
