import Link from "next/link";
import { notFound } from "next/navigation";

import {
  replyTicketAction,
  updateTicketAction,
  deleteThreadAction,
} from "@/app/actions/portal";
import { ChatThread, type ChatMessageData } from "@/components/portal/chat-message";
import { PortalSelect } from "@/components/portal/select-field";
import { Badge } from "@/components/portal/ticket-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  labelOf,
} from "@/lib/portal/labels";
import { fetchTicket } from "@/lib/portal/data";
import { getPortalProfile, isSuperAdminRole } from "@/lib/auth/session";
import { SuperAdminDeleteButton } from "@/components/portal/super-admin-delete";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await fetchTicket(id);
  if (!ticket) notFound();
  const actor = await getPortalProfile();
  const isSuperAdmin = actor ? isSuperAdminRole(actor.role) : false;

  const org = ticket.organizations as {
    name?: string;
    billing_email?: string;
    phone?: string;
  } | null;
  const project = ticket.projects as { id?: string; name?: string } | null;
  const messages = (
    (ticket.messages as Array<Record<string, unknown>>) ?? []
  )
    .map((message) => ({
      id: String(message.id),
      body: String(message.body ?? ""),
      created_at: String(message.created_at ?? ""),
      author_id: message.author_id ? String(message.author_id) : null,
      internal_only: Boolean(message.internal_only),
      attachments: Array.isArray(message.attachments)
        ? (message.attachments as ChatMessageData["attachments"])
        : [],
      profiles: (message.profiles as ChatMessageData["profiles"]) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {String(ticket.ticket_number ?? "Ticket")}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl">
            {String(ticket.subject)}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#9aaba2]">
            {org?.name ?? "—"}
            {org?.billing_email ? ` · ${org.billing_email}` : ""}
            {org?.phone ? ` · ${org.phone}` : ""}
            {project?.name ? ` · ${project.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={String(ticket.priority)} kind="priority" />
          <Badge value={String(ticket.status)} kind="status" />
          <Link
            href="/admin/tickets"
            className="font-mono text-xs text-[#9aaba2] underline-offset-4 hover:underline"
          >
            All tickets
          </Link>
          {isSuperAdmin ? (
            <SuperAdminDeleteButton
              action={deleteThreadAction}
              entityLabel="ticket"
              consequence="All messages in this ticket are removed."
              hidden={{
                threadId: String(ticket.id),
                returnTo: "/admin/tickets",
              }}
              buttonLabel="Delete ticket"
            />
          ) : null}
        </div>
      </div>

      <form
        action={updateTicketAction}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-[#24302b] bg-[#121a17] p-3"
      >
        <input type="hidden" name="threadId" value={String(ticket.id)} />
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <PortalSelect
            id="status"
            name="status"
            label="Status"
            defaultValue={String(ticket.status)}
            options={["open", "pending", "resolved", "closed"].map((value) => ({
              value,
              label: labelOf(TICKET_STATUS_LABEL, value),
            }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <PortalSelect
            id="priority"
            name="priority"
            label="Priority"
            defaultValue={String(ticket.priority)}
            options={["low", "normal", "high", "urgent"].map((value) => ({
              value,
              label: labelOf(TICKET_PRIORITY_LABEL, value),
            }))}
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Update ticket
        </Button>
      </form>

      <section className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aaba2]">
          Conversation
        </h3>
        <ChatThread
          messages={messages}
          perspective="staff"
          emptyTitle="No replies yet"
          emptyBody="Send the first reply to the client below."
        />
      </section>

      <form
        action={replyTicketAction}
        className="space-y-2 rounded-lg border border-[#24302b] bg-[#121a17] p-4"
      >
        <input type="hidden" name="threadId" value={String(ticket.id)} />
        <Label htmlFor="body">Reply</Label>
        <Textarea
          id="body"
          name="body"
          rows={4}
          placeholder="Write to the client…"
        />
        <div className="space-y-1">
          <Label htmlFor="attachment">Screenshot</Label>
          <input
            id="attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="block w-full text-sm text-[#9aaba2] file:mr-3 file:rounded-md file:border-0 file:bg-[#24302b] file:px-3 file:py-1.5 file:text-sm file:text-[#e8eee9]"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#9aaba2]">
          <input type="checkbox" name="internalOnly" />
          Internal note — not visible to the client, no email sent
        </label>
        <Button type="submit">Send reply</Button>
      </form>
    </div>
  );
}
