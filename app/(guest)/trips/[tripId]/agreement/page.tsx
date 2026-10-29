import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container, Divider, PriceRow, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/app/(host)/host/admin/_lib/admin";
import { loadDrivers } from "@/lib/drivers";
import { PROTECTION_DAILY_CENTS, tripDays } from "@/lib/pricing";
import { NO_INDEX } from "@/lib/site";
import type { Trip, TripInspection } from "@/lib/supabase/types";
import { formatCurrency, formatDate, formatDateTime, formatPrice, pluralize, zonedInstant } from "@/lib/utils";
import { receiptLines, receiptNumber } from "../receipt/lines";
import { PrintButton } from "../receipt/print-button";
import { atNamedSpot } from "@/components/host/locations/HandoverDetails";
import { agreementTerms } from "./terms";

export const instant = false;

export const metadata: Metadata = { title: "Trip agreement", ...NO_INDEX };

type AgreementTrip = Trip & {
  vehicle: {
    make: string;
    model: string;
    year: number;
    trim: string | null;
    color: string | null;
    license_plate: string;
    vin: string | null;
    fuel_type: string;
    min_age: number;
    location_address: string | null;
  } | null;
  host: { full_name: string } | null;
  guest: { full_name: string; driving_license_verified: boolean } | null;
};

const SELECT =
  "*, vehicle:vehicles(make, model, year, trim, color, license_plate, vin, fuel_type, min_age, location_address), host:profiles!host_id(full_name), guest:profiles!guest_id(full_name, driving_license_verified)";

const PLAN_NAME = { basic: "Basic", standard: "Standard", premium: "Premium" } as const;

const STAGE: Record<TripInspection["kind"], string> = { pickup: "Check-in", return: "Check-out" };

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[13px] font-semibold text-slate">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 break-inside-avoid">
      <h2 className="text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The trip's paperwork: who rents what from whom, when and where, and the
 * rules it runs on. Printable, for a driver to show if they're stopped. The
 * guest, the host, approved drivers and Cascade staff can open it.
 */
