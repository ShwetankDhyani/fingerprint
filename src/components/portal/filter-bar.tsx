"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";

import { PortalSelect } from "@/components/portal/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FilterOption = { value: string; label: string };

export type FilterSelect = {
  /** Query-string key, e.g. "status". */
  name: string;
  /** Accessible name for the control, e.g. "Status". */
  label: string;
  /** Shown when nothing is selected, e.g. "All statuses". Defaults to label. */
  emptyLabel?: string;
  options: FilterOption[];
};

/**
 * Debounced search + dropdown filters that write straight to the URL, so every
 * list page stays server-rendered, shareable and back-button friendly.
 */
export function FilterBar({
  basePath,
  placeholder = "Search…",
  selects = [],
  showDateRange = false,
  resultCount,
}: {
  basePath: string;
  placeholder?: string;
  selects?: FilterSelect[];
  showDateRange?: boolean;
  resultCount?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) push(next);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeCount = [...params.keys()].filter((key) =>
    ["q", "status", "priority", "health", "from", "to", "org"].includes(key),
  ).length;

  return (
    <div className="space-y-3 rounded-lg border border-[#24302b] bg-[#121a17] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#9aaba2]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="pl-8"
            aria-label="Search"
          />
        </div>
        {selects.map((select) => (
          <PortalSelect
            key={select.name}
            label={select.label}
            value={params.get(select.name) ?? ""}
            onValueChange={(value) => setParam(select.name, value)}
            includeEmptyLabel={select.emptyLabel ?? select.label}
            options={select.options}
            className="sm:w-44"
          />
        ))}
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push(new URLSearchParams())}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      {showDateRange ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#9aaba2]">
          <label className="flex items-center gap-1.5">
            From
            <Input
              type="date"
              value={params.get("from") ?? ""}
              onChange={(event) => setParam("from", event.target.value)}
              className="h-7 w-auto [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <Input
              type="date"
              value={params.get("to") ?? ""}
              onChange={(event) => setParam("to", event.target.value)}
              className="h-7 w-auto [color-scheme:dark]"
            />
          </label>
        </div>
      ) : null}

      <p
        className={
          pending
            ? "font-mono text-[11px] text-[#9aaba2] opacity-50"
            : "font-mono text-[11px] text-[#9aaba2]"
        }
      >
        {typeof resultCount === "number"
          ? `${resultCount} result${resultCount === 1 ? "" : "s"}`
          : ""}
        {pending ? " · updating…" : ""}
      </p>
    </div>
  );
}
