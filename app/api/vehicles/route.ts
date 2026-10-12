import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  trim: z.string().optional(),
  color: z.string().optional(),
  licensePlate: z.string().min(1),
  vin: z.string().optional(),
  vehicleType: z.string().min(1),
  fuelType: z.string().min(1),
  transmission: z.string().min(1),
  seats: z.number().int().min(2).max(12),
  mpg: z.string().optional(),
  description: z.string().optional(),
  locationName: z.string().min(1),
  locationLat: z.number(),
  locationLng: z.number(),
  dailyRateCents: z.number().int().min(1000),
  weeklyDiscountPct: z.number().int().min(0).max(50).default(0),
  monthlyDiscountPct: z.number().int().min(0).max(50).default(0),
  distanceIncludedMi: z.number().int().min(0).default(200),
  extraMileFeeCents: z.number().int().min(0).default(20),
  minTripDays: z.number().int().min(1).default(1),
  maxTripDays: z.number().int().min(1).default(30),
  advanceNoticeHours: z.number().int().min(0).default(1),
  instantBook: z.boolean().default(true),
  images: z.array(
    z.object({
      url: z.string().url(),
      isCover: z.boolean(),
      position: z.number().int(),
    })
  ).default([]),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const {
    make, model, year, trim, color, licensePlate, vin, vehicleType, fuelType,
    transmission, seats, mpg, description, locationName, locationLat, locationLng,
    dailyRateCents, weeklyDiscountPct, monthlyDiscountPct, distanceIncludedMi,
    extraMileFeeCents, minTripDays, maxTripDays, advanceNoticeHours, instantBook,
    images,
  } = parsed.data;

  // Duplicate VIN / license plate guard
  if (vin) {
    const { data: vinExists } = await supabase
      .from("vehicles").select("id").eq("vin", vin).maybeSingle();
    if (vinExists) {
      return NextResponse.json({ error: "A vehicle with this VIN is already listed on Cascade" }, { status: 409 });
    }
  }
  const { data: plateExists } = await supabase
    .from("vehicles").select("id").eq("license_plate", licensePlate).eq("host_id", user.id).maybeSingle();
  if (plateExists) {
    return NextResponse.json({ error: "You already have a listing with this license plate" }, { status: 409 });
  }

  // Create vehicle
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      host_id: user.id,
      make,
      model,
      year,
      trim: trim || null,
      color: color || null,
      license_plate: licensePlate,
      vin: vin || null,
      vehicle_type: vehicleType,
      fuel_type: fuelType,
      transmission,
      seats,
      mpg: mpg ? parseInt(mpg) : null,
      description: description || null,
      location_name: locationName,
      location_lat: locationLat,
      location_lng: locationLng,
      daily_rate_cents: dailyRateCents,
      weekly_discount_pct: weeklyDiscountPct,
      monthly_discount_pct: monthlyDiscountPct,
      distance_included_mi: distanceIncludedMi,
      extra_mile_fee_cents: extraMileFeeCents,
      min_trip_days: minTripDays,
      max_trip_days: maxTripDays,
      advance_notice_hours: advanceNoticeHours,
      instant_book: instantBook,
      status: images.length >= 3 ? "listed" : "unlisted",
    })
    .select()
    .single();

  if (error || !vehicle) {
    return NextResponse.json({ error: error?.message ?? "Failed to create vehicle" }, { status: 500 });
  }

  // Insert images
  if (images.length > 0) {
    await supabase.from("vehicle_images").insert(
      images.map((img) => ({
        vehicle_id: vehicle.id,
        storage_path: img.url,
        url: img.url,
        position: img.position,
        is_cover: img.isCover,
      }))
    );
  }

  // Ensure host flag is set
  await supabase
    .from("profiles")
    .update({ is_host: true, host_since: new Date().toISOString() })
    .eq("id", user.id)
    .is("host_since", null);

  return NextResponse.json({ vehicleId: vehicle.id });
}
