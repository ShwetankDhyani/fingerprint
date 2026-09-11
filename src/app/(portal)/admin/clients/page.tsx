import { ClientProfileCard } from "@/components/portal/client-profile-card";
import { CreateOrganizationSheet } from "@/components/portal/create-organization-sheet";
import { FilterBar } from "@/components/portal/filter-bar";
import { EmptyState } from "@/components/portal/shell";
import { fetchOrganizations } from "@/lib/portal/data";
import { summarizeFinancials } from "@/lib/portal/finance";
import {
  invoiceBalance,
  invoiceNeedsAction,
  quoteNeedsAction,
} from "@/lib/portal/money";

export const metadata = { title: "Clients" };

type OrgListRow = {
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
  projects?: Array<{ id: string; status?: string }> | null;
  invoices?: Array<{
    id: string;
    status: string;
    total_minor?: number | null;
    amount_paid_minor?: number | null;
  }> | null;
  quotes?: Array<{
    id: string;
    status: string;
    total_minor?: number | null;
    advance_minor?: number | null;
    paid_advance_minor?: number | null;
  }> | null;
};

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const orgs = (await fetchOrganizations({
    q: sp.q,
    from: sp.from,
    to: sp.to,
  })) as OrgListRow[];

  const profiles = orgs.map((org) => {
    const invoices = org.invoices ?? [];
    const quotes = org.quotes ?? [];
    const money = summarizeFinancials(invoices, quotes);
    const openInvoices = invoices.filter((inv) =>
      invoiceNeedsAction(
        String(inv.status),
        invoiceBalance(inv.total_minor, inv.amount_paid_minor),
      ),
    );
    const openQuoteCount = quotes.filter((q) =>
      quoteNeedsAction(String(q.status)),
    ).length;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      primary_contact_name: org.primary_contact_name,
      billing_email: org.billing_email,
      phone: org.phone,
      health_score: org.health_score,
      notes_internal: org.notes_internal,
      created_at: org.created_at,
      updated_at: org.updated_at,
      projectCount: (org.projects ?? []).length,
      openInvoiceCount: openInvoices.length,
      // Remaining on agreed quotes + open invoices — not just unpaid invoices.
      // Advance receipts only invoice the deposit; the rest stays pending here.
      outstandingMinor: money.outstanding,
      collectedMinor: money.paid,
      openQuoteCount,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-syne)] text-3xl tracking-tight">
            Clients
          </h2>
        </div>
        <CreateOrganizationSheet />
      </header>

      <FilterBar
        basePath="/admin/clients"
        placeholder="Search company, contact, email or phone…"
        resultCount={profiles.length}
        showDateRange
      />

      {profiles.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Add a client to start quotes, projects, and portal invites."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {profiles.map((org) => (
            <li key={org.id}>
              <ClientProfileCard org={org} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
