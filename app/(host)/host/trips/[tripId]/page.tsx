import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Gauge,
  MapPin,
  Package,
  ReceiptText,
  Shield,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { freeCancellationUntil } from "@/lib/cancellation";
import { tripMiles } from "@/lib/inspections";
import { tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDate, formatDateTime, formatPrice, pluralize, relativeDays } from "@/lib/utils";
import { Divider, PageTitle, PriceRow, Tag, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { TripActionButtons } from "@/components/trips/TripActionButtons";
import { CarPhoto, Initial, coverUrl, firstName } from "@/components/host/bits";
import { PROTECTION_LABEL, answerBy, isRequest, timeLeft } from "@/components/host/data";
import { GuestRecord } from "@/components/host/GuestRecord";
import { MessageThread } from "@/components/messaging/MessageThread";
import { HOST_REPLIES } from "@/components/messaging/replies";
import { InspectionPanel } from "@/components/trip-panels/InspectionPanel";
import { ChargesPanel } from "@/components/trip-panels/ChargesPanel";
import { ChangePanel } from "@/components/trip-panels/ChangePanel";
import { ReviewPanel } from "@/components/trip-panels/ReviewPanel";
import type { Message, Trip } from "@/lib/supabase/types";

export const instant = false;
export const metadata = { title: "Trip" };

type HostTripDetail = Trip & {
  guest: {
    id: string;
    full_name: string;
    phone: string | null;
    created_at: string;
    driving_license_verified: boolean;
    identity_verified: boolean;
  } | null;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    location_name: string;
    location_address: string | null;
    location_lat: number;
    location_lng: number;
    vehicle_images: { url: string; is_cover: boolean; position: number }[];
  } | null;
};

const TRIP_SELECT =
  "*, guest:profiles!guest_id(id, full_name, phone, created_at, driving_license_verified, identity_verified), vehicle:vehicles(id, make, model, year, location_name, location_address, location_lat, location_lng, vehicle_images(url, is_cover, position))";

