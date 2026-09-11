import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Stacked proportion bar — color first, labels second. */
export function Meter({
  segments,
  className,
}: {
  segments: Array<{ pct: number; color: string; label: string }>;
  className?: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, s) => sum + Math.max(0, s.pct), 0),
  );
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#18201c]">
        {segments.map((s) => (
          <div
            key={s.label}
            className="h-full transition-[width]"
            style={{
              width: `${(Math.max(0, s.pct) / total) * 100}%`,
              background: s.color,
            }}
            title={s.label}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#7a8a83]"
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Big-number board tile. Prefer links so the glance strip doubles as filters. */
export function GlanceTile({
  href,
  eyebrow,
  value,
  unit,
  hint,
  accent,
  glow,
  meter,
  children,
  className,
}: {
  href?: string;
  eyebrow: string;
  value: string;
  unit?: string;
  hint: string;
  accent: string;
  glow: string;
  meter?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70"
        style={{ background: glow }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
      />
      <div className="relative pl-2">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </p>
        <div className="mt-2 flex items-end gap-2">
          <p className="font-[family-name:var(--font-syne)] text-4xl tracking-tight text-[#f0f4f1] sm:text-5xl">
            {value}
          </p>
          {unit ? (
            <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-[#7a8a83]">
              {unit}
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[#9aaba2]">{hint}</p>
        {meter ? <div className="mt-4">{meter}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </>
  );

  const shell =
    "group relative overflow-hidden rounded-2xl border border-[#1c2622] bg-[#0d1411]/90 p-4 transition-colors hover:border-[#2a3832] sm:p-5";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(shell, className)}
        style={{ boxShadow: `inset 0 1px 0 ${accent}22` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={cn(shell, className)}
      style={{ boxShadow: `inset 0 1px 0 ${accent}22` }}
    >
      {inner}
    </div>
  );
}

export function AmountBar({
  value,
  max,
  color,
  className,
}: {
  value: number;
  max: number;
  color: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cn(
        "mt-2 h-1.5 overflow-hidden rounded-full bg-[#18201c]",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Compact status stage chips — reads as a pipeline, not a dropdown. */
export function StageStrip({
  stages,
  className,
}: {
  stages: Array<{
    key: string;
    label: string;
    count: number;
    href: string;
    color: string;
    active?: boolean;
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-2xl border border-[#1c2622] bg-[#0d1411]/70 p-2",
        className,
      )}
    >
      {stages.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          className={cn(
            "inline-flex min-w-[5.5rem] flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
            s.active
              ? "border-transparent bg-[#141c19]"
              : "border-transparent hover:bg-[#121a17]",
          )}
          style={
            s.active
              ? { boxShadow: `inset 0 0 0 1px ${s.color}55` }
              : undefined
          }
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: s.color }}
          />
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a8a83]">
              {s.label}
            </span>
            <span className="font-[family-name:var(--font-syne)] text-xl text-[#eef3ef]">
              {s.count}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function VisualEmpty({
  title,
  body,
  steps,
}: {
  title: string;
  body: string;
  steps?: Array<{ label: string; detail: string; color: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-dashed border-[#24302b] bg-[#0d1411]/40 px-5 py-10">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-[family-name:var(--font-syne)] text-xl text-[#e8eee9]">
          {title}
        </p>
        <p className="mt-2 text-sm text-[#9aaba2]">{body}</p>
      </div>
      {steps && steps.length > 0 ? (
        <ol className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className="relative rounded-xl border border-[#1c2622] bg-[#0b1210]/80 px-3 py-3 text-left"
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: step.color }}
              >
                {String(i + 1).padStart(2, "0")} · {step.label}
              </span>
              <p className="mt-1 text-sm text-[#c8d3cd]">{step.detail}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
