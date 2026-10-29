import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Container, Divider, PriceRow, Tag, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { CancelTripButton } from "@/components/trips/CancelTripButton";
import { ReviewForm } from "@/components/trips/ReviewForm";
import { InspectionPanel } from "@/components/trip-panels/InspectionPanel";
import { ChargesPanel } from "@/components/trip-panels/ChargesPanel";
import { ChangePanel } from "@/components/trip-panels/ChangePanel";
import { DriversPanel } from "@/components/trip-panels/DriversPanel";
import { ChecksPanel } from "@/components/trip-panels/ChecksPanel";
import { InstructionsPanel, InstructionsWelcome } from "@/components/trip-panels/InstructionsPanel";
import { freeCancellationUntil, guestCancellation } from "@/lib/cancellation";
import { tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDate, formatDateShort, formatDateTime, pluralize } from "@/lib/utils";
import { receiptLines } from "../[tripId]/receipt/lines";
import { type TripRow, carName, hostFirstName, paidLabel } from "../_lib/trip-row";
import { CarSummary, type Step, Steps, daysBetween, mapsUrl } from "./parts";
import { AutoRefresh } from "./auto-refresh";
import { HandoverDetails, atNamedSpot, spotDirections } from "@/components/host/locations/HandoverDetails";

function headline(trip: TripRow, host: string, now: Date): string {
  switch (trip.status) {
    case "pending":
      return trip.payment_status === "authorized" ? `Waiting on ${host}.` : "Finishing your payment.";
    case "approved": {
      const days = daysBetween(now, trip.starts_at);
      if (days <= 0) return "You're set for today.";
      if (days === 1) return "You're set for tomorrow.";
      if (days < 7) return `You're set for ${formatDate(trip.starts_at, { weekday: "long", month: undefined, day: undefined, year: undefined })}.`;
      return `You're set for ${formatDateShort(trip.starts_at)}.`;
    }
    case "active":
      return "Enjoy the drive.";
    case "completed":
      return "Hope it went well.";
    default:
      return "This trip was cancelled.";
  }
}

function steps(trip: TripRow, host: string): Step[] {
  const instant = trip.vehicle?.instant_book ?? false;
  const list: Step[] = [{ label: instant ? "Booked" : "Requested", when: formatDateTime(trip.created_at), done: true }];
  if (trip.status === "cancelled_guest" || trip.status === "cancelled_host") {
    list.push({
      label: trip.cancellation_reason ?? "Cancelled",
      when: trip.cancelled_at ? formatDateTime(trip.cancelled_at) : undefined,
      done: true,
    });
    return list;
  }
  const accepted = ["approved", "active", "completed"].includes(trip.status);
  if (!instant) {
    list.push(
      accepted
        ? { label: `${host} said yes, card charged`, done: true }
        : { label: `${host} answers`, when: "Yes charges your card. No releases the hold.", done: false }
    );
  }
  list.push({
    label: "Pick up the keys",
    when: `${formatDateTime(trip.starts_at)}. Take a few photos of the car before you drive off.`,
    done: trip.status === "active" || trip.status === "completed",
  });
  list.push({
    label: "Bring it back",
    when: `${formatDateTime(trip.ends_at)}. Then you can leave a review.`,
    done: trip.status === "completed",
  });
  return list;
}

/** Day strip from today to the return date, when it's short enough to read. */
function Countdown({ trip, now }: { trip: TripRow; now: Date }) {
  const toStart = daysBetween(now, trip.starts_at);
  const length = daysBetween(trip.starts_at, trip.ends_at) + 1;
  if (toStart < 1 || toStart + length > 21) return null;
  const cells = Array.from({ length: toStart + length }, (_, i) => (i === 0 ? "today" : i < toStart ? "wait" : "trip"));
  const day = (d: string) => formatDate(d, { weekday: "short", day: "numeric", month: undefined, year: undefined });

  return (
    <Tile className="flex flex-[1_1_360px] flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold text-slate">Until pick-up</span>
        <span className="font-display text-[40px] font-extrabold">{pluralize(toStart, "day")}</span>
      </div>
      <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} aria-hidden>
        {cells.map((c, i) => (
          <span
            key={i}
            className={cn("h-10 rounded-[8px]", c === "today" ? "bg-ink" : c === "wait" ? "bg-line" : "bg-cobalt")}
          />
        ))}
      </div>
      <div className="flex justify-between text-[13px] font-semibold text-slate">
        <span>Today</span>
        <span>{day(trip.starts_at)}</span>
        <span>{day(trip.ends_at)}</span>
      </div>
    </Tile>
  );
}

