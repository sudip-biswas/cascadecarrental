import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { isCancelled } from "@/lib/trips";
import { tripStatus } from "@/lib/trip-status";
import { formatCurrency, formatDateTime, pluralize } from "@/lib/utils";
import type { Trip, TripCharge } from "@/lib/supabase/types";
import { Divider, Fact, PageTitle, PriceRow, Tag, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { UUID, emailsFor, refundableCents, requireAdminPage } from "../../_lib/admin";
import { CancelButton, RefundButton } from "./trip-actions";

export const instant = false;
export const metadata = { title: "Trip · Admin", ...NO_INDEX };

type Detail = Trip & {
  guest: { full_name: string; phone: string | null; driving_license_verified: boolean; identity_status: string } | null;
  host: { full_name: string; phone: string | null; stripe_account_id: string | null } | null;
  vehicle: { make: string; model: string; year: number } | null;
  charges: Pick<TripCharge, "id" | "kind" | "amount_cents" | "status" | "created_at">[];
};

const PROTECTION = { basic: "Basic", standard: "Standard", premium: "Premium" } as const;

export default async function AdminTripPage({ params }: PageProps<"/host/admin/trips/[tripId]">) {
  const { tripId } = await params;
  await requireAdminPage(`/host/admin/trips/${tripId}`);
  if (!UUID.test(tripId)) notFound();

  const { data } = await createAdminClient()
    .from("trips")
    .select(
      "*, guest:profiles!guest_id(full_name, phone, driving_license_verified, identity_status), host:profiles!host_id(full_name, phone, stripe_account_id), vehicle:vehicles(make, model, year), charges:trip_charges(id, kind, amount_cents, status, created_at)"
    )
    .eq("id", tripId)
    .maybeSingle();
  const trip = data as unknown as Detail | null;
  if (!trip) notFound();

  const emails = await emailsFor([trip.guest_id, trip.host_id]);
  const charged = trip.payment_status === "captured" || trip.payment_status === "refunded";

  // Live from Stripe: what was taken and what's gone back. Null when Stripe can't be reached.
  let money: Awaited<ReturnType<typeof refundableCents>> | null = null;
  if (charged && trip.stripe_payment_intent_id) {
    money = await refundableCents(trip.stripe_payment_intent_id).catch(() => null);
  }

  const status = tripStatus(trip, "admin");
  const days = tripDays(trip.starts_at, trip.ends_at);
  const car = trip.vehicle ? `${trip.vehicle.year} ${trip.vehicle.make} ${trip.vehicle.model}` : "Car";
  const canCancel = !isCancelled(trip.status) && trip.status !== "completed";

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/host/admin/trips">
          <ArrowLeft />
          Trips
        </Link>
      </Button>
      <PageTitle size="md" title={car} lead={`${formatDateTime(trip.starts_at)} to ${formatDateTime(trip.ends_at)}`} action={<Tag tone={status.tone}>{status.label}</Tag>} />

      <div className="flex flex-wrap items-start gap-4">
        <main className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <Tile className="flex flex-col gap-2.5">
            <TileTitle>Money</TileTitle>
            <PriceRow label={`Rental, ${pluralize(days, "day")}`} value={formatCurrency(trip.rental_cents ?? trip.base_cents ?? trip.subtotal_cents)} />
            {trip.extras.map((e) => (
              <PriceRow key={e.id} label={`${e.name}${e.quantity > 1 ? ` × ${e.quantity}` : ""}`} value={formatCurrency(e.total_cents)} />
            ))}
            {trip.delivery_cents > 0 && <PriceRow label="Delivery" value={formatCurrency(trip.delivery_cents)} />}
            {trip.protection_plan && (
              <PriceRow label={`${PROTECTION[trip.protection_plan]} protection`} value={formatCurrency(trip.protection_cost_cents)} />
            )}
            {trip.young_driver_cents > 0 && <PriceRow label="Young driver fee" value={formatCurrency(trip.young_driver_cents)} />}
            {trip.promo_cents > 0 && <PriceRow label={`Promo ${trip.promo_code ?? ""}`} value={`−${formatCurrency(trip.promo_cents)}`} />}
            <PriceRow label="Taxes and fees" value={formatCurrency(trip.tax_cents)} />
            <Divider className="mt-1" />
            <PriceRow strong label="Guest paid" value={formatCurrency(trip.total_cents)} />
            <PriceRow label="Host's share" value={formatCurrency(hostEarningsCents(trip.subtotal_cents))} />
            {money && (
              <>
                <Divider className="mt-1" />
                <PriceRow label="Taken by Stripe" value={formatCurrency(money.capturedCents)} />
                <PriceRow label="Refunded so far" value={formatCurrency(money.refundedCents)} />
                <PriceRow label="Left to refund" value={formatCurrency(money.leftCents)} />
              </>
            )}
            {charged && !money && <p className="text-[14px] text-slate">Couldn&apos;t reach Stripe for the refund history.</p>}
          </Tile>

          {trip.charges.length > 0 && (
            <Tile className="flex flex-col gap-2.5">
              <TileTitle>Charges after the trip</TileTitle>
              {trip.charges.map((c) => (
                <PriceRow key={c.id} label={`${c.kind.replace("_", " ")} · ${c.status}`} value={formatCurrency(c.amount_cents)} />
              ))}
              <Link href="/host/admin/disputes?status=open" className="text-[14px] font-bold hover:text-cobalt">
                Open disputes
              </Link>
            </Tile>
          )}

          {(charged || canCancel) && (
            <Tile tone="board" className="flex flex-col gap-3">
              <TileTitle>Step in</TileTitle>
              <p className="text-[15px] text-slate">Both ask you to confirm before any money moves.</p>
              <div className="flex flex-wrap gap-2">
                {charged && trip.stripe_payment_intent_id && <RefundButton tripId={trip.id} leftCents={money?.leftCents ?? null} />}
                {canCancel && <CancelButton tripId={trip.id} charged={trip.payment_status === "captured"} leftCents={money?.leftCents ?? null} />}
              </div>
            </Tile>
          )}
        </main>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Tile className="flex flex-col gap-2">
            <Fact label="Guest" value={`${trip.guest?.full_name ?? ""} · ${emails[trip.guest_id] ?? ""}`} />
            <Fact
              label="Guest checks"
              value={`${trip.guest?.driving_license_verified ? "Licence checked" : "Licence not checked"}, ID ${trip.guest?.identity_status ?? "unverified"}`}
            />
            <Fact label="Host" value={`${trip.host?.full_name ?? ""} · ${emails[trip.host_id] ?? ""}`} />
            <Fact label="Payment" value={trip.payment_status} />
            {trip.deposit_cents > 0 && <Fact label="Deposit" value={`${formatCurrency(trip.deposit_cents)}, ${trip.deposit_status}`} />}
            {trip.cancellation_reason && <Fact label="Cancelled" value={trip.cancellation_reason} />}
            <Fact label="Trip id" value={<span className="font-mono text-[12px] break-all">{trip.id}</span>} />
            {trip.stripe_payment_intent_id && (
              <Fact label="Payment intent" value={<span className="font-mono text-[12px] break-all">{trip.stripe_payment_intent_id}</span>} />
            )}
          </Tile>
          <Button asChild variant="outline">
            <Link href={`/host/admin/users?q=${encodeURIComponent(emails[trip.guest_id] ?? "")}`}>Guest&apos;s account</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
