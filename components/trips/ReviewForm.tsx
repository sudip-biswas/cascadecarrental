"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tile, TileTitle } from "@/components/kit";
import { cn } from "@/lib/utils";
import { REVIEW_CATEGORIES, type CategoryKey } from "@/components/reviews/categories";

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

/** Under-5 categories offer their tags, so the host learns what to fix. */
function IssueChips({
  category,
  picked,
  onToggle,
}: {
  category: (typeof REVIEW_CATEGORIES)[number];
  picked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 px-1 pb-1">
      <legend className="mb-2 text-sm font-semibold">What could be better? (optional)</legend>
      <div className="flex flex-wrap gap-1.5">
        {category.tags.map((tag) => {
          const on = picked.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(tag.id)}
              className={cn(
                "rounded-[10px] px-3 py-2 text-sm font-bold transition-colors",
                on ? "bg-ink text-white" : "bg-white hover:bg-line"
              )}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ tripId, carName }: { tripId: string; carName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState<Record<CategoryKey, number>>({
    cleanliness: 0,
    maintenance: 0,
    communication: 0,
    convenience: 0,
    accuracy: 0,
  });
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overall === 0) return;
    setSubmitting(true);
    // Only send tags for categories still under 5 stars.
    const issueTags = REVIEW_CATEGORIES.flatMap((c) =>
      ratings[c.key] > 0 && ratings[c.key] < 5 ? c.tags.filter((t) => tags.has(t.id)).map((t) => t.id) : []
    );
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId,
        rating_overall: overall,
        ...Object.fromEntries(REVIEW_CATEGORIES.map((c) => [c.column, ratings[c.key] || undefined])),
        issue_tags: issueTags,
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
        {REVIEW_CATEGORIES.map((c) => (
          <div key={c.key} className="flex flex-col gap-2">
            <StarRating
              label={c.label}
              value={ratings[c.key]}
              onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
            />
            {ratings[c.key] > 0 && ratings[c.key] < 5 && <IssueChips category={c} picked={tags} onToggle={toggleTag} />}
          </div>
        ))}
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
