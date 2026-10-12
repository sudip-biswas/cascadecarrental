"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  tripId: string;
  vehicleId: string;
  revieweeId: string;
  vehicleName: string;
}

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
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "w-5 h-5 transition-colors",
                star <= (hover || value)
                  ? "fill-summit-500 text-summit-500"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({ tripId, vehicleId, revieweeId, vehicleName }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [value, setValue] = useState(0);
  const [body, setBody] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overall === 0) {
      toast.error("Please select an overall rating");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_id: tripId,
        vehicle_id: vehicleId,
        reviewee_id: revieweeId,
        rating_overall: overall,
        rating_cleanliness: cleanliness || undefined,
        rating_accuracy: accuracy || undefined,
        rating_value: value || undefined,
        body: body.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Review submitted. Thank you!");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(error ?? "Failed to submit review");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-cascade-300/40 rounded-2xl p-5 bg-cascade-100/30 space-y-4"
    >
      <h3 className="font-semibold text-cascade-900">
        Rate your trip in {vehicleName}
      </h3>

      <div className="space-y-3">
        <StarRating label="Overall" value={overall} onChange={setOverall} />
        <StarRating label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
        <StarRating label="Accuracy" value={accuracy} onChange={setAccuracy} />
        <StarRating label="Value" value={value} onChange={setValue} />
      </div>

      <Textarea
        placeholder="Share your experience (optional)..."
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
      />

      <Button
        type="submit"
        className="bg-cascade-700 hover:bg-cascade-900 text-white w-full"
        disabled={submitting || overall === 0}
      >
        {submitting ? "Submitting..." : "Submit review"}
      </Button>
    </form>
  );
}
