import Link from "next/link";

import { postMessageAction } from "@/app/actions/portal";
import { ChatThread, type ChatMessageData } from "@/components/portal/chat-message";
import { EmptyState } from "@/components/portal/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requireClient } from "@/lib/auth/session";
import { fetchThreads } from "@/lib/portal/data";
import { relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await requireClient();
  const threads = await fetchThreads(profile.organization_ids);
  const selectedId = sp.thread || threads[0]?.id;
  const selected =
    threads.find((thread) => String(thread.id) === String(selectedId)) ??
    null;
  const messages = (
    ((selected?.messages as Array<Record<string, unknown>>) ?? [])
  )
    .filter((message) => !message.internal_only)
    .map((message) => ({
      id: String(message.id),
      body: String(message.body ?? ""),
      created_at: String(message.created_at ?? ""),
      author_id: message.author_id ? String(message.author_id) : null,
      internal_only: false,
      profiles: (message.profiles as ChatMessageData["profiles"]) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-2xl">Messages</h2>
      </div>

      {!selected ? (
        <EmptyState
          title="No conversations yet"
          body="A conversation opens when your project kicks off."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <ul className="divide-y divide-[#24302b] rounded-lg border border-[#24302b]">
            {threads.map((thread) => {
              const active = String(thread.id) === String(selected.id);
              return (
                <li key={thread.id}>
                  <Link
                    href={`/client/messages?thread=${thread.id}`}
                    className={cn(
                      "block px-3 py-2 hover:bg-[#121a17]",
                      active && "bg-[#121a17] ring-1 ring-inset ring-[#d4b45a]/25",
                    )}
                  >
                    <p className="text-sm font-medium">{thread.subject}</p>
                    <p className="font-mono text-[10px] text-[#9aaba2]">
                      {relativeTime(String(thread.updated_at))}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 rounded-lg border border-[#24302b] p-4">
            <h3 className="text-sm font-medium">{selected.subject}</h3>
            <div className="max-h-96 overflow-auto">
              <ChatThread
                messages={messages}
                perspective="client"
                currentUserId={profile.id}
              />
            </div>
            <form action={postMessageAction} className="space-y-2">
              <input type="hidden" name="threadId" value={String(selected.id)} />
              <Textarea
                name="body"
                required
                rows={3}
                placeholder="Message Lynx…"
              />
              <Button type="submit" size="sm">
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
