"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";
import { cn, formatDate, formatTime, toDateKey } from "@/lib/utils";

interface Props {
  /** Null while composing the first message of a new conversation. */
  conversationId: string | null;
  initialMessages: Message[];
  currentUserId: string;
  otherName: string;
  /** Sent with the first message when there's no conversation yet. */
  start?: { tripId?: string; recipientId?: string };
  /** Where conversations live, e.g. "/messages". The new one opens there after the first send. */
  basePath: string;
  quickReplies?: string[];
  header?: ReactNode;
  className?: string;
}

/** Group consecutive messages by day for the date labels. */
function byDay(messages: Message[]) {
  const days: { key: string; messages: Message[] }[] = [];
  for (const m of messages) {
    const key = toDateKey(m.created_at);
    const last = days.at(-1);
    if (last?.key === key) last.messages.push(m);
    else days.push({ key, messages: [m] });
  }
  return days;
}

export function MessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  otherName,
  start,
  basePath,
  quickReplies = [],
  header,
  className,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const firstScroll = useRef(true);

  useEffect(() => {
    if (!conversationId) return;
    // Created here rather than during render, so it only ever runs in the browser.
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on<Message>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Swap our own optimistic copy for the stored one.
            const optimistic = prev.findIndex(
              (m) => m.id.startsWith("optimistic-") && m.sender_id === incoming.sender_id && m.body === incoming.body
            );
            if (optimistic >= 0) return prev.map((m, i) => (i === optimistic ? incoming : m));
            return [...prev, incoming];
          });
          if (incoming.sender_id !== currentUserId) {
            void supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", incoming.id);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "instant" : "smooth" });
    firstScroll.current = false;
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId ?? "",
      sender_id: currentUserId,
      body: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversationId ? { body: trimmed, conversationId } : { body: trimmed, ...start }),
    });
    const json: { message?: Message; conversationId?: string; error?: string } = await res
      .json()
      .catch(() => ({}));

    if (!res.ok || !json.message) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(trimmed);
      toast.error(json.error ?? "Message not sent. Try again.");
      setSending(false);
      return;
    }

    const stored = json.message;
    setMessages((prev) =>
      prev.some((m) => m.id === stored.id)
        ? prev.filter((m) => m.id !== optimistic.id)
        : prev.map((m) => (m.id === optimistic.id ? stored : m))
    );
    setSending(false);
    if (!conversationId && json.conversationId) {
      router.replace(`${basePath}/${json.conversationId}`);
    } else {
      input.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(body);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(body);
    }
  }

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-white", className)}>
      {header}

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-2 sm:px-5" aria-live="polite">
        {messages.length === 0 ? (
          <p className="m-auto max-w-[320px] text-center text-[15px] text-slate">
            Say hi to {otherName}. Questions about pick-up, the car or timing are all fair game.
          </p>
        ) : (
          <div className="mt-auto flex flex-col gap-2.5 pb-2">
            {byDay(messages).map((day) => (
              <div key={day.key} className="flex flex-col gap-2">
                <p className="self-center py-1.5 text-[13px] font-semibold text-slate">
                  {formatDate(day.messages[0].created_at, { weekday: "short", year: undefined })}
                </p>
                {day.messages.map((m, i) => {
                  const mine = m.sender_id === currentUserId;
                  const next = day.messages[i + 1];
                  const endOfRun = !next || next.sender_id !== m.sender_id;
                  return (
                    <div key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                      <p
                        className={cn(
                          "max-w-[78%] px-4 py-3 text-[15px] leading-[1.4] whitespace-pre-wrap break-words sm:text-base md:max-w-[70%]",
                          mine
                            ? "rounded-[20px_20px_6px_20px] bg-ink text-white"
                            : "rounded-[20px_20px_20px_6px] bg-board",
                          m.id.startsWith("optimistic-") && "opacity-70"
                        )}
                      >
                        {m.body}
                      </p>
                      {endOfRun && (
                        <span className="px-1.5 text-[12px] text-slate">
                          {mine ? "" : `${otherName} · `}
                          {formatTime(m.created_at)}
                          {mine && m.id.startsWith("optimistic-") ? " · sending" : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        {quickReplies.length > 0 && (
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => {
                  setBody(reply);
                  input.current?.focus();
                }}
                className="h-[38px] flex-none rounded-[10px] bg-board px-3 text-sm font-semibold transition-colors hover:bg-line"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-[18px] bg-board py-1.5 pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-ink"
        >
          <label className="sr-only" htmlFor={`composer-${conversationId ?? "new"}`}>
            Message {otherName}
          </label>
          <textarea
            id={`composer-${conversationId ?? "new"}`}
            ref={input}
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${otherName}`}
            maxLength={2000}
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-quiet"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!body.trim() || sending}
            className="flex size-12 flex-none items-center justify-center rounded-[14px] bg-ink text-white transition-colors hover:bg-graphite disabled:bg-line disabled:text-slate"
          >
            <ArrowUp className="size-5" strokeWidth={2.2} />
          </button>
        </form>
      </div>
    </section>
  );
}
