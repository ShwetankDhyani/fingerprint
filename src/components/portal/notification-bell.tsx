"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { markNotificationsReadAction } from "@/app/actions/notifications";
import { formatDateTime } from "@/lib/portal/format";
import { cn } from "@/lib/utils";

export type BellItem = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
};

const KIND_COLOR: Record<string, string> = {
  lead: "#6eb4c8",
  quote: "#d4b45a",
  money: "#5ecf9a",
  ticket: "#c07060",
  project: "#a48fd0",
  system: "#9aaba2",
};

/**
 * Tells the team something happened without them having to guess which tab to
 * open. Reading an item is a real write, so the count is the same on every
 * device rather than a per-browser guess.
 */
export function NotificationBell({
  items,
  unread,
}: {
  items: BellItem[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0 ? `${unread} unread notifications` : "Notifications"
        }
        aria-expanded={open}
        className={cn(
          "relative grid size-9 place-items-center rounded-full border border-[#24302b] text-[#c8d3cd] transition-colors",
          "hover:border-[#d4b45a]/40 hover:text-[#d4b45a]",
          open && "border-[#d4b45a]/40 text-[#d4b45a]",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[#d4b45a] px-1 font-mono text-[10px] font-semibold leading-4 text-[#0b1210]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#24302b] bg-[#0d1411] shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-[#24302b] px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
              needs attention
            </p>
            {unread > 0 ? (
              <form action={markNotificationsReadAction}>
                <button
                  type="submit"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
                >
                  mark all read
                </button>
              </form>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[#5f6f68]">
              Nothing waiting on you.
            </p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-[#1c2622] overflow-auto">
              {items.map((item) => {
                const dot = KIND_COLOR[item.kind] ?? KIND_COLOR.system;
                const inner = (
                  <div className="flex gap-2.5 px-3 py-2.5">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: item.read_at ? "#2c3a34" : dot }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          item.read_at
                            ? "text-[#8a978f]"
                            : "font-medium text-[#e8eee9]",
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-[#7a8a83]">
                        {item.body}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[#5f6f68]">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id} className="hover:bg-[#121a17]">
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
