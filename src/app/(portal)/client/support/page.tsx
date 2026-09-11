import Link from "next/link";

import { createTicketAction } from "@/app/actions/portal";
import { FilterBar } from "@/components/portal/filter-bar";
import { PortalSelect } from "@/components/portal/select-field";
import { EmptyState } from "@/components/portal/shell";
import {
  Badge,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
} from "@/components/portal/ticket-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireClient } from "@/lib/auth/session";
import { fetchProjects, fetchTickets } from "@/lib/portal/data";
import { relativeTime } from "@/lib/portal/utils";

export const metadata = { title: "Support" };

export default async function ClientSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await requireClient();
  const [tickets, projects] = await Promise.all([
    fetchTickets(profile.organization_ids, { q: sp.q, status: sp.status }),
    fetchProjects(profile.organization_ids),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl">
            Support
          </h2>
        </div>

        <FilterBar
          basePath="/client/support"
          placeholder="Search your tickets…"
          resultCount={tickets.length}
          selects={[
            {
              name: "status",
              label: "Status",
            emptyLabel: "All statuses",
              options: [
                { value: "open", label: "Open" },
                { value: "pending", label: "Awaiting you" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ],
            },
          ]}
        />

        {tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            body="Use the form to raise your first request. Urgent issues are picked up the same day."
          />
        ) : (
          <ul className="divide-y divide-[#24302b] rounded-lg border border-[#24302b]">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/client/support/${ticket.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#121a17]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {String(ticket.subject)}
                    </p>
                    <p className="truncate font-mono text-xs text-[#9aaba2]">
                      {String(ticket.ticket_number ?? "")} ·{" "}
                      {relativeTime(
                        (ticket.last_reply_at as string) ??
                          (ticket.updated_at as string),
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge value={String(ticket.priority)} kind="priority" />
                    <Badge value={String(ticket.status)} kind="status" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        action={createTicketAction}
        className="h-fit space-y-3 rounded-lg border border-[#24302b] bg-[#121a17] p-4"
      >
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
          New ticket
        </h3>
        <div className="space-y-1">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            required
            placeholder="Checkout page shows a 500 error"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Type</Label>
          <PortalSelect
            id="category"
            name="category"
            label="Type"
            defaultValue="general"
            options={TICKET_CATEGORIES}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <PortalSelect
            id="priority"
            name="priority"
            label="Priority"
            defaultValue="normal"
            options={TICKET_PRIORITIES}
          />
        </div>
        {projects.length > 0 ? (
          <div className="space-y-1">
            <Label htmlFor="projectId">Related project</Label>
            <PortalSelect
              id="projectId"
              name="projectId"
              label="Related project"
              includeEmptyLabel="Not project specific"
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="body">What&apos;s happening?</Label>
          <Textarea
            id="body"
            name="body"
            rows={5}
            placeholder="Steps, browser/device, and anything else that helps us reproduce it."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="attachment">Screenshot</Label>
          <Input
            id="attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
          />
          <p className="font-mono text-[10px] text-[#5f6f68]">
            Optional · JPG, PNG, WEBP or GIF · under 8 MB
          </p>
        </div>
        <Button type="submit" className="w-full">
          Raise ticket
        </Button>
        <p className="text-[11px] text-[#9aaba2]">
          You&apos;ll get an email confirmation, and another whenever we reply.
        </p>
      </form>
    </div>
  );
}
