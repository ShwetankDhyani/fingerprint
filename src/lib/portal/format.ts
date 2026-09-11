/**
 * Display formatting shared by server and client components.
 * Keep this file free of node-only imports so client bundles can use it.
 */

const IST = "Asia/Kolkata";

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function paiseFromInr(rupees: number) {
  return Math.round(rupees * 100);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Date-only strings (YYYY-MM-DD) stay calendar dates; full timestamps get time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: IST,
    });
  }
  return formatDateTime(value);
}

/** Exact local (IST) timestamp — use for events instead of "2h ago". */
export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

/** @deprecated Prefer formatDateTime — kept so older call sites show exact times. */
export function relativeTime(value?: string | null) {
  return formatDateTime(value);
}

export function cliTime(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