export default async function AgreementPage({ params }: PageProps<"/trips/[tripId]/agreement">) {
  const { tripId } = await params;

  const user = await getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/trips/${tripId}/agreement`)}`);

  // Drivers aren't on the trip row, so access is checked here and the rows read as admin.
  const admin = createAdminClient();
  const [{ data }, drivers] = await Promise.all([
    admin.from("trips").select(SELECT).eq("id", tripId).maybeSingle(),
    loadDrivers(admin, tripId),
  ]);
  const trip = data as unknown as AgreementTrip | null;
  if (!trip) notFound();

  const approved = drivers.filter((d) => d.status === "approved");
  const viewer =
    user.id === trip.guest_id
      ? "guest"
      : user.id === trip.host_id
        ? "host"
        : isAdmin(user)
          ? "admin"
          : approved.some((d) => d.profile_id === user.id)
            ? "driver"
            : null;
  if (!viewer) notFound();

  const back = {
    guest: { href: `/trips/${trip.id}`, label: "Trip" },
    host: { href: `/host/trips/${trip.id}`, label: "Trip" },
    admin: { href: `/host/admin/trips/${trip.id}`, label: "Trip" },
    driver: { href: "/trips", label: "Trips" },
  }[viewer];

  // The plate, VIN and address are only shared once the host has said yes.
  const confirmed = trip.status === "approved" || trip.status === "active" || trip.status === "completed";
  if (!confirmed && viewer !== "host" && viewer !== "admin") redirect(back.href);
  const cancelled = trip.status === "cancelled_guest" || trip.status === "cancelled_host";

  const { data: readingRows } = await admin
    .from("trip_inspections")
    .select("kind, role, odometer_mi, fuel_pct, created_at")
    .eq("trip_id", trip.id)
    .order("created_at");
  const readings = (readingRows ?? []).filter((r) => r.odometer_mi != null || r.fuel_pct != null);

  const car = trip.vehicle;
  const days = tripDays(trip.starts_at, trip.ends_at);
  const electric = car?.fuel_type === "electric";
  const place = trip.delivery_address
    ? `Delivered to ${trip.delivery_address}`
    : atNamedSpot(trip) && trip.pickup_spot_name
      ? trip.pickup_spot_name
      : (car?.location_address ?? trip.pickup_location);
  const host = trip.host?.full_name ?? "The host";
  const terms = agreementTerms({
    host: host.split(" ")[0] || "the host",
    minAge: car?.min_age ?? 21,
    electric,
    unlimitedMiles: trip.unlimited_miles,
    includedMi: trip.distance_included_mi * days,
    extraMileFeeCents: trip.extra_mile_fee_cents,
  });

  return (
    <Container className="flex max-w-[760px] flex-col gap-4 pt-6 pb-12 sm:pt-8 print:max-w-none print:p-0">
      <style>{`@media print { header, footer, nav { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={back.href}>
            <ArrowLeft />
            {back.label}
          </Link>
        </Button>
        <PrintButton />
      </div>

      <Tile className="flex flex-col gap-7 sm:p-8 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[22px] font-extrabold">Cascade</span>
            <h1 className="headline text-[clamp(36px,5vw,52px)]">Trip agreement</h1>
          </div>
          <div className="figures flex flex-col items-end gap-0.5 text-[15px]">
            <span className="font-bold">#{receiptNumber(trip.id)}</span>
            <span className="text-slate">Booked {formatDate(trip.created_at)}</span>
            {trip.approved_at && <span className="text-slate">Confirmed {formatDate(trip.approved_at)}</span>}
          </div>
        </div>

        {(cancelled || !confirmed) && (
          <p className="rounded-[16px] bg-error-soft px-4 py-3 text-[15px] font-bold text-error">
            {cancelled ? "This trip was cancelled. The agreement isn't in force." : "Not confirmed yet. The agreement starts once the host says yes."}
          </p>
        )}

        <Section title="Trip">
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            <Field label="Pick-up">{formatDateTime(trip.starts_at)}</Field>
            <Field label="Return">{formatDateTime(trip.ends_at)}</Field>
            <Field label={trip.delivery_address ? "Delivery and return" : "Pick-up and return"} wide>
              {place}
            </Field>
            <Field label="Length">{pluralize(days, "day")}</Field>
            <Field label="Times">Seattle time</Field>
          </dl>
        </Section>

        <Divider />

        <Section title="Car">
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            <Field label="Car" wide>
              {car ? `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}` : "Car"}
            </Field>
            <Field label="Colour">{car?.color ?? "Not given"}</Field>
            <Field label="Plate">
              <span className="figures">{car?.license_plate ?? "Not given"}</span>
            </Field>
            <Field label="VIN" wide>
              <span className="figures break-all">{car?.vin ?? "Not given"}</span>
            </Field>
          </dl>
          {readings.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[16px] bg-board p-3.5 text-[15px] print:bg-transparent print:p-0">
              {readings.map((r) => (
                <PriceRow
                  key={`${r.kind}-${r.role}`}
                  label={
                    <span className="flex flex-col">
                      {STAGE[r.kind]} by the {r.role}
                      <span className="text-[13px] text-slate">{formatDateTime(r.created_at)}</span>
                    </span>
                  }
                  value={[
                    r.odometer_mi != null && `${r.odometer_mi.toLocaleString("en-US")} mi`,
                    r.fuel_pct != null && `${r.fuel_pct}% ${electric ? "charge" : "fuel"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </div>
          )}
        </Section>

        <Divider />

        <Section title="Who's who">
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            <Field label="Guest, main driver">
              {trip.guest?.full_name ?? "Guest"}
              <span className="block text-[13px] font-semibold text-slate">
                {trip.guest?.driving_license_verified ? "Licence checked by Cascade" : "Licence not checked yet"}
              </span>
            </Field>
            <Field label="Host, the car's owner">{host}</Field>
            {approved.map((d) => (
              <Field key={d.id} label="Added driver">
                {d.full_name}
                <span className="figures block text-[13px] font-semibold text-slate">
                  {d.licence_state} licence ending {d.licence_last4}, valid to {formatDate(zonedInstant(d.licence_expiry))}
                </span>
              </Field>
            ))}
            <Field label="Rented through" wide>
              Cascade, Seattle. Questions or problems: message from the trip page.
            </Field>
          </dl>
        </Section>

        <Divider />

        <Section title="Protection">
          <p className="text-[15px]">
            {trip.protection_plan ? (
              <>
                <strong>{PLAN_NAME[trip.protection_plan]} plan</strong>, {formatPrice(PROTECTION_DAILY_CENTS[trip.protection_plan])} a
                day, bought at booking.
              </>
            ) : (
              <>
                <strong>No protection plan.</strong> The guest&apos;s own insurance covers the car, or the guest does.
              </>
            )}
          </p>
          {trip.deposit_cents > 0 && (trip.deposit_status === "held" || trip.deposit_status === "released") && (
            <p className="text-[15px] text-slate">
              A {formatCurrency(trip.deposit_cents)} deposit{" "}
              {trip.deposit_status === "held" ? "is held on the guest's card until after the trip." : "was held and has been released."}
            </p>
          )}
        </Section>

        <Divider />

        <Section title="Price">
          <div className="flex flex-col gap-2.5">
            {receiptLines(trip).map((line) => (
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
        </Section>

        <Divider />

        <Section title="The rules">
          <ol className="flex flex-col gap-4">
            {terms.map((t, i) => (
              <li key={t.title} className="flex flex-col gap-1 break-inside-avoid">
                <span className="text-base font-extrabold">
                  {i + 1}. {t.title}
                </span>
                {t.body.map((line) => (
                  <span key={line} className="text-[15px] leading-[1.45]">
                    {line}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </Section>

        <p className="text-[13px] text-slate">
          Booking this trip on Cascade means the guest and every added driver agree to these rules, and the host agrees to
          hand over the car as listed. Quote #{receiptNumber(trip.id)} in any message about it.
        </p>
      </Tile>
    </Container>
  );
}
