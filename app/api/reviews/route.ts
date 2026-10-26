import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { notifyTripLater } from "@/lib/notify";
import { hostReviewCloses } from "@/components/trip-panels/review/window";

const rating = z.number().int().min(1).max(5);

// The same fields both ways. From a host, the three extras mean returned
// clean, on time and followed the rules (see review/window.ts).
const schema = z.object({
  trip_id: z.string().uuid(),
  rating_overall: rating,
  rating_cleanliness: rating.optional(),
  rating_accuracy: rating.optional(),
  rating_value: rating.optional(),
  body: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a rating from 1 to 5." }, { status: 400 });
  }
  const { trip_id, ...ratings } = parsed.data;

  await settleTripStatuses(user.id);

  // The car, the other person and which way the review goes all come from the
  // trip, never from the request.
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, vehicle_id, host_id, guest_id, status, ends_at, completed_at")
    .eq("id", trip_id)
    .single();

  const asHost = trip?.host_id === user.id;
  if (!trip || (!asHost && trip.guest_id !== user.id)) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (trip.status !== "completed") {
    return NextResponse.json({ error: "You can review a trip once it's over." }, { status: 409 });
  }
  if (asHost && hostReviewCloses(trip) < new Date()) {
    return NextResponse.json({ error: "Reviews close 14 days after the trip." }, { status: 409 });
  }

  const row = {
    trip_id,
    vehicle_id: trip.vehicle_id,
    reviewer_id: user.id,
    reviewee_id: asHost ? trip.guest_id : trip.host_id,
    kind: asHost ? ("host_to_guest" as const) : ("guest_to_host" as const),
    ...ratings,
    body: ratings.body || null,
  };
  // The insert policy only lets guests write, so host reviews use the admin
  // client now that the trip check above has passed.
  const { data: review, error } = await (asHost ? admin : supabase)
    .from("reviews")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    // 23505: one review per person per trip.
    return error.code === "23505"
      ? NextResponse.json({ error: "You've already reviewed this trip." }, { status: 409 })
      : NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  notifyTripLater(trip.id, asHost ? "review_from_host" : "review_from_guest", {
    note: `${ratings.rating_overall} out of 5.${ratings.body ? ` "${ratings.body}"` : ""}`,
  });

  return NextResponse.json({ id: review.id }, { status: 201 });
}