export function TripView({
  trip,
  reviewed,
  userId,
  verifyReturned = false,
}: {
  trip: TripRow;
  reviewed: boolean;
  userId: string;
  /** Just back from Stripe's licence check. */
  verifyReturned?: boolean;
}) {
  const now = new Date();
  const host = hostFirstName(trip);
  const status = tripStatus(trip, "guest");
  const confirmed = trip.status === "approved" || trip.status === "active";
  const cancelled = trip.status === "cancelled_guest" || trip.status === "cancelled_host";
  const terms = guestCancellation(trip, now);
  // A delivered car comes to the guest, so there's nowhere to get directions to.
  const namedSpot = atNamedSpot(trip);
  const directions = namedSpot ? spotDirections(trip) : trip.delivery_address ? null : mapsUrl(trip);
  const heroTone = cancelled ? "peach" : "sky";

  return (
    <>
      {trip.status === "pending" && trip.payment_status === "pending" && <AutoRefresh />}
      <section className={cn("py-10 sm:pb-12", cancelled ? "bg-peach" : "bg-sky")}>
        <Container className="flex flex-wrap items-center gap-7">
          <div className="flex flex-[999_1_520px] flex-col items-start gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/trips">
                <ArrowLeft />
                Trips
              </Link>
            </Button>
            <Tag tone={status.tone === heroTone ? "white" : status.tone}>{status.label}</Tag>
            <h1 className="headline text-[clamp(44px,6.4vw,96px)] leading-[0.98]">{headline(trip, host, now)}</h1>
          </div>
          {(trip.status === "pending" || trip.status === "approved") && <Countdown trip={trip} now={now} />}
        </Container>
      </section>

      <Container className="flex flex-wrap items-start gap-4 py-6">
        <main className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <InstructionsWelcome tripId={trip.id} viewer="guest" userId={userId} />
          <ChecksPanel tripId={trip.id} userId={userId} returned={verifyReturned} />
          {!cancelled && (
            <Tile className="flex flex-col gap-3 sm:p-6">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate">
                <MapPin className="size-4" strokeWidth={1.75} />
                {trip.delivery_address && !namedSpot ? "Delivered to you" : "Pick-up and return"}
              </span>
              <span className="font-display text-[clamp(24px,3vw,30px)] leading-[1.12] font-extrabold tracking-[-0.02em]">
                {namedSpot
                  ? trip.pickup_spot_name
                  : (trip.delivery_address ??
                    (confirmed && trip.vehicle?.location_address ? trip.vehicle.location_address : trip.pickup_location))}
              </span>
              <HandoverDetails trip={trip} show={confirmed} waitingOn={trip.status === "pending" ? host : undefined} />
              {!confirmed && !trip.delivery_address && trip.status === "pending" && (
                <span className="text-[15px] text-slate">The exact spot shows here once {host} says yes.</span>
              )}
              <span className="mt-1 flex flex-wrap gap-2">
                {confirmed && directions && (
                  <Button asChild>
                    <a href={directions} target="_blank" rel="noreferrer">
                      Directions
                    </a>
                  </Button>
                )}
                <Button asChild variant="secondary">
                  <Link href={`/messages/new?trip=${trip.id}`}>Message {host}</Link>
                </Button>
              </span>
            </Tile>
          )}

          <InstructionsPanel tripId={trip.id} viewer="guest" userId={userId} />

          {trip.status === "completed" && !reviewed && <ReviewForm tripId={trip.id} carName={carName(trip)} />}

          <ChangePanel tripId={trip.id} viewer="guest" userId={userId} />
          <DriversPanel tripId={trip.id} userId={userId} />
          <InspectionPanel tripId={trip.id} viewer="guest" userId={userId} />
          <ChargesPanel tripId={trip.id} viewer="guest" userId={userId} />

          <Tile className="flex flex-col gap-4 sm:p-6">
            <TileTitle>The trip</TileTitle>
            <Steps steps={steps(trip, host)} />
          </Tile>
        </main>

        <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
          <CarSummary
            trip={trip}
            detail={[
              trip.vehicle ? `${trip.vehicle.year}${trip.vehicle.trim ? ` ${trip.vehicle.trim}` : ""}` : null,
              `${trip.distance_included_mi} mi a day`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          <Tile className="flex flex-col gap-2.5">
            <TileTitle className="mb-1 text-[24px]">Receipt</TileTitle>
            {receiptLines(trip).map((line, i) => (
              <PriceRow
                key={line.label}
                label={i === 0 && line.detail ? line.detail : line.label}
                value={line.cents < 0 ? `−${formatCurrency(-line.cents)}` : formatCurrency(line.cents)}
              />
            ))}
            <Divider className="mt-1" />
            <PriceRow strong label={paidLabel(trip)} value={formatCurrency(trip.total_cents)} />
            {!cancelled && trip.payment_status !== "pending" && (
              <div className="mt-1 flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/trips/${trip.id}/receipt`}>Full receipt</Link>
                </Button>
                {trip.status !== "pending" && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/trips/${trip.id}/agreement`}>Trip agreement</Link>
                  </Button>
                )}
              </div>
            )}
          </Tile>

          {terms.canCancel && (
            <Tile tone="peach" className="flex flex-col gap-3">
              <TileTitle className="text-[24px]">Cancelling</TileTitle>
              <p className="text-[15px] leading-[1.45]">
                <CancelTerms trip={trip} now={now} /> {terms.summary}
              </p>
              <div className="figures flex items-baseline justify-between rounded-[16px] bg-white px-3.5 py-3 text-ink">
                <span className="text-[15px] font-semibold">
                  {trip.payment_status === "captured" ? "You'd get back" : "Charged so far"}
                </span>
                <span className="text-[22px] font-extrabold">
                  {formatCurrency(trip.payment_status === "captured" ? terms.refundCents : 0)}
                </span>
              </div>
              <CancelTripButton
                tripId={trip.id}
                summary={terms.summary}
                refundCents={terms.refundCents}
                charged={trip.payment_status === "captured"}
              />
            </Tile>
          )}
        </aside>
      </Container>
    </>
  );
}

function CancelTerms({ trip, now }: { trip: TripRow; now: Date }) {
  const until = freeCancellationUntil(trip);
  if (trip.rate_type === "refundable") return <>You picked free cancellation, so it&apos;s free until pick-up.</>;
  return now < until ? (
    <>You picked pay now. It&apos;s free to cancel until {formatDateTime(until)}.</>
  ) : (
    <>You picked pay now. Free cancellation ended {formatDateTime(until)}.</>
  );
}