export default async function HostTripPage({ params }: PageProps<"/host/trips/[tripId]">) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/host/trips/${tripId}`);

  await settleTripStatuses(user.id);

  const { data } = await supabase.from("trips").select(TRIP_SELECT).eq("id", tripId).eq("host_id", user.id).maybeSingle();
  const trip = data as unknown as HostTripDetail | null;
  if (!trip) notFound();

  const admin = createAdminClient();
  const [{ data: readings }, { data: conversations }, { data: guestAuth }] = await Promise.all([
    supabase.from("trip_inspections").select("kind, role, odometer_mi, photos").eq("trip_id", trip.id),
    supabase
      .from("conversations")
      .select("id, trip_id, messages(*)")
      .eq("host_id", user.id)
      .eq("guest_id", trip.guest_id),
    // Whether the guest confirmed their email lives with their login, not their profile.
    admin.auth.admin.getUserById(trip.guest_id),
  ]);

  // The trip's own conversation, or any earlier one with the same guest.
  const threads = (conversations ?? []) as unknown as { id: string; trip_id: string | null; messages: Message[] }[];
  const thread = threads.find((c) => c.trip_id === trip.id) ?? threads[0] ?? null;
  const messages = [...(thread?.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const guest = firstName(trip.guest?.full_name);
  const status = tripStatus(trip, "host");
  const days = tripDays(trip.starts_at, trip.ends_at);
  const car = trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "Car";
  const miles = tripMiles(trip, readings ?? []);
  const photoCount = (readings ?? []).reduce((sum, r) => sum + (r.photos?.length ?? 0), 0);
  const earnings = hostEarningsCents(trip.subtotal_cents);
  const place = trip.delivery_address ?? trip.vehicle?.location_address ?? trip.pickup_location;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    trip.delivery_address ?? trip.vehicle?.location_address ?? `${trip.vehicle?.location_lat},${trip.vehicle?.location_lng}`
  )}`;
  const panel = { tripId: trip.id, viewer: "host" as const, userId: user.id };
  const afterPickup = trip.status === "active" || trip.status === "completed";

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/host/trips">
          <ArrowLeft />
          Trips
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title={`${guest}'s trip`} lead={`Reservation #${trip.id.slice(0, 8).toUpperCase()}`} />
        {trip.vehicle && (
          <Link
            href={`/host/vehicles/${trip.vehicle.id}`}
            className="flex items-center gap-3 rounded-[20px] bg-white p-2 pr-4 hover:bg-board"
          >
            <CarPhoto
              src={coverUrl(trip.vehicle.vehicle_images)}
              alt={car}
              sizes="72px"
              className="h-[52px] w-[72px] rounded-[14px]"
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-extrabold">
                {car} {trip.vehicle.year}
              </span>
              <span className="text-sm font-semibold text-cobalt">View car</span>
            </span>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {isRequest(trip) && (
            <Tile tone="butter" className="flex flex-col gap-3">
              <TileTitle>{guest} wants to book</TileTitle>
              <p className="text-[15px]">Answer within {timeLeft(answerBy(trip))}. Yes charges their card, no releases the hold.</p>
              <TripActionButtons tripId={trip.id} guestName={guest} />
            </Tile>
          )}

          <Tile className="flex flex-col gap-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <When label="Pick-up" iso={trip.starts_at} />
              <ArrowRight className="size-5 text-slate" strokeWidth={2} aria-hidden />
              <When label="Return" iso={trip.ends_at} />
              <Tag tone={status.tone} className="ml-auto">
                {status.label}
              </Tag>
            </div>
            <Divider />
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Detail icon={MapPin} label={trip.delivery_address ? "Delivery" : "Pick-up and return"}>
                <span className="font-semibold">{place}</span>
                <a href={directions} target="_blank" rel="noreferrer" className="font-bold text-cobalt hover:underline">
                  Get directions
                </a>
                {trip.delivery_address && (
                  <span className="text-slate">You bring the car to {guest}, {formatCurrency(trip.delivery_cents)} added to your earnings.</span>
                )}
              </Detail>

              <Detail icon={Gauge} label="Miles">
                <span className="font-semibold">
                  {trip.unlimited_miles
                    ? "Unlimited"
                    : `${(trip.distance_included_mi * days).toLocaleString()} mi included`}
                </span>
                {!trip.unlimited_miles && (
                  <span className="text-slate">
                    {formatPrice(trip.extra_mile_fee_cents)} for every mile over, which you can charge after the trip.
                  </span>
                )}
                <span className={cn(miles?.overMi ? "font-bold text-peach-ink" : "text-slate")}>
                  {miles
                    ? `${miles.driven.toLocaleString()} mi driven${miles.overMi ? `, ${miles.overMi.toLocaleString()} over` : ""}`
                    : afterPickup
                      ? "Miles driven show once both odometer readings are in."
                      : "Miles driven show after check-out."}
                </span>
              </Detail>

              <Detail icon={Shield} label="Protection">
                <span className="font-semibold">
                  {trip.protection_plan ? `${PROTECTION_LABEL[trip.protection_plan]} plan` : "No protection plan"}
                </span>
                {trip.deposit_cents > 0 && (
                  <span className="text-slate">
                    {formatCurrency(trip.deposit_cents)} deposit, {depositLine(trip.deposit_status)}.
                  </span>
                )}
              </Detail>

              <Detail icon={Package} label="Extras">
                {trip.extras.length ? (
                  trip.extras.map((e) => (
                    <span key={e.id} className="font-semibold">
                      {e.name}
                      {e.quantity > 1 ? ` × ${e.quantity}` : ""}{" "}
                      <span className="font-normal text-slate">{formatCurrency(e.total_cents)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-slate">None booked</span>
                )}
              </Detail>

              <Detail icon={Undo2} label="Cancellation">
                <span className="font-semibold">
                  {trip.rate_type === "refundable" ? "Free until pick-up" : "Pay now, no refund after 24 hours"}
                </span>
                {trip.rate_type === "non_refundable" && (
                  <span className="text-slate">Free for the guest until {formatDateTime(freeCancellationUntil(trip))}.</span>
                )}
              </Detail>

              <Detail icon={ReceiptText} label="Earnings">
                <span className="font-semibold">{formatCurrency(earnings)} to you</span>
                <a href="#earnings" className="font-bold text-cobalt hover:underline">
                  See the breakdown
                </a>
              </Detail>

              <Detail icon={Camera} label="Trip photos">
                <span className="font-semibold">{photoCount ? pluralize(photoCount, "photo") : "None yet"}</span>
                <a href="#check-in" className="font-bold text-cobalt hover:underline">
                  {photoCount ? "View and add more" : "Add check-in photos"}
                </a>
              </Detail>
            </dl>
          </Tile>

          <ChangePanel {...panel} />
          <div id="check-in" className="scroll-mt-4">
            <InspectionPanel {...panel} />
          </div>
          <div id="charges" className="scroll-mt-4">
            <ChargesPanel {...panel} />
          </div>
          <ReviewPanel {...panel} />

          <section id="messages" className="flex scroll-mt-4 flex-col gap-3">
            <TileTitle className="px-1">Messages</TileTitle>
            <MessageThread
              conversationId={thread?.id ?? null}
              initialMessages={messages}
              currentUserId={user.id}
              otherName={trip.guest?.full_name ?? guest}
              start={thread ? undefined : { tripId: trip.id }}
              basePath="/host/inbox"
              quickReplies={HOST_REPLIES}
              className="h-[520px] rounded-[28px]"
            />
          </section>
        </main>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Tile className="flex flex-col gap-3">
            <p className="text-[15px] font-semibold">{nowLine(trip, guest)}</p>
            {afterPickup && (
              <>
                <Button asChild className="h-[48px] text-base">
                  <a href="#charges">Send a charge</a>
                </Button>
                <Button asChild variant="secondary" className="h-[48px] text-base">
                  <a href="#check-in">{trip.status === "active" ? "Check the car back in" : "See check-in photos"}</a>
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="h-[48px] text-base">
              <a href="#messages">Message {guest}</a>
            </Button>
          </Tile>

          <Tile className="flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <Initial name={trip.guest?.full_name} seed={trip.guest_id} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[17px] font-extrabold">{trip.guest?.full_name ?? "Guest"}</span>
                {trip.guest && (
                  <span className="text-sm text-slate">
                    Joined {formatDate(trip.guest.created_at, { day: undefined, month: "short" })}
                  </span>
                )}
                {trip.guest?.phone && (
                  <a href={`tel:${trip.guest.phone}`} className="text-sm font-bold text-cobalt hover:underline">
                    {trip.guest.phone}
                  </a>
                )}
              </span>
            </div>
            <p className="text-sm text-slate">The primary driver. They have to be there for pick-up and return.</p>
            <ul className="flex flex-col gap-2 text-[15px]">
              <Verified ok={!!trip.guest?.driving_license_verified}>Driver&apos;s licence checked</Verified>
              <Verified ok={!!trip.guest?.identity_verified}>ID checked</Verified>
              <Verified ok={!!guestAuth.user?.email_confirmed_at}>Email confirmed</Verified>
              <Verified ok={!!trip.guest?.phone}>Phone number</Verified>
            </ul>
          </Tile>

          <GuestRecord guestId={trip.guest_id} name={guest} variant="tile" />

          <Tile id="earnings" className="flex scroll-mt-4 flex-col gap-2.5">
            <TileTitle className="text-[22px]">Your earnings</TileTitle>
            <PriceRow label={`Rental, ${pluralize(days, "day")}`} value={formatCurrency(trip.rental_cents ?? trip.subtotal_cents)} />
            {trip.extras_cents > 0 && <PriceRow label="Extras" value={formatCurrency(trip.extras_cents)} />}
            {trip.delivery_cents > 0 && <PriceRow label="Delivery" value={formatCurrency(trip.delivery_cents)} />}
            <PriceRow label="Cascade fee" value={`−${formatCurrency(trip.subtotal_cents - earnings)}`} />
            <Divider className="mt-1" />
            <PriceRow strong label="To you" value={formatCurrency(earnings)} />
            <p className="text-sm text-slate">
              {trip.paid_out_at
                ? `Sent to your bank ${formatDate(trip.paid_out_at, { month: "short" })}.`
                : "Paid to your bank when the trip ends. Charges you send after the trip are paid in full on top."}
            </p>
          </Tile>
        </aside>
      </div>
    </div>
  );
}

function When({ label, iso }: { label: string; iso: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      <span className="font-display text-[clamp(22px,2.6vw,28px)] leading-tight font-extrabold">
        {formatDate(iso, { weekday: "short", month: "short", day: "numeric", year: undefined })}
      </span>
      <span className="text-[15px] text-slate">{formatDateTime(iso).split(" · ")[1]}</span>
    </span>
  );
}

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-board">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 text-[15px]">
        <dt className="text-[13px] font-semibold text-slate">{label}</dt>
        <dd className="flex flex-col gap-0.5">{children}</dd>
      </div>
    </div>
  );
}

function Verified({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2.5", !ok && "text-slate")}>
      <span
        className={cn(
          "flex size-[22px] items-center justify-center rounded-full",
          ok ? "bg-mint text-mint-ink" : "bg-board"
        )}
      >
        {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={2.5} />}
      </span>
      {children}
    </li>
  );
}

function depositLine(status: Trip["deposit_status"]) {
  switch (status) {
    case "held":
      return "held on their card";
    case "released":
      return "released";
    case "captured":
      return "used for a charge";
    case "failed":
      return "the hold didn't go through";
    default:
      return "held when the trip starts";
  }
}

/** Where the trip is right now, in one line. */
function nowLine(trip: HostTripDetail, guest: string) {
  switch (trip.status) {
    case "pending":
      return trip.payment_status === "authorized" ? `${guest} is waiting on your answer.` : `${guest} is finishing their payment.`;
    case "approved":
      return `${guest} picks up ${relativeDays(trip.starts_at).toLowerCase()}, ${formatDateTime(trip.starts_at)}.`;
    case "active":
      return `On the road. Back ${formatDateTime(trip.ends_at)}.`;
    case "completed":
      return `Returned ${formatDateTime(trip.ends_at)}.`;
    default:
      return trip.cancellation_reason ?? "This trip was cancelled.";
  }
}
