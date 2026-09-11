import Link from "next/link";

import { formatDateTime, formatInr } from "@/lib/portal/format";
import { cn } from "@/lib/utils";

export type BoardRowMoney = {
  paid: number;
  pending: number;
  /** Shown above paid/pending — invoice total, quote value, etc. */
  headline?: number | null;
  /** Wording when nothing is outstanding. */
  settledLabel?: string;
};

/**
 * The one row pattern every board uses: who it is, what stage it's at, the
 * money split when money is involved, and when it last moved — then straight
 * into the detail page where the timeline lives. No second click to find out
 * what is going on.
 */
export function BoardRow({
  href,
  title,
  subtitle,
  meta,
  statusLabel,
  statusColor = "#9aaba2",
  money,
  at,
  atLabel = "updated",
  className,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  statusLabel: string;
  statusColor?: string;
  money?: BoardRowMoney | null;
  at?: string | null;
  atLabel?: string;
  className?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-start justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#121a17] focus-visible:bg-[#121a17] focus-visible:outline-none",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ background: statusColor }}
            title={statusLabel}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[#e8eee9]">{title}</p>
            {subtitle ? (
              <p className="truncate font-mono text-xs text-[#9aaba2]">
                {subtitle}
              </p>
            ) : null}
            {meta ? (
              <p className="mt-1 truncate text-xs text-[#7a8a83]">{meta}</p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right font-mono text-xs">
          {money?.headline != null ? (
            <p className="text-[#d4b45a]">{formatInr(Number(money.headline))}</p>
          ) : null}
          {money ? (
            <>
              <p className="text-emerald-400">{formatInr(money.paid)} paid</p>
              <p
                className={money.pending > 0 ? "text-[#d4b45a]" : "text-[#5f6f68]"}
              >
                {money.pending > 0
                  ? `${formatInr(money.pending)} pending`
                  : (money.settledLabel ?? "Settled")}
              </p>
            </>
          ) : null}
          <p style={{ color: statusColor }}>{statusLabel}</p>
          {at ? (
            <p className="text-[#5f6f68]">
              {atLabel} {formatDateTime(at)}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
