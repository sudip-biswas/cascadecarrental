"use client";
/* eslint-disable @next/next/no-img-element -- local previews of picked photos */

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";
import { MESSAGE_PHOTO_BUCKET, MESSAGE_PHOTO_LIMITS, MESSAGE_PHOTO_URL_SECONDS } from "@/lib/message-photos";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { cn, formatDate, formatTime, toDateKey } from "@/lib/utils";
import { PhotoGrid } from "@/components/trip-panels/inspection/PhotoGrid";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

interface Pick {
  id: string;
  file: File;
  /** A local preview link. */
  url: string;
}

/** Uploads one photo and returns its storage path. */
async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("photo", await shrinkPhoto(file));
  const res = await fetch("/api/messages/photos", { method: "POST", body: form });
  const json: { path?: string; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !json.path) throw new Error(json.error ?? "A photo didn't upload. Try again.");
  return json.path;
}

/** One photo fills the bubble's width; more sit in a grid. */
function MessagePhotos({ paths, urls, label }: { paths: string[]; urls: Record<string, string>; label: string }) {
  return (
    <PhotoGrid
      photos={paths.map((path) => ({ path, url: urls[path] ?? null }))}
      label={label}
      className={cn("grid w-[min(78%,320px)] gap-1", paths.length > 1 && "grid-cols-2")}
      thumbClassName={cn("w-full", paths.length > 1 ? "aspect-square" : "aspect-[4/3]")}
    />
  );
}

interface Props {
  /** Null while composing the first message of a new conversation. */
  conversationId: string | null;
  initialMessages: Message[];
  /** Signed links for the photos in initialMessages, by path. */
  initialPhotoUrls?: Record<string, string>;
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
  initialPhotoUrls = {},
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
  const [photoUrls, setPhotoUrls] = useState(initialPhotoUrls);
  const [picks, setPicks] = useState<Pick[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const firstScroll = useRef(true);
  // Local previews stay in use for sent photos, so they're only freed on the way out.
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

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
              (m) =>
                m.id.startsWith("optimistic-") &&
                m.sender_id === incoming.sender_id &&
                m.body === incoming.body &&
                m.photos.length === (incoming.photos?.length ?? 0)
            );
            if (optimistic >= 0) return prev.map((m, i) => (i === optimistic ? incoming : m));
            return [...prev, incoming];
          });
          if (incoming.sender_id !== currentUserId) {
            void supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", incoming.id);
            if (incoming.photos?.length) {
              void supabase.storage
                .from(MESSAGE_PHOTO_BUCKET)
                .createSignedUrls(incoming.photos, MESSAGE_PHOTO_URL_SECONDS)
                .then(({ data }) => {
                  const signed = Object.fromEntries(
                    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : []))
                  );
                  setPhotoUrls((prev) => ({ ...prev, ...signed }));
                });
            }
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

  function addPhotos(files: FileList | null) {
    const room = MESSAGE_PHOTO_LIMITS.perMessage - picks.length;
    const chosen = [...(files ?? [])].filter((f) => f.size > 0);
    if (chosen.length > room) toast.error(`Up to ${MESSAGE_PHOTO_LIMITS.perMessage} photos a message.`);
    const added = chosen.slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file);
      previews.current.push(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setPicks((prev) => [...prev, ...added]);
    if (fileInput.current) fileInput.current.value = "";
    input.current?.focus();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const sendingPicks = picks;
    if ((!trimmed && !sendingPicks.length) || sending) return;
    setSending(true);

    // Until the upload is done, the bubble shows the local previews.
    const localKeys = sendingPicks.map((p) => `local:${p.id}`);
    setPhotoUrls((prev) => ({ ...prev, ...Object.fromEntries(sendingPicks.map((p, i) => [localKeys[i], p.url])) }));
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId ?? "",
      sender_id: currentUserId,
      body: trimmed,
      photos: localKeys,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setPicks([]);

    const undo = (error: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(trimmed);
      setPicks(sendingPicks);
      toast.error(error);
      setSending(false);
    };

    let photos: string[] = [];
    try {
      photos = await Promise.all(sendingPicks.map((p) => uploadPhoto(p.file)));
    } catch (err) {
      return undo(err instanceof Error ? err.message : "A photo didn't upload. Try again.");
    }

    const payload = { body: trimmed, photos };
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversationId ? { ...payload, conversationId } : { ...payload, ...start }),
    });
    const json: { message?: Message; conversationId?: string; error?: string } = await res
      .json()
      .catch(() => ({}));

    if (!res.ok || !json.message) return undo(json.error ?? "Message not sent. Try again.");

    const stored = json.message;
    // The photos just sent keep showing from this device's copies.
    setPhotoUrls((prev) => ({ ...prev, ...Object.fromEntries(photos.map((path, i) => [path, sendingPicks[i].url])) }));
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
                  const pending = m.id.startsWith("optimistic-");
                  return (
                    <div key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                      {m.photos?.length > 0 && (
                        <div className={cn("flex w-full", mine ? "justify-end" : "justify-start", pending && "opacity-70")}>
                          <MessagePhotos paths={m.photos} urls={photoUrls} label={mine ? "You" : otherName} />
                        </div>
                      )}
                      {m.body && (
                        <p
                          className={cn(
                            "max-w-[78%] px-4 py-3 text-[15px] leading-[1.4] whitespace-pre-wrap break-words sm:text-base md:max-w-[70%]",
                            mine
                              ? "rounded-[20px_20px_6px_20px] bg-ink text-white"
                              : "rounded-[20px_20px_20px_6px] bg-board",
                            pending && "opacity-70"
                          )}
                        >
                          {m.body}
                        </p>
                      )}
                      {endOfRun && (
                        <span className="px-1.5 text-[12px] text-slate">
                          {mine ? "" : `${otherName} · `}
                          {formatTime(m.created_at)}
                          {mine && pending ? " · sending" : ""}
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
        {picks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {picks.map((p) => (
              <div key={p.id} className="relative flex-none">
                <img src={p.url} alt="" className="size-[68px] rounded-[12px] bg-board object-cover" />
                <button
                  type="button"
                  onClick={() => setPicks((prev) => prev.filter((x) => x.id !== p.id))}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white text-ink transition-colors hover:bg-line"
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-1 rounded-[18px] bg-board p-1.5 focus-within:ring-2 focus-within:ring-ink"
        >
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => addPhotos(e.target.files)}
          />
          <button
            type="button"
            aria-label="Add photos"
            disabled={sending || picks.length >= MESSAGE_PHOTO_LIMITS.perMessage}
            onClick={() => fileInput.current?.click()}
            className="flex size-12 flex-none items-center justify-center rounded-[14px] text-slate transition-colors hover:bg-line hover:text-ink disabled:opacity-40"
          >
            <ImagePlus className="size-5" strokeWidth={2} />
          </button>
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
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-quiet"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={(!body.trim() && !picks.length) || sending}
            className="flex size-12 flex-none items-center justify-center rounded-[14px] bg-ink text-white transition-colors hover:bg-graphite disabled:bg-line disabled:text-slate"
          >
            <ArrowUp className="size-5" strokeWidth={2.2} />
          </button>
        </form>
      </div>
    </section>
  );
}
