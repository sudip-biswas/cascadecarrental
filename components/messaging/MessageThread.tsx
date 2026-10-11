"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface Props {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
}

export function MessageThread({
  conversationId,
  initialMessages,
  currentUserId,
  recipientId,
  recipientName,
  recipientAvatar,
}: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates (optimistic update already added it)
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);

    // Optimistic update
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: body.trim(),
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const sentBody = body.trim();
    setBody("");

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId,
        body: sentBody,
        conversationId,
      }),
    });

    if (!res.ok) {
      // Revert optimistic update
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(sentBody);
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  const initials = recipientName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Start the conversation
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          return (
            <div
              key={msg.id}
              className={cn("flex items-end gap-2", isMine ? "flex-row-reverse" : "flex-row")}
            >
              {!isMine && (
                <Avatar className="w-6 h-6 shrink-0">
                  <AvatarImage src={recipientAvatar ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-cascade-100 text-cascade-700">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm",
                  isMine
                    ? "bg-cascade-700 text-white rounded-br-sm"
                    : "bg-white border border-border text-cascade-900 rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className={cn("text-[10px] mt-1", isMine ? "text-cascade-300" : "text-muted-foreground")}>
                  {format(new Date(msg.created_at), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 flex items-end gap-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="resize-none flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          size="icon"
          className="bg-cascade-700 hover:bg-cascade-900 text-white shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
