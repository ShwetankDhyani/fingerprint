import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { cn } from "@/lib/utils";

export const TICKET_CATEGORIES = [
  { value: "bug", label: "Something is broken" },
  { value: "change", label: "Change request" },
  { value: "billing", label: "Billing or invoice" },
  { value: "timeline", label: "Timeline or delivery" },
  { value: "access", label: "Access or login" },
  { value: "general", label: "General question" },
];

export const TICKET_PRIORITIES = [
  { value: "low", label: "Low — whenever" },
  { value: "normal", label: "Normal — this week" },
  { value: "high", label: "High — blocking work" },
  { value: "urgent", label: "Urgent — site down" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "border-[#d4b45a]/40 bg-[#d4b45a]/10 text-[#d4b45a]",
  pending: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  resolved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  closed: "border-[#3a463f] bg-[#1a2420] text-[#9aaba2]",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-[#3a463f] bg-[#1a2420] text-[#9aaba2]",
  normal: "border-[#3a463f] bg-[#1a2420] text-[#c8d3cd]",
  high: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  urgent: "border-red-400/50 bg-red-500/10 text-red-300",
};

export function Badge({
  value,
  kind,
}: {
  value: string;
  kind: "status" | "priority";
}) {
  const map = kind === "status" ? STATUS_STYLES : PRIORITY_STYLES;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        map[value] ?? "border-[#3a463f] bg-[#1a2420] text-[#9aaba2]",
      )}
    >
      {kind === "status"
        ? labelOf(TICKET_STATUS_LABEL, value)
        : labelOf(TICKET_PRIORITY_LABEL, value)}
    </span>
  );
}
