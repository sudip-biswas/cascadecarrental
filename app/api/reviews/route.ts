import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";

const rating = z.number().int().min(1).max(5);

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

  // The car and host come from the trip, never from the request.
  const { data: trip } = await createAdminClient()
    .from("trips")
    .select("id, vehicle_id, host_id, guest_id, status")
    .eq("id", trip_id)
    .single();

  if (!trip || trip.guest_id !== user.id) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (trip.status !== "completed") {
    return NextResponse.json({ error: "You can review a trip once it's over." }, { status: 409 });
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      trip_id,
      vehicle_id: trip.vehicle_id,
      reviewer_id: user.id,
      reviewee_id: trip.host_id,
      ...ratings,
      body: ratings.body || null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505: reviews.trip_id is unique.
    return error.code === "23505"
      ? NextResponse.json({ error: "You've already reviewed this trip." }, { status: 409 })
      : NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ id: review.id }, { status: 201 });
}
