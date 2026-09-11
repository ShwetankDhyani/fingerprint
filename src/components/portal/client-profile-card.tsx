import Link from "next/link";

import { ClientAvatar, clientPalette } from "@/components/portal/client-avatar";
import { HealthBadge } from "@/components/portal/health-badge";
import { formatDateTime, formatInr } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export type ClientProfileSummary = {
  id: string;
  name: string;
  slug?: string | null;
  primary_contact_name?: string | null;
  billing_email?: string | null;
  phone?: string | null;
  health_score?: string | null;
  notes_internal?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  projectCount: number;
  openInvoiceCount: number;
  outstandingMinor: number;
  collectedMinor?: number;
  openQuoteCount: number;
};

export function ClientProfileCard({ org }: { org: ClientProfileSummary }) {
  const palette = clientPalette(org.name);
  const contact =
    org.primary_contact_name || org.billing_email || org.slug || "—";
  const notes = (org.notes_internal ?? "").trim();
  const notesPreview =
    notes.length > 110 ? `${notes.slice(0, 110).trim()}…` : notes;

  return (
    <Link
      href={`/admin/clients/${org.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-[#1c2622] transition-all duration-200",
        "hover:border-[#d4b45a]/35 hover:bg-[#121a17]",
      )}
      style={{
        background: `linear-gradient(135deg, ${palette.from}88, #0d1411 55%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
        style={{ background: palette.accent }}
      />
      <div className="relative flex gap-4 p-5">
        <ClientAvatar name={org.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-[family-name:var(--font-syne)] text-lg tracking-tight text-[#f0f4f1]">
              {org.name}
            </h3>
            <HealthBadge score={org.health_score} quietHealthy />
          </div>
          <p className="mt-0.5 truncate text-sm text-[#9aaba2]">
            {contact}
            {org.primary_contact_name && org.billing_email
              ? ` · ${org.billing_email}`
              : ""}
            {org.phone ? ` · ${org.phone}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#7a8a83]">
            <span>
              <span className="text-[#5f6f68]">Projects</span>{" "}
              <span className="text-[#c8d3cd]">{org.projectCount}</span>
            </span>
            <span>
              <span className="text-[#5f6f68]">Paid</span>{" "}
              <span className="text-[#5ecf9a]">
                {formatInr(org.collectedMinor ?? 0)}
              </span>
            </span>
            <span>
              <span className="text-[#5f6f68]">Pending</span>{" "}
              <span
                className={
                  org.outstandingMinor > 0 ? "text-[#d4b45a]" : "text-[#c8d3cd]"
                }
              >
                {org.outstandingMinor > 0
                  ? formatInr(org.outstandingMinor)
                  : "settled"}
              </span>
              {org.openInvoiceCount > 0 ? (
                <span className="text-[#5f6f68]">
                  {" "}
                  · {org.openInvoiceCount} inv
                </span>
              ) : null}
            </span>
            <span>
              <span className="text-[#5f6f68]">Quotes</span>{" "}
              <span className="text-[#c8d3cd]">{org.openQuoteCount}</span>
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f6f68]">
            last activity {formatDateTime(org.updated_at ?? org.created_at)}
          </p>

          {notesPreview ? (
            <p className="mt-3 line-clamp-2 rounded-lg border border-[#24302b]/80 bg-[#0b1210]/50 px-3 py-2 text-xs leading-relaxed text-[#9aaba2]">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#b08d1f]/80">
                Notes ·{" "}
              </span>
              {notesPreview}
            </p>
          ) : (
            <p className="mt-3 text-xs text-[#4a5852]">No pitch notes yet</p>
          )}
        </div>
        <span className="shrink-0 self-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6f68] transition-colors group-hover:text-[#d4b45a]">
          Open →
        </span>
      </div>
    </Link>
  );
}
