import Link from "next/link";
import { notFound } from "next/navigation";

import { replyTicketAction } from "@/app/actions/portal";
import { ChatThread, type ChatMessageData } from "@/components/portal/chat-message";
import { Badge } from "@/components/portal/ticket-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireClient } from "@/lib/auth/session";
import { fetchTicket } from "@/lib/portal/data";
import { relativeTime } from "@/lib/portal/utils";

export default async function ClientTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireClient();
  const ticket = await fetchTicket(id);
  if (
    !ticket ||
    !profile.organization_ids.includes(String(ticket.organization_id))
  ) {
    notFound();
  }

  const project = ticket.projects as { name?: string } | null;
  const messages = (
    (ticket.messages as Array<Record<string, unknown>>) ?? []
  )
    .filter((message) => !message.internal_only)
    .map((message) => ({
      id: String(message.id),
      body: String(message.body ?? ""),
      created_at: String(message.created_at ?? ""),
      author_id: message.author_id ? String(message.author_id) : null,
      internal_only: false,
      attachments: Array.isArray(message.attachments)
        ? (message.attachments as ChatMessageData["attachments"])
        : [],
      profiles: (message.profiles as ChatMessageData["profiles"]) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  const closed = ["resolved", "closed"].includes(String(ticket.status));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d1f]">
            {String(ticket.ticket_number ?? "Ticket")}
          </p>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl">
            {String(ticket.subject)}
          </h2>
          <p className="mt-1 font-mono text-xs text-[#9aaba2]">
            {String(ticket.category)}
            {project?.name ? ` · ${project.name}` : ""} · raised{" "}
            {relativeTime(String(ticket.created_at))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={String(ticket.priority)} kind="priority" />
          <Badge value={String(ticket.status)} kind="status" />
          <Link
            href="/client/support"
            className="font-mono text-xs text-[#9aaba2] underline-offset-4 hover:underline"
          >
            All tickets
          </Link>
        </div>
      </div>

      <ChatThread
        messages={messages}
        perspective="client"
        currentUserId={profile.id}
        emptyTitle="Waiting for the first reply"
        emptyBody="Lynx will respond here — and by email."
      />

      <form
        action={replyTicketAction}
        className="space-y-2 rounded-lg border border-[#24302b] bg-[#121a17] p-4"
      >
        <input type="hidden" name="threadId" value={String(ticket.id)} />
        <Label htmlFor="body">
          {closed ? "Reopen with a reply" : "Add a reply"}
        </Label>
        <Textarea id="body" name="body" rows={4} />
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
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
