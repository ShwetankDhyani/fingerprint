import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Primary work queue. */
export function ActionLane({
  title,
  hint,
  count,
  href,
  hrefLabel = "View all",
  children,
  className,
}: {
  title: string;
  hint?: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-syne)] text-lg text-[#e8eee9]">
            {href ? (
              <Link
                href={href}
                className="transition-colors hover:text-[#d4b45a]"
              >
                {title}
              </Link>
            ) : (
              title
            )}
            {typeof count === "number" ? (
              <span className="ml-2 font-mono text-sm text-[#d4b45a]">
                {count}
              </span>
            ) : null}
          </h3>
          {hint ? <p className="mt-0.5 text-sm text-[#9aaba2]">{hint}</p> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
          >
            {hrefLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Secondary / quieter queue — collapsed by default. */
export function SettledLane({
  title,
  hint,
  count,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  hint?: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-lg border border-[#1c2622] bg-[#0d1411]/60 open:bg-[#0d1411]",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div>
          <p className="font-[family-name:var(--font-syne)] text-base text-[#c8d3cd]">
            {title}
            {typeof count === "number" ? (
              <span className="ml-2 font-mono text-sm text-[#5f6f68]">
                {count}
              </span>
            ) : null}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-[#5f6f68]">{hint}</p> : null}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68]">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-[#1c2622] px-1 pb-1 pt-0">{children}</div>
    </details>
  );
}

export function LaneList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-[#24302b] overflow-visible rounded-lg border border-[#24302b]">
      {children}
    </ul>
  );
}
