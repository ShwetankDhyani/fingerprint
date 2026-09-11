"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type ActivityKind =
  | "money"
  | "project"
  | "quote"
  | "message"
  | "system";

export type ActivityLine = {
  ts: string;
  text: string;
  kind?: ActivityKind;
  action?: string | null;
  entityType?: string | null;
  href?: string | null;
};

const FILTERS: { id: "all" | ActivityKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "money", label: "Money" },
  { id: "project", label: "Projects" },
  { id: "quote", label: "Quotes" },
  { id: "message", label: "Messages" },
  { id: "system", label: "System" },
];

const KIND_STYLE: Record<
  ActivityKind,
  { dot: string; label: string; text: string; chip: string }
> = {
  money: {
    dot: "bg-emerald-400",
    label: "text-emerald-400",
    text: "text-emerald-50/90",
    chip: "Money",
  },
  project: {
    dot: "bg-[#d4b45a]",
    label: "text-[#d4b45a]",
    text: "text-[#f0e6c8]",
    chip: "Project",
  },
  quote: {
    dot: "bg-sky-400",
    label: "text-sky-400",
    text: "text-sky-50/90",
    chip: "Quote",
  },
  message: {
    dot: "bg-amber-400",
    label: "text-amber-400",
    text: "text-amber-50/90",
    chip: "Message",
  },
  system: {
    dot: "bg-[#6a7a72]",
    label: "text-[#9aaba2]",
    text: "text-[#c8d3cd]",
    chip: "System",
  },
};

/** Infer a kind when the row wasn't tagged upstream. */
export function classifyActivity(input: {
  action?: string | null;
  entityType?: string | null;
  text?: string | null;
}): ActivityKind {
  const action = String(input.action ?? "").toLowerCase();
  const entity = String(input.entityType ?? "").toLowerCase();
  const text = String(input.text ?? "").toLowerCase();
  const blob = `${action} ${entity} ${text}`;

  if (
    /payment|paid|invoice|advance|collect|cashfree|refund/.test(blob) ||
    entity === "invoice" ||
    entity === "payment" ||
    action === "paid"
  ) {
    return "money";
  }
  if (
    /quote|quotation|proposal/.test(blob) ||
    entity === "quote" ||
    action === "sent" && entity === "quote"
  ) {
    return "quote";
  }
  if (
    /milestone|project|kickoff|snapshot|progress|launched|intake/.test(blob) ||
    entity === "project" ||
    entity === "milestone" ||
    entity === "snapshot"
  ) {
    return "project";
  }
  if (
    /ticket|message|thread|reply|inbox|support/.test(blob) ||
    entity === "ticket" ||
    entity === "thread" ||
    entity === "message"
  ) {
    return "message";
  }
  return "system";
}

/**
 * Color-coded activity stream with type filters — scannable at a glance,
 * unlike a flat mono terminal dump.
 */
export function ActivityFeed({
  lines,
  accent = "gold",
}: {
  lines: ActivityLine[];
  /** Panel chrome accent — team profiles use teal. */
  accent?: "gold" | "teal";
}) {
  const accentClass =
    accent === "teal" ? "text-[#6eb4c8]" : "text-[#b08d1f]";
  const activeChip =
    accent === "teal"
      ? "bg-[#6eb4c8]/20 text-[#6eb4c8]"
      : "bg-[#b08d1f]/20 text-[#d4b45a]";
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");

  const enriched = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        kind:
          line.kind ??
          classifyActivity({
            action: line.action,
            entityType: line.entityType,
            text: line.text,
          }),
      })),
    [lines],
  );

  const visible =
    filter === "all"
      ? enriched
      : enriched.filter((line) => line.kind === filter);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: enriched.length };
    for (const line of enriched) {
      map[line.kind] = (map[line.kind] ?? 0) + 1;
    }
    return map;
  }, [enriched]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#24302b] bg-[#0b1210]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24302b] px-3 py-2">
        <p className={cn("font-mono text-[10px] uppercase tracking-[0.18em]", accentClass)}>
          Activity
        </p>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => {
            const count = counts[item.id] ?? 0;
            if (item.id !== "all" && count === 0) return null;
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                  active
                    ? activeChip
                    : "text-[#5f6f68] hover:bg-[#18201c] hover:text-[#9aaba2]",
                )}
              >
                {item.label}
                {item.id !== "all" ? (
                  <span className="ml-1 opacity-70">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <ul className="max-h-80 space-y-0 overflow-auto p-1.5">
        {visible.length === 0 ? (
          <li className="px-2 py-6 text-center text-xs text-[#9aaba2]">
            {enriched.length === 0
              ? "Nothing logged yet."
              : "No events in this filter."}
          </li>
        ) : (
          visible.map((line, i) => {
            const style = KIND_STYLE[line.kind];
            return (
              <li
                key={`${line.ts}-${line.text}-${i}`}
                className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-[#121a17]"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    style.dot,
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[10px] text-[#5f6f68]">
                      {line.ts}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.1em]",
                        style.label,
                      )}
                    >
                      {style.chip}
                    </span>
                  </div>
                  {line.href ? (
                    <Link
                      href={line.href}
                      className={cn(
                        "mt-0.5 block text-xs leading-snug wrap-break-word underline-offset-2 hover:underline",
                        style.text,
                      )}
                    >
                      {line.text}
                    </Link>
                  ) : (
                    <p
                      className={cn(
                        "mt-0.5 text-xs leading-snug wrap-break-word",
                        style.text,
                      )}
                    >
                      {line.text}
                    </p>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
