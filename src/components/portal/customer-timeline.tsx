"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AtSign,
  Banknote,
  CheckCircle2,
  FileText,
  Flag,
  LifeBuoy,
  MessageSquare,
  Receipt,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatDateTime } from "@/lib/portal/format";
import type { TimelineEvent, TimelineKind } from "@/lib/portal/timeline";
import { cn } from "@/lib/utils";

const KIND: Record<
  TimelineKind,
  { icon: LucideIcon; color: string; label: string }
> = {
  lead: { icon: UserPlus, color: "#d4b45a", label: "Lead" },
  quote: { icon: FileText, color: "#7eb8a8", label: "Quote" },
  invoice: { icon: Receipt, color: "#e0a458", label: "Invoice" },
  money: { icon: Banknote, color: "#5ecf9a", label: "Payment" },
  project: { icon: Sparkles, color: "#6eb4c8", label: "Project" },
  milestone: { icon: Flag, color: "#8fd4b0", label: "Milestone" },
  ticket: { icon: LifeBuoy, color: "#c07060", label: "Ticket" },
  message: { icon: MessageSquare, color: "#b9a1e8", label: "Message" },
  email: { icon: AtSign, color: "#9aaba2", label: "Email" },
  whatsapp: { icon: MessageSquare, color: "#5ecf9a", label: "WhatsApp" },
  system: { icon: CheckCircle2, color: "#5f6f68", label: "System" },
};

type FilterId = "all" | "money" | "comms" | "delivery" | "sales";

const FILTERS: Array<{ id: FilterId; label: string; kinds: TimelineKind[] }> = [
  { id: "all", label: "Everything", kinds: [] },
  { id: "money", label: "Money", kinds: ["money", "invoice"] },
  { id: "comms", label: "Conversations", kinds: ["email", "whatsapp", "message", "ticket"] },
  { id: "delivery", label: "Delivery", kinds: ["project", "milestone"] },
  { id: "sales", label: "Sales", kinds: ["lead", "quote"] },
];

function DayLabel({ at }: { at: string }) {
  const date = new Date(at);
  const label = Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
  return (
    <li className="sticky top-0 z-10 -mx-1 bg-[#0b1210]/95 px-1 py-1.5 backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6f68]">
        {label}
      </p>
    </li>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const [open, setOpen] = useState(false);
  const style = KIND[event.kind] ?? KIND.system;
  const Icon = style.icon;
  const toneColor =
    event.tone === "bad"
      ? "#c07060"
      : event.tone === "warn"
        ? "#d4b45a"
        : event.tone === "good"
          ? "#5ecf9a"
          : style.color;

  return (
    <li className="relative flex gap-3 pb-4 pl-1 last:pb-0">
      <div className="relative flex flex-col items-center">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full border"
          style={{
            borderColor: `${toneColor}55`,
            background: `${toneColor}14`,
            color: toneColor,
          }}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="mt-1 w-px flex-1 bg-[#1c2622]" aria-hidden />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68]">
            {formatDateTime(event.at)}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
        </div>

        {event.href ? (
          <Link
            href={event.href}
            className="mt-0.5 block text-sm leading-snug text-[#e8eee9] underline-offset-2 hover:underline"
          >
            {event.title}
          </Link>
        ) : (
          <p className="mt-0.5 text-sm leading-snug text-[#e8eee9]">{event.title}</p>
        )}

        {event.detail ? (
          <p className="mt-0.5 text-xs text-[#7a8a83]">{event.detail}</p>
        ) : null}

        {event.chips?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {event.chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[#24302b] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#9aaba2]"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {event.body ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6f68] transition-colors hover:text-[#d4b45a]"
            >
              {open ? "Hide message" : "Read message"}
            </button>
            {open ? (
              <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-[#1c2622] bg-[#0d1411] px-3 py-2.5 text-xs leading-relaxed text-[#c8d3cd]">
                {event.body}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The customer thread — every event on one relationship in one place, so
 * nobody has to reassemble the story from five separate tabs.
 */
export function CustomerTimeline({
  events,
  title = "Timeline",
  subtitle,
  emptyBody = "Nothing has happened on this relationship yet.",
}: {
  events: TimelineEvent[];
  title?: string;
  subtitle?: string;
  emptyBody?: string;
}) {
  const [filter, setFilter] = useState<FilterId>("all");

  const counts = useMemo(() => {
    const map: Record<FilterId, number> = {
      all: events.length,
      money: 0,
      comms: 0,
      delivery: 0,
      sales: 0,
    };
    for (const event of events) {
      for (const group of FILTERS) {
        if (group.id !== "all" && group.kinds.includes(event.kind)) {
          map[group.id] += 1;
        }
      }
    }
    return map;
  }, [events]);

  const visible = useMemo(() => {
    if (filter === "all") return events;
    const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? [];
    return events.filter((event) => kinds.includes(event.kind));
  }, [events, filter]);

  const grouped = useMemo(() => {
    const rows: Array<{ type: "day"; at: string } | { type: "event"; event: TimelineEvent }> = [];
    let lastDay = "";
    for (const event of visible) {
      const day = event.at.slice(0, 10);
      if (day !== lastDay) {
        rows.push({ type: "day", at: event.at });
        lastDay = day;
      }
      rows.push({ type: "event", event });
    }
    return rows;
  }, [visible]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#1c2622] bg-[#0b1210]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1c2622] px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b08d1f]">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-[#7a8a83]">
            {subtitle ?? "Every enquiry, quote, payment, message and milestone in order."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((group) => {
            const count = counts[group.id];
            if (group.id !== "all" && count === 0) return null;
            const active = filter === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setFilter(group.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                  active
                    ? "bg-[#b08d1f]/20 text-[#d4b45a]"
                    : "text-[#5f6f68] hover:bg-[#18201c] hover:text-[#9aaba2]",
                )}
              >
                {group.label}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[#5f6f68]">
          {events.length === 0 ? emptyBody : "No events in this filter."}
        </p>
      ) : (
        <ul className="max-h-[36rem] overflow-auto px-4 py-4">
          {grouped.map((row, index) =>
            row.type === "day" ? (
              <DayLabel key={`day-${row.at}-${index}`} at={row.at} />
            ) : (
              <EventRow key={row.event.id} event={row.event} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
