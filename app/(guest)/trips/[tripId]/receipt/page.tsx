import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type Stripe from "stripe";
import { Container, Divider, PriceRow, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { NO_INDEX } from "@/lib/site";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { type TripRow, TRIP_SELECT, carName } from "../../_lib/trip-row";
import { CHARGE_LABEL, receiptLines, receiptNumber } from "./lines";
import { PrintButton } from "./print-button";

export const instant = false;

export const metadata: Metadata = { title: "Receipt", ...NO_INDEX };

const STATUS: Record<TripRow["payment_status"], string> = {
  captured: "Paid",
  authorized: "Held on your card, not charged yet",
  refunded: "Refunded",
  voided: "Hold released, nothing charged",
  pending: "Not paid",
  failed: "Payment failed",
};

/** Card and refunds from Stripe. Null when Stripe can't be reached; the receipt works without it. */
async function loadPayment(paymentIntentId: string | null): Promise<{ last4: string | null; refundedCents: number } | null> {
  if (!paymentIntentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | string | null;
    if (!charge || typeof charge === "string") return { last4: null, refundedCents: 0 };
    return { last4: charge.payment_method_details?.card?.last4 ?? null, refundedCents: charge.amount_refunded };
  } catch {
    return null;
  }
}

export default async function ReceiptPage({ params }: PageProps<"/trips/[tripId]/receipt">) {
  const { tripId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/trips/${tripId}/receipt`)}`);

  const { data } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .eq("id", tripId)
    .eq("guest_id", user.id)
    .maybeSingle();
  const trip = data as unknown as TripRow | null;
  if (!trip) notFound();

  const confirmed = trip.status === "approved" || trip.status === "active" || trip.status === "completed";
  const [{ data: charges }, { data: changes }, { data: place }, payment] = await Promise.all([
    supabase
      .from("trip_charges")
      .select("id, kind, amount_cents, description, resolved_at, responded_at, created_at")
      .eq("trip_id", tripId)
      .eq("status", "paid")
      .order("created_at"),
    supabase
      .from("trip_changes")
      .select("id, difference_cents, responded_at, created_at")
      .eq("trip_id", tripId)
      .eq("status", "accepted")
      .neq("difference_cents", 0)
      .order("created_at"),
    // The exact pick-up address is private until the host has said yes.
    confirmed && trip.vehicle && !trip.delivery_address
      ? createAdminClient().from("vehicles").select("location_address").eq("id", trip.vehicle.id).single()
      : Promise.resolve({ data: null }),
    loadPayment(trip.stripe_payment_intent_id),
  ]);

  const lines = receiptLines(trip);
  const paidCharges = charges ?? [];
  const tripChanges = changes ?? [];
  const chargesCents = paidCharges.reduce((sum, c) => sum + c.amount_cents, 0);
  // A change's refund already lowered the trip total, so only the rest of the refunds count against it.
  const changeRefunds = tripChanges.reduce((sum, c) => sum + Math.max(0, -c.difference_cents), 0);
  const charged = trip.payment_status === "captured" || trip.payment_status === "refunded";
  const refundCents = payment
    ? Math.max(0, payment.refundedCents - changeRefunds)
    : trip.payment_status === "refunded" && trip.status === "cancelled_host"
      ? trip.total_cents
      : trip.payment_status === "refunded"
        ? null
        : 0;
  const paidCents = refundCents == null ? null : (charged ? trip.total_cents : 0) - refundCents + chargesCents;

  const address = trip.delivery_address
    ? `Delivered to ${trip.delivery_address}`
    : (place?.location_address ?? trip.pickup_location);

  return (
    <Container className="flex max-w-[760px] flex-col gap-4 pt-6 pb-12 sm:pt-8 print:max-w-none print:p-0">
      <style>{`@media print { header, footer, nav { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={`/trips/${trip.id}`}>
            <ArrowLeft />
            Trip
          </Link>
        </Button>
        <PrintButton />
      </div>

      <Tile className="flex flex-col gap-6 sm:p-8 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[22px] font-extrabold">Cascade</span>
            <h1 className="headline text-[clamp(36px,5vw,52px)]">Receipt</h1>
          </div>
          <div className="figures flex flex-col items-end gap-0.5 text-[15px]">
            <span className="font-bold">#{receiptNumber(trip.id)}</span>
            <span className="text-slate">Booked {formatDate(trip.created_at)}</span>
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-[13px] font-semibold text-slate">Car</dt>
            <dd className="font-bold">
              {carName(trip)}
              {trip.vehicle ? ` ${trip.vehicle.year}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-slate">Host</dt>
            <dd className="font-bold">{trip.host?.full_name ?? "Your host"}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-slate">Pick-up</dt>
            <dd className="font-bold">{formatDateTime(trip.starts_at)}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-slate">Return</dt>
            <dd className="font-bold">{formatDateTime(trip.ends_at)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[13px] font-semibold text-slate">{trip.delivery_address ? "Delivery" : "Pick-up and return"}</dt>
            <dd className="font-bold">{address}</dd>
          </div>
        </dl>

        <Divider />

        <div className="flex flex-col gap-2.5">
          {lines.map((line) => (
            <PriceRow
              key={line.label}
              label={
                <span className="flex flex-col">
                  {line.label}
                  {line.detail && <span className="text-[13px] text-slate">{line.detail}</span>}
                </span>
              }
              value={line.cents < 0 ? `−${formatCurrency(-line.cents)}` : formatCurrency(line.cents)}
            />
          ))}
          <Divider className="mt-1" />
          <PriceRow strong label="Trip total" value={formatCurrency(trip.total_cents)} />
        </div>

        {(tripChanges.length > 0 || paidCharges.length > 0 || (refundCents ?? 1) > 0) && (
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[20px]">After booking</h2>
            {tripChanges.map((c) => (
              <PriceRow
                key={c.id}
                label={
                  <span className="flex flex-col">
                    Dates changed
                    <span className="text-[13px] text-slate">
                      {formatDate(c.responded_at ?? c.created_at)}, already in the trip total
                    </span>
                  </span>
                }
                value={
                  c.difference_cents > 0
                    ? `+${formatCurrency(c.difference_cents)}`
                    : `−${formatCurrency(-c.difference_cents)}`
                }
              />
            ))}
            {refundCents == null ? (
              <PriceRow label="Refunded to your card" value="See your card statement" />
            ) : (
              refundCents > 0 && <PriceRow label="Refunded to your card" value={`−${formatCurrency(refundCents)}`} />
            )}
            {paidCharges.map((c) => (
              <PriceRow
                key={c.id}
                label={
                  <span className="flex flex-col">
                    {CHARGE_LABEL[c.kind]}
                    <span className="text-[13px] text-slate">
                      {c.description}, paid {formatDate(c.resolved_at ?? c.responded_at ?? c.created_at)}
                    </span>
                  </span>
                }
                value={formatCurrency(c.amount_cents)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5 rounded-[18px] bg-board p-4 print:bg-transparent print:p-0">
          <PriceRow
            label="Payment"
            value={`${STATUS[trip.payment_status]}${payment?.last4 ? `, card ending ${payment.last4}` : ""}`}
          />
          {paidCents != null && <PriceRow strong label="Paid in all" value={formatCurrency(paidCents)} />}
        </div>

        <p className="text-[13px] text-slate">
          Cascade, Seattle. Questions about this receipt? Message us from your trip page and quote #{receiptNumber(trip.id)}.
        </p>
      </Tile>
    </Container>
  );
}
