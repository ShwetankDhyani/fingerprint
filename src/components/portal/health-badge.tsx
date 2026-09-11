import { HEALTH_SCORE_LABEL, labelOf } from "@/lib/portal/labels";
import { cn } from "@/lib/utils";

/**
 * Human org health — never print the raw enum ("green").
 * Healthy is quiet (Apple/Google: no news is good news for amber/red only
 * when you want silence; here we still show Healthy so the column isn't empty).
 */
export function HealthBadge({
  score,
  quietHealthy = false,
  className,
}: {
  score?: string | null;
  /** When true, hide the badge entirely for healthy orgs. */
  quietHealthy?: boolean;
  className?: string;
}) {
  const key = String(score ?? "green").toLowerCase();
  if (quietHealthy && key === "green") return null;

  const label = labelOf(HEALTH_SCORE_LABEL, key, "Healthy");
  const tone =
    key === "red"
      ? {
          dot: "bg-red-400",
          text: "text-red-300",
          ring: "border-red-400/25 bg-red-400/10",
        }
      : key === "amber"
        ? {
            dot: "bg-amber-400",
            text: "text-amber-300",
            ring: "border-amber-400/25 bg-amber-400/10",
          }
        : {
            dot: "bg-emerald-400",
            text: "text-emerald-300/90",
            ring: "border-emerald-400/20 bg-emerald-400/10",
          };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        tone.ring,
        tone.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {label}
    </span>
  );
}
