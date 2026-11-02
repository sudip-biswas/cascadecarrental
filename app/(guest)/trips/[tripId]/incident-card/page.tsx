import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container, Divider, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimWindow } from "@/lib/claims";
import { NO_INDEX } from "@/lib/site";
import { PROTECTION_LABEL } from "@/components/host/data";
import type { Trip } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";
import { receiptNumber } from "../receipt/lines";
import { PrintButton } from "../receipt/print-button";

export const instant = false;

export const metadata: Metadata = { title: "Incident card", ...NO_INDEX };

type CardTrip = Pick<Trip, "id" | "guest_id" | "host_id" | "status" | "starts_at" | "ends_at" | "protection_plan"> & {
  vehicle: { make: string; model: string; year: number; color: string | null; license_plate: string } | null;
  host: { full_name: string; phone: string | null } | null;
  guest: { full_name: string } | null;
};

// The plate and the host's phone are private columns, so this reads as admin once the viewer is checked.
const SELECT =
  "id, guest_id, host_id, status, starts_at, ends_at, protection_plan, vehicle:vehicles(make, model, year, color, license_plate), host:profiles!host_id(full_name, phone), guest:profiles!guest_id(full_name)";

const STEPS = [
  { title: "Get safe", body: "Move out of traffic if you can. If anyone is hurt, call 911." },
  { title: "Take photos", body: "All the damage on this car, the other car, its plate and the scene." },
  { title: "Collect details", body: "The other driver's name, plate and insurance, and the names and numbers of any witnesses." },
  { title: "Tell the host", body: "Call or message them straight away." },
  { title: "Report it in the trip", body: "Within 24 hours, with your photos." },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-slate">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}

/**
 * What a driver needs at the roadside after an accident: what to do, and the
 * details to hand over. Printable. Only the guest and the host of a confirmed
 * or running trip can open it.
 */
export default async function IncidentCardPage({ params }: PageProps<"/trips/[tripId]/incident-card">) {
  const { tripId } = await params;

  const user = await getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/trips/${tripId}/incident-card`)}`);

  const { data } = await createAdminClient().from("trips").select(SELECT).eq("id", tripId).maybeSingle();
  const trip = data as unknown as CardTrip | null;
  if (!trip || (user.id !== trip.guest_id && user.id !== trip.host_id)) notFound();

  const viewer = user.id === trip.guest_id ? "guest" : "host";
  const tripPage = viewer === "guest" ? `/trips/${trip.id}` : `/host/trips/${trip.id}`;
  if (trip.status !== "approved" && trip.status !== "active") redirect(tripPage);

  const car = trip.vehicle;
  const canReport = claimWindow(trip).open;

  return (
    <Container className="flex max-w-[760px] flex-col gap-4 pt-6 pb-12 sm:pt-8 print:max-w-none print:p-0">
      <style>{`@media print { header, footer, nav { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={tripPage}>
            <ArrowLeft />
            Trip
          </Link>
        </Button>
        <PrintButton />
      </div>

      <Tile className="flex flex-col gap-6 sm:p-8 print:gap-4 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[22px] font-extrabold">Cascade</span>
            <h1 className="headline text-[clamp(36px,5vw,52px)]">Incident card</h1>
          </div>
          <span className="figures text-[15px] font-bold">#{receiptNumber(trip.id)}</span>
        </div>

        <section className="flex flex-col gap-3 break-inside-avoid">
          <h2 className="text-[20px]">If something happens</h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="figures flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-extrabold text-white print:bg-transparent print:text-ink">
                  {i + 1}
                </span>
                <span className="flex flex-col text-[15px] leading-[1.45]">
                  <span className="font-extrabold">{step.title}</span>
                  {step.body}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <Divider />

        <section className="flex flex-col gap-3 break-inside-avoid">
          <h2 className="text-[20px]">Details to hand over</h2>
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
            <Field label="Reservation">
              <span className="figures">#{receiptNumber(trip.id)}</span>
            </Field>
            <Field label="Car">{car ? `${car.year} ${car.make} ${car.model}` : "Not given"}</Field>
            <Field label="Colour">{car?.color ?? "Not given"}</Field>
            <Field label="Plate">
              <span className="figures">{car?.license_plate ?? "Not given"}</span>
            </Field>
            <Field label="Host">{trip.host?.full_name ?? "Not given"}</Field>
            <Field label="Host phone">
              {trip.host?.phone ? (
                <a href={`tel:${trip.host.phone}`} className="figures text-cobalt hover:underline print:text-ink">
                  {trip.host.phone}
                </a>
              ) : (
                "Not given"
              )}
            </Field>
            <Field label="Guest">{trip.guest?.full_name ?? "Not given"}</Field>
            <Field label="Protection plan">
              {trip.protection_plan ? PROTECTION_LABEL[trip.protection_plan] : "None"}
            </Field>
            <Field label="Pick-up">{formatDateTime(trip.starts_at)}</Field>
            <Field label="Return">{formatDateTime(trip.ends_at)}</Field>
          </dl>
        </section>

        {canReport ? (
          <Button asChild className="h-[48px] self-start text-base print:hidden">
            <Link href={`${tripPage}?report=1#claim`}>Report damage</Link>
          </Button>
        ) : (
          <p className="text-[15px] text-slate print:hidden">You can report damage from the trip once it starts.</p>
        )}
      </Tile>
    </Container>
  );
}
