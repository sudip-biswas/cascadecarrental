"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Public reply under a review. Shows straight away and rolls back if saving fails. */
export function ReplyForm({ reviewId, guestName }: { reviewId: string; guestName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [posted, setPosted] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const reply = text.trim();
    if (!reply) return;
    setSaving(true);
    setPosted(reply);
    const { error } = await createClient()
      .from("reviews")
      .update({ host_reply: reply, host_replied_at: new Date().toISOString() })
      .eq("id", reviewId);
    setSaving(false);
    if (error) {
      setPosted(null);
      toast.error("Reply not saved. Try again.");
      return;
    }
    setText("");
    router.refresh();
  }

  if (posted) {
    return (
      <div className="rounded-2xl bg-white px-3.5 py-3 text-[15px]">
        <span className="font-extrabold">You replied:</span> {posted}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-white py-2.5 pr-2.5 pl-3.5 focus-within:ring-2 focus-within:ring-ink">
      <label className="sr-only" htmlFor={`reply-${reviewId}`}>
        Reply to {guestName}
      </label>
      <input
        id={`reply-${reviewId}`}
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Reply publicly to ${guestName}`}
        className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-quiet"
      />
      <button
        type="submit"
        disabled={saving || !text.trim()}
        className="h-[38px] shrink-0 rounded-[10px] bg-ink px-3.5 text-sm font-bold text-white transition-colors hover:bg-graphite disabled:bg-line disabled:text-slate"
      >
        Reply
      </button>
    </form>
  );
}
