import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { tripStatus } from "@/lib/trip-status";
import { formatCurrency, formatDateTime, pluralize } from "@/lib/utils";
import { Fact, PageTitle, PriceRow, Tag, Tile, TileTitle, Divider } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { TripActionButtons } from "@/components/trips/TripActionButtons";
import { firstName } from "@/components/host/bits";
import { isRequest } from "@/components/host/data";
import { GuestRecord } from "@/components/host/GuestRecord";
import { InspectionPanel } from "@/components/trip-panels/InspectionPanel";
import { ChargesPanel } from "@/components/trip-panels/ChargesPanel";
import { ChangePanel } from "@/components/trip-panels/ChangePanel";
import { ReviewPanel } from "@/components/trip-panels/ReviewPanel";
import type { Trip } from "@/lib/supabase/types";

export const instant = false;
export const metadata = { title: "Trip" };

type HostTripDetail = Trip & {
  guest: { id: string; full_name: string; phone: string | null; driving_license_verified: boolean; identity_verified: boolean } | null;
  vehicle: { id: string; make: string; model: string; year: number } | null;
};

export default async function HostTripPage({ params }: PageProps<"/host/trips/[tripId]">) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/host/trips/${tripId}`);

  await settleTripStatuses(user.id);

  const { data } = await supabase
    .from("trips")
    .select(
      "*, guest:profiles!guest_id(id, full_name, phone, driving_license_verified, identity_verified), vehicle:vehicles(id, make, model, year)"
    )
    .eq("id", tripId)
    .eq("host_id", user.id)
    .maybeSingle();
  const trip = data as unknown as HostTripDetail | null;
  if (!trip) notFound();

  const guest = firstName(trip.guest?.full_name);
  const status = tripStatus(trip, "host");
  const days = tripDays(trip.starts_at, trip.ends_at);
  const car = trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "Car";
  const panel = { tripId: trip.id, viewer: "host" as const, userId: user.id };

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/host/trips">
          <ArrowLeft />
          Trips
        </Link>
      </Button>
      <PageTitle title={`${guest} · ${car}`} action={<Tag tone={status.tone}>{status.label}</Tag>} />

      <div className="flex flex-wrap items-start gap-4">
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {isRequest(trip) && (
            <Tile tone="butter" className="flex flex-col gap-3">
              <TileTitle>{guest} wants to book</TileTitle>
              <TripActionButtons tripId={trip.id} guestName={guest} />
            </Tile>
          )}
          <ChangePanel {...panel} />
          <InspectionPanel {...panel} />
          <ChargesPanel {...panel} />
          <ReviewPanel {...panel} />
        </main>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Tile className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Fact label="Pick-up" value={formatDateTime(trip.starts_at)} />
              <Fact label="Return" value={formatDateTime(trip.ends_at)} />
            </div>
            <Fact label="Guest" value={[trip.guest?.full_name, trip.guest?.phone].filter(Boolean).join(" · ")} />
            {trip.delivery_address && <Fact label="Deliver to" value={trip.delivery_address} />}
          </Tile>

          <GuestRecord guestId={trip.guest_id} name={guest} variant="tile" />

          <Tile className="flex flex-col gap-2.5">
            <TileTitle className="text-[22px]">Your earnings</TileTitle>
            <PriceRow label={`Rental, ${pluralize(days, "day")}`} value={formatCurrency(trip.rental_cents ?? trip.subtotal_cents)} />
            {trip.extras_cents > 0 && <PriceRow label="Extras" value={formatCurrency(trip.extras_cents)} />}
            {trip.delivery_cents > 0 && <PriceRow label="Delivery" value={formatCurrency(trip.delivery_cents)} />}
            <PriceRow label="Cascade fee" value={`−${formatCurrency(trip.subtotal_cents - hostEarningsCents(trip.subtotal_cents))}`} />
            <Divider className="mt-1" />
            <PriceRow strong label="To you" value={formatCurrency(hostEarningsCents(trip.subtotal_cents))} />
          </Tile>
        </aside>
      </div>
    </div>
  );
}
