/** Human-readable labels for portal enums — never show raw snake_case in UI. */

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  refunded: "Refunded",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting response",
  opened: "Opened",
  accepted: "Accepted",
  converted: "In production",
  declined: "Declined",
  expired: "Expired",
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending: "Awaiting reply",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  intake: "Getting started",
  active: "In progress",
  review: "In review",
  launched: "Live",
  maintenance: "Maintenance",
  completed: "Delivered",
  paused: "Paused",
  archived: "Archived",
  // legacy aliases that may still appear in older rows
  retainer: "Maintenance",
  closed: "Archived",
  done: "Live",
};

/** Contact-form enquiries land here until advance payment converts them. */
export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "New enquiry",
  contacted: "In conversation",
  converted: "Became a client",
  archived: "Archived",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  upcoming: "Up next",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
  blocked: "Blocked",
};

/** Org health — never show raw "green"/"amber"/"red" in the UI. */
export const HEALTH_SCORE_LABEL: Record<string, string> = {
  green: "Healthy",
  amber: "Watch",
  red: "At risk",
};

export function labelOf(
  map: Record<string, string>,
  value: string | null | undefined,
  fallback?: string,
) {
  if (!value) return fallback ?? "—";
  return map[value] ?? fallback ?? value.replace(/_/g, " ");
}
