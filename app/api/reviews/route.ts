import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  trip_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  reviewee_id: z.string().uuid(),
  rating_overall: z.number().int().min(1).max(5),
  rating_cleanliness: z.number().int().min(1).max(5).optional(),
  rating_accuracy: z.number().int().min(1).max(5).optional(),
  rating_value: z.number().int().min(1).max(5).optional(),
  body: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { trip_id, vehicle_id, reviewee_id, ...rest } = parsed.data;

  // Verify reviewer was the guest on this completed trip
  const { data: trip } = await supabase
    .from("trips")
    .select("id, guest_id, status")
    .eq("id", trip_id)
    .eq("guest_id", user.id)
    .single();

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.status !== "completed") {
    return NextResponse.json({ error: "Can only review completed trips" }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("trip_id", trip_id)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Review already submitted" }, { status: 409 });
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      trip_id,
      vehicle_id,
      reviewer_id: user.id,
      reviewee_id,
      ...rest,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ id: review.id }, { status: 201 });
}
