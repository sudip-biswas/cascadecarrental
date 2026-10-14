"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tile, TileTitle } from "@/components/kit";
import { cn } from "@/lib/utils";

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] bg-board px-3.5 py-2">
      <span className="text-[15px] font-semibold">{label}</span>
      <div className="flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-1"
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                star <= (hover || value) ? "fill-ink text-ink" : "text-quiet"
              )}
              strokeWidth={1.75}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({ tripId, carName }: { tripId: string; carName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [value, setValue] = useState(0);
  const [body, setBody] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overall === 0) return;
    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId,
        rating_overall: overall,
        rating_cleanliness: cleanliness || undefined,
        rating_accuracy: accuracy || undefined,
        rating_value: value || undefined,
        body: body.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Thanks for the review.");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: null }));
      toast.error(error ?? "Couldn't save the review. Try again.");
    }
  }

  return (
    <Tile tone="butter" className="sm:p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TileTitle>How was the {carName}?</TileTitle>
        <StarRating label="Overall" value={overall} onChange={setOverall} />
        <StarRating label="Clean" value={cleanliness} onChange={setCleanliness} />
        <StarRating label="As described" value={accuracy} onChange={setAccuracy} />
        <StarRating label="Worth the price" value={value} onChange={setValue} />
        <Textarea
          placeholder="Anything other guests should know? (optional)"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          className="bg-white"
        />
        <Button type="submit" disabled={submitting || overall === 0}>
          {submitting ? "Sending…" : overall === 0 ? "Pick an overall rating" : "Send review"}
        </Button>
      </form>
    </Tile>
  );
}
