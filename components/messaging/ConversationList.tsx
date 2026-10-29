import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { messagePreview } from "@/lib/message-photos";
import { cn, formatDateShort, formatRange, formatTime, toDateKey } from "@/lib/utils";
import type { ConversationSummary } from "./inbox";

/** "20:05" for today, "Sep 28" otherwise. */
export function messageTime(iso: string) {
  return toDateKey(iso) === toDateKey(new Date()) ? formatTime(iso) : formatDateShort(iso);
}

function tripLine(c: ConversationSummary, viewer: "guest" | "host") {
  if (!c.trip) return null;
  const dates = formatRange(c.trip.starts_at, c.trip.ends_at);
  const isRequest = c.trip.status === "pending" && c.trip.payment_status === "authorized";
  if (viewer === "host" && isRequest) return `Request · ${dates}`;
  return c.trip.vehicle ? `${c.trip.vehicle.model} · ${dates}` : dates;
}

export function ConversationList({
  conversations,
  activeId,
  viewer,
  basePath,
  title = "Inbox",
  action,
  empty,
  className,
}: {
  conversations: ConversationSummary[];
  activeId?: string;
  viewer: "guest" | "host";
  basePath: string;
  title?: string;
  /** Shown beside the title, like a link to scheduled messages. */
  action?: React.ReactNode;
  empty: React.ReactNode;
  className?: string;
}) {
  const activeFill = viewer === "host" ? "bg-butter" : "bg-sky";

  return (
    <aside className={cn("flex min-w-0 flex-col gap-1.5 rounded-[28px] bg-white p-3.5", className)}>
      <div className="mx-2 mt-1.5 mb-2.5 flex items-center justify-between gap-3">
        <h1 className="text-[40px] leading-[1.12] tracking-[-0.035em]">{title}</h1>
        {action}
      </div>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-2 pb-4">
          <span className="flex size-12 items-center justify-center rounded-[15px] bg-board">
            <MessageSquare className="size-[22px]" strokeWidth={1.75} />
          </span>
          <div className="text-[15px] text-slate">{empty}</div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((c) => {
            const active = c.id === activeId;
            const line = tripLine(c, viewer);
            return (
              <li key={c.id}>
                <Link
                  href={`${basePath}/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[18px] p-3 transition-colors",
                    active ? activeFill : "hover:bg-board"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-12 flex-none items-center justify-center rounded-[15px] font-display text-[20px] font-extrabold",
                      active ? "bg-white" : viewer === "host" ? "bg-lilac" : "bg-mint"
                    )}
                  >
                    {c.other.full_name[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-base", c.unread ? "font-extrabold" : "font-bold")}>
                        {c.other.full_name}
                      </span>
                      {c.last && (
                        <span className={cn("shrink-0 text-[13px]", active ? "" : "text-slate")}>
                          {messageTime(c.last.created_at)}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          c.unread ? "font-semibold text-ink" : active ? "" : "text-slate"
                        )}
                      >
                        {c.last
                          ? `${c.last.sender_id === c.other.id ? "" : "You: "}${messagePreview(c.last)}`
                          : "No messages yet"}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto shrink-0 rounded-[7px] bg-cobalt px-1.5 py-px text-[12px] font-extrabold text-white">
                          <span className="sr-only">Unread: </span>
                          {c.unread}
                        </span>
                      )}
                    </span>
                    {line && <span className="truncate text-[13px] font-semibold">{line}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
