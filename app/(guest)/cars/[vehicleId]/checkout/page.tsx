import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarX } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadDailyPrices } from "@/lib/trips";
import { loadPickupSpots, publicOption } from "@/lib/locations";
import { tripDays } from "@/lib/pricing";
import { NO_INDEX, carIdFromSlug, carPath } from "@/lib/site";
import { pluralize, toDateKey, zonedInstant, HANDOVER_TIME } from "@/lib/utils";
import { Container, EmptyState } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { CheckoutForm, type CheckoutVehicle } from "@/components/checkout/CheckoutForm";

export const instant = false;

export const metadata: Metadata = { title: "Checkout", ...NO_INDEX };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function param(value: string | string[] | undefined) {
  return typeof value === "string" && DATE_KEY.test(value) ? value : null;
}

export default async function CheckoutPage({ params, searchParams }: PageProps<"/cars/[vehicleId]/checkout">) {
  const vehicleId = carIdFromSlug((await params).vehicleId);
  if (!vehicleId) notFound();
  const query = await searchParams;
  const from = param(query.from);
  const until = param(query.until);
  const TIME_RE = /^\d{2}:\d{2}$/;
  const fromTime = typeof query.fromTime === "string" && TIME_RE.test(query.fromTime) ? query.fromTime : HANDOVER_TIME;
  const untilTime = typeof query.untilTime === "string" && TIME_RE.test(query.untilTime) ? query.untilTime : HANDOVER_TIME;
  const initialRate = query.rate === "refundable" ? "refundable" : "non_refundable";
  const initialSpot = typeof query.spot === "string" ? query.spot : undefined;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    const here = `/cars/${vehicleId}/checkout${from && until ? `?from=${from}&until=${until}` : ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(here)}`);
  }

  const { data } = await supabase
    .from("vehicles")
    .select(
      "id, host_id, make, model, year, trim, location_name, daily_rate_cents, weekly_discount_pct, monthly_discount_pct, three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct, distance_included_mi, instant_book, min_trip_days, max_trip_days, location_lat, location_lng, min_age, young_driver_fee_cents, deposit_cents, delivery_enabled, delivery_radius_mi, delivery_fee_cents, delivery_fee_per_mi_cents, airport_delivery_fee_cents, vehicle_images(url, is_cover, position), host:profiles!host_id(full_name)"
    )
    .eq("id", vehicleId)
    .eq("status", "listed")
    .maybeSingle();
  const vehicle = data as unknown as (CheckoutVehicle & { host_id: string; min_trip_days: number; max_trip_days: number }) | null;
  if (!vehicle) notFound();

  const problem = (() => {
    if (vehicle.host_id === user.id) return { title: "That's your car.", body: "You can't book your own listing." };
    if (!from || !until) return { title: "Pick your dates first.", body: "Choose pick-up and return dates on the car's page, then come back here." };
    const start = zonedInstant(from, fromTime);
    const end = zonedInstant(until, untilTime);
    if (end <= start) return { title: "Those dates don't work.", body: "The return date has to be after pick-up." };
    if (from < toDateKey(new Date())) return { title: "Those dates have passed.", body: "Pick new dates on the car's page." };
    const days = tripDays(start, end);
    if (days < vehicle.min_trip_days) {
      return { title: "That trip is too short.", body: `This car needs at least ${pluralize(vehicle.min_trip_days, "day")}.` };
    }
    if (vehicle.max_trip_days && days > vehicle.max_trip_days) {
      return { title: "That trip is too long.", body: `This car can be booked for up to ${pluralize(vehicle.max_trip_days, "day")}.` };
    }
    return null;
  })();

  if (problem || !from || !until) {
    return (
      <Container className="py-9">
        <EmptyState
          icon={<CalendarX />}
          title={problem?.title}
          body={problem?.body}
          action={
            <Button asChild>
              <Link href={carPath(vehicle)}>Back to the {vehicle.model}</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const [dailyPrices, { data: extras }, { data: profile }, spots] = await Promise.all([
    loadDailyPrices(vehicle.id, from, until),
    supabase
      .from("vehicle_extras")
      .select("id, name, description, per, price_cents, max_quantity, unlimited_miles")
      .eq("vehicle_id", vehicle.id)
      .eq("active", true)
      .order("position")
      .order("created_at"),
    supabase.from("profiles").select("date_of_birth, driving_license_verified").eq("id", user.id).single(),
    // Spot addresses are private until booking: read server-side, send names and prices.
    loadPickupSpots(createAdminClient(), vehicle),
  ]);
  return (
    <CheckoutForm
      vehicle={vehicle}
      from={from}
      until={until}
      fromTime={fromTime}
      untilTime={untilTime}
      initialRate={initialRate}
      dailyPrices={dailyPrices}
      extras={extras ?? []}
      pickup={spots.map(publicOption)}
      initialSpot={initialSpot}
      driver={{
        userId: user.id,
        dateOfBirth: profile?.date_of_birth ?? null,
        licenseRequired: process.env.REQUIRE_DRIVER_CHECK === "true" && !profile?.driving_license_verified,
      }}
    />
  );
}
