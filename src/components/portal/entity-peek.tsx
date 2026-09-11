"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PeekFact = { label: string; value: string };

export type PeekTone = "gold" | "green" | "red" | "muted";

export type EntityPeekData = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: PeekTone;
  facts: PeekFact[];
  href?: string;
  hrefLabel?: string;
};

const TONE: Record<PeekTone, string> = {
  gold: "text-[#d4b45a]",
  green: "text-emerald-400",
  red: "text-red-400",
  muted: "text-[#9aaba2]",
};

function PeekCard({ data }: { data: EntityPeekData }) {
  return (
    <div className="rounded-xl border border-[#2a3832] bg-[#0c1411] p-3.5 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.95)]">
      {data.eyebrow ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
          {data.eyebrow}
        </p>
      ) : null}
      <p className="mt-0.5 font-[family-name:var(--font-syne)] text-sm text-[#e8eee9]">
        {data.title}
      </p>
      {data.subtitle ? (
        <p className="mt-0.5 text-xs text-[#9aaba2]">{data.subtitle}</p>
      ) : null}
      {data.statusLabel ? (
        <p
          className={cn(
            "mt-2 font-mono text-[10px] uppercase tracking-[0.14em]",
            TONE[data.statusTone ?? "muted"],
          )}
        >
          {data.statusLabel}
        </p>
      ) : null}
      <dl className="mt-2.5 space-y-1.5 border-t border-[#24302b] pt-2.5">
        {data.facts.map((fact) => (
          <div
            key={`${fact.label}-${fact.value}`}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68]">
              {fact.label}
            </dt>
            <dd className="text-right text-xs text-[#c8d3cd]">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {data.href ? (
        <Link
          href={data.href}
          className="mt-3 inline-flex font-mono text-[11px] text-[#d4b45a] underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {data.hrefLabel ?? "Open details →"}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Hover / focus detail — expands under the row so it never covers siblings.
 */
export function EntityPeek({
  data,
  children,
  className,
}: {
  data: EntityPeekData;
  children: ReactNode;
  className?: string;
  side?: "right" | "left" | "bottom";
}) {
  return (
    <div className={cn("group/peek", className)}>
      {children}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          "grid-rows-[0fr] group-hover/peek:grid-rows-[1fr] group-focus-within/peek:grid-rows-[1fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3 pt-0">
            <PeekCard data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Clickable row with inline peek. */
export function PeekRow({
  href,
  peek,
  children,
  className,
}: {
  href: string;
  peek: EntityPeekData;
  children: ReactNode;
  className?: string;
  side?: "right" | "left" | "bottom";
}) {
  return (
    <EntityPeek data={{ ...peek, href }}>
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#121a17] focus-visible:bg-[#121a17] focus-visible:outline-none",
          className,
        )}
      >
        {children}
      </Link>
    </EntityPeek>
  );
}
