import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { applyPaymentIntent, settleTripStatuses } from "@/lib/trips";
import { NO_INDEX } from "@/lib/site";
import { type TripRow, TRIP_SELECT } from "../_lib/trip-row";
import { BookedView } from "../_components/booked-view";
import { TripView } from "../_components/trip-view";

export const instant = false;

export const metadata: Metadata = { title: "Your trip", ...NO_INDEX };

export default async function TripPage({ params, searchParams }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const { booked, verify } = await searchParams;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/trips/${tripId}`)}`);

  await settleTripStatuses(user.id);

  const { data } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .eq("id", tripId)
    .eq("guest_id", user.id)
    .maybeSingle();
  let trip = data as unknown as TripRow | null;
  if (!trip) notFound();

  // Coming back from a card check (3-D Secure) skips the checkout's own sync.
  if (trip.status === "pending" && trip.payment_status === "pending" && trip.stripe_payment_intent_id) {
    try {
      const updated = await applyPaymentIntent(await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id));
      if (updated) trip = { ...trip, ...updated };
    } catch {
      // Stripe unreachable: the webhook will catch up.
    }
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("id")
    .eq("trip_id", tripId)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  // The exact pick-up address is private until the host has said yes.
  const confirmed = trip.status === "approved" || trip.status === "active" || trip.status === "completed";
  if (confirmed && trip.vehicle) {
    const { data: place } = await createAdminClient()
      .from("vehicles")
      .select("location_address")
      .eq("id", trip.vehicle.id)
      .single();
    trip = { ...trip, vehicle: { ...trip.vehicle, location_address: place?.location_address ?? null } };
  }

  const cancelled = trip.status === "cancelled_guest" || trip.status === "cancelled_host";
  if (booked === "1" && !cancelled) return <BookedView trip={trip} />;
  return <TripView trip={trip} reviewed={!!review} userId={user.id} verifyReturned={verify === "done"} />;
}
