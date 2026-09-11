import { relativeTime } from "@/lib/portal/utils";
import { cn } from "@/lib/utils";

export type ChatAuthor = {
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

export type ChatMessageData = {
  id: string | number;
  body: string;
  created_at: string;
  author_id?: string | null;
  internal_only?: boolean | null;
  attachments?: Array<{ type?: string; url?: string } | null> | null;
  profiles?: ChatAuthor;
};

function isStaffRole(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "STAFF";
}

export function ChatMessage({
  message,
  perspective,
  currentUserId,
}: {
  message: ChatMessageData;
  perspective: "staff" | "client";
  currentUserId?: string;
}) {
  const author = message.profiles ?? null;
  const staffAuthor = isStaffRole(author?.role);
  const mine =
    currentUserId != null &&
    String(message.author_id) === String(currentUserId);
  const internal = Boolean(message.internal_only);

  const alignEnd =
    perspective === "staff" ? staffAuthor || internal : mine;

  const displayName = mine
    ? "You"
    : staffAuthor
      ? author?.full_name || "Lynx team"
      : author?.full_name || author?.email || "Client";

  const roleChip = internal
    ? "Internal note"
    : staffAuthor
      ? "Lynx"
      : "Client";

  return (
    <li className={cn("flex w-full", alignEnd ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,36rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
          internal
            ? "w-full max-w-none rounded-lg border border-dashed border-amber-400/45 bg-amber-400/8 text-[#e8eee9]"
            : staffAuthor
              ? alignEnd
                ? "rounded-br-md bg-[#1a2e26] text-[#e8eee9] ring-1 ring-[#d4b45a]/35"
                : "rounded-bl-md bg-[#1a2e26] text-[#e8eee9] ring-1 ring-[#d4b45a]/25"
              : alignEnd
                ? "rounded-br-md bg-[#24302b] text-[#e8eee9]"
                : "rounded-bl-md border border-[#2f3d36] bg-[#121a17] text-[#e8eee9]",
        )}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
              internal
                ? "bg-amber-400/15 text-amber-200"
                : staffAuthor
                  ? "bg-[#d4b45a]/15 text-[#d4b45a]"
                  : "bg-[#3a463f] text-[#c8d3cd]",
            )}
          >
            {roleChip}
          </span>
          <span className="font-mono text-[11px] text-[#9aaba2]">
            {displayName}
            <span className="text-[#5f6f68]">
              {" "}· {relativeTime(message.created_at)}
            </span>
          </span>
        </div>
        {message.body ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
        ) : null}
        {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((item, index) => {
              const url = item && typeof item.url === "string" ? item.url : null;
              if (!url || !url.startsWith("http")) return null;
              return (
                <a
                  key={`${url}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-[#2f3d36] bg-[#0d1411]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Attachment"
                    className="max-h-56 max-w-full object-contain"
                  />
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function ChatThread({
  messages,
  perspective,
  currentUserId,
  emptyTitle = "No messages yet",
  emptyBody = "Replies will appear here.",
}: {
  messages: ChatMessageData[];
  perspective: "staff" | "client";
  currentUserId?: string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#24302b] px-4 py-8 text-center">
        <p className="font-[family-name:var(--font-syne)] text-base">{emptyTitle}</p>
        <p className="mt-1 text-sm text-[#9aaba2]">{emptyBody}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => (
        <ChatMessage
          key={String(message.id)}
          message={message}
          perspective={perspective}
          currentUserId={currentUserId}
        />
      ))}
    </ul>
  );
}
