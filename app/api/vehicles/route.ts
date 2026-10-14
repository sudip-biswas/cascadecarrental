import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, VIN_PATTERN } from "@/lib/listing-limits";

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/vehicle-images/`;

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max).optional().transform((v) => v || null);

const schema = z
  .object({
    make: text(40).min(1, "Add the make"),
    model: text(60).min(1, "Add the model"),
    year: z.number().int().min(LIMITS.yearMin).max(LIMITS.yearMax),
    trim: optionalText(40),
    color: optionalText(30),
    licensePlate: text(LIMITS.plateMax).min(1, "Add the plate").transform((v) => v.toUpperCase()),
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || VIN_PATTERN.test(v), "A VIN is 17 letters and numbers"),
    vehicleType: z.enum(["sedan", "suv", "truck", "van", "sports", "luxury", "electric"]),
    fuelType: z.enum(["gasoline", "hybrid", "electric", "diesel"]),
    transmission: z.enum(["automatic", "manual"]),
    seats: z.number().int().min(LIMITS.seatsMin).max(LIMITS.seatsMax),
    mpg: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce
        .number()
        .int()
        .min(LIMITS.mpgMin, "MPG has to be between 1 and 150")
        .max(LIMITS.mpgMax, "MPG has to be between 1 and 150")
        .optional()
    ),
    description: optionalText(1000),
    locationName: text(80).min(1, "Add the pickup area"),
    locationAddress: optionalText(200),
    locationLat: z.number().min(-90).max(90),
    locationLng: z.number().min(-180).max(180),
    dailyRateCents: z.number().int().min(LIMITS.rateMinCents).max(LIMITS.rateMaxCents),
    weeklyDiscountPct: z.number().int().min(0).max(LIMITS.discountMaxPct).default(0),
    monthlyDiscountPct: z.number().int().min(0).max(LIMITS.discountMaxPct).default(0),
    distanceIncludedMi: z.number().int().min(0).max(LIMITS.milesMax).default(200),
    extraMileFeeCents: z.number().int().min(0).max(LIMITS.extraMileMaxCents).default(20),
    minTripDays: z.number().int().min(1).max(LIMITS.minTripMax).default(1),
    maxTripDays: z.number().int().min(1).max(LIMITS.maxTripMax).default(30),
    advanceNoticeHours: z.number().int().min(0).max(LIMITS.noticeMaxHours).default(1),
    instantBook: z.boolean().default(true),
    /** In display order. The first one is the cover. */
    images: z.array(z.object({ url: z.string().url() })).max(LIMITS.photosMax).default([]),
  })
  .refine((v) => v.maxTripDays >= v.minTripDays, {
    message: "Longest trip can't be shorter than the shortest",
    path: ["maxTripDays"],
  });

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Log in to list a car.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Check the listing details", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const v = parsed.data;

  // Photos must be ones this host uploaded through /api/uploads.
  const ownPrefix = `${STORAGE_PREFIX}${user.id}/`;
  if (v.images.some((img) => !img.url.startsWith(ownPrefix))) {
    return fail("Upload photos from this page", 400);
  }

  // RLS hides other hosts' unlisted cars, so check VINs across everyone.
  const admin = createAdminClient();
  if (v.vin) {
    const { data: vinExists } = await admin.from("vehicles").select("id").eq("vin", v.vin).maybeSingle();
    if (vinExists) return fail("A car with this VIN is already on Cascade", 409);
  }
  const { data: plateExists } = await admin
    .from("vehicles")
    .select("id")
    .eq("license_plate", v.licensePlate)
    .eq("host_id", user.id)
    .maybeSingle();
  if (plateExists) return fail("You already have a car with this plate", 409);

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .insert({
      host_id: user.id,
      make: v.make,
      model: v.model,
      year: v.year,
      trim: v.trim,
      color: v.color,
      license_plate: v.licensePlate,
      vin: v.vin,
      vehicle_type: v.vehicleType,
      fuel_type: v.fuelType,
      transmission: v.transmission,
      seats: v.seats,
      mpg: v.mpg ?? null,
      description: v.description,
      location_name: v.locationName,
      location_address: v.locationAddress,
      location_lat: v.locationLat,
      location_lng: v.locationLng,
      daily_rate_cents: v.dailyRateCents,
      weekly_discount_pct: v.weeklyDiscountPct,
      monthly_discount_pct: v.monthlyDiscountPct,
      distance_included_mi: v.distanceIncludedMi,
      extra_mile_fee_cents: v.extraMileFeeCents,
      min_trip_days: v.minTripDays,
      max_trip_days: v.maxTripDays,
      advance_notice_hours: v.advanceNoticeHours,
      instant_book: v.instantBook,
      status: v.images.length >= LIMITS.photosToList ? "listed" : "unlisted",
    })
    .select("id")
    .single();

  if (error || !vehicle) {
    // 23505: the VIN is unique across Cascade.
    return error?.code === "23505"
      ? fail("A car with this VIN is already on Cascade", 409)
      : fail("Couldn't save the listing. Try again.", 500);
  }

  if (v.images.length > 0) {
    const { error: imagesError } = await supabase.from("vehicle_images").insert(
      v.images.map((img, i) => ({
        vehicle_id: vehicle.id,
        storage_path: img.url.slice(STORAGE_PREFIX.length),
        url: img.url,
        position: i,
        is_cover: i === 0,
      }))
    );
    if (imagesError) {
      await supabase.from("vehicles").delete().eq("id", vehicle.id);
      return fail("Couldn't save the photos. Try again.", 500);
    }
  }

  // Profile flags aren't writable by users, so set this with the service role.
  await admin
    .from("profiles")
    .update({ is_host: true, host_since: new Date().toISOString() })
    .eq("id", user.id)
    .is("host_since", null);

  return NextResponse.json({ vehicleId: vehicle.id, listed: v.images.length >= LIMITS.photosToList });
}
