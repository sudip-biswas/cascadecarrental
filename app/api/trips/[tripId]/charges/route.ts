import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTrip } from "@/lib/notify";
import { OPEN_CHARGE_STATUSES, chargeGuest, createCharge, followClaim } from "@/lib/charges";
import { CHARGE_KIND_VALUES, LONG_TRIP_DAYS, chargeWindow, chargeWindowDays, isLongTrip } from "@/lib/charge-windows";
import { hasOpenClaim } from "@/lib/claims";
import { milesDriven } from "@/lib/inspections";
import { readPhotos, removePhotos, uploadPhotos } from "@/lib/trip-photos";
import { formatCurrency } from "@/lib/utils";
import { kindLabel } from "@/components/trip-panels/charges/kinds";

const createSchema = z.object({
  kind: z.enum(CHARGE_KIND_VALUES),
  // Ignored for extra miles: that one is worked out from the odometers.
  amountCents: z.coerce.number().int().min(100).max(2_000_000).optional(),
  description: z.string().trim().min(3).max(2000),
});

const updateSchema = z.object({
  chargeId: z.string().uuid(),
  action: z.enum(["pay", "dispute", "cancel"]),
  note: z.string().trim().max(2000).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function caller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The host sends a charge: extra miles, fuel, tolls, cleaning and so on. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to send a charge.", 401);

  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, host_id, guest_id, status, starts_at, ends_at")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.host_id !== user.id) return fail("Trip not found.", 404);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);
  const parsed = createSchema.safeParse({
    kind: form.get("kind"),
    amountCents: form.get("amountCents") || undefined,
    description: form.get("description"),
  });
  if (!parsed.success) return fail("Pick what it's for, add an amount of at least $1 and a short note.", 400);
  const { kind, description } = parsed.data;

  const window = chargeWindow(trip, kind);
  if (!window.open) {
    if (trip.status === "active") {
      return fail(
        kind === "ticket"
          ? `During the trip, tickets can only go on trips of ${LONG_TRIP_DAYS} days or more. This one can wait until it's done.`
          : "During the trip you can only send tolls. The rest can wait until it's done.",
        409
      );
    }
    return fail(
      trip.status === "completed"
        ? `${kindLabel(kind)} can be sent for ${chargeWindowDays(kind)} days after the trip. That window has closed.`
        : "You can send charges once the trip has started.",
      409
    );
  }
  if (window.midTrip && isLongTrip(trip)) {
    // Long trips get one toll or ticket at a time, so a guest is never stacked with them.
    const { data: open } = await admin
      .from("trip_charges")
      .select("id")
      .eq("trip_id", tripId)
      .in("kind", ["tolls", "ticket"])
      .in("status", OPEN_CHARGE_STATUSES)
      .limit(1);
    if (open?.length) return fail("There's already an open toll or ticket on this trip. Wait until it's settled.", 409);
  }
  if (kind === "damage" && (await hasOpenClaim(tripId))) {
    return fail("This trip has an open damage claim. Ask the guest to pay from the claim.", 409);
  }

  let amountCents = parsed.data.amountCents;
  if (kind === "extra_miles") {
    const miles = await milesDriven(tripId);
    if (!miles) return fail("Extra miles need both odometer readings, at check-in and check-out.", 409);
    if (miles.overCents < 100) return fail("The guest stayed within the miles included.", 409);
    amountCents = miles.overCents;
  }
  if (!amountCents) return fail("Add an amount of at least $1.", 400);

  const upload = readPhotos(form);
  if (upload.error !== undefined) return fail(upload.error, 400);
  const photos = await uploadPhotos(tripId, "charges", upload.files, upload.types);
  if (!photos) return fail("Upload failed. Try again.", 500);

  const charge = await createCharge({
    tripId,
    hostId: trip.host_id,
    guestId: trip.guest_id,
    kind,
    amountCents,
    description,
    photos,
  });
  if (!charge) {
    await removePhotos(photos);
    return fail("Couldn't send the charge. Try again.", 500);
  }

  await notifyTrip(tripId, "charge_requested", { amountCents, note: description, key: charge.id });
  return NextResponse.json({ charge });
}

/** The guest pays or disputes a charge; the host can take back one that's still open. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to answer this charge.", 401);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Something's off. Refresh and try again.", 400);
  const { chargeId, action, note } = parsed.data;

  const admin = createAdminClient();
  const { data: charge } = await admin
    .from("trip_charges")
    .select("*")
    .eq("id", chargeId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!charge || (charge.guest_id !== user.id && charge.host_id !== user.id)) return fail("Charge not found.", 404);
  const now = new Date().toISOString();

  if (action === "cancel") {
    if (charge.host_id !== user.id) return fail("Only the host can take a charge back.", 403);
    const { data } = await admin
      .from("trip_charges")
      .update({ status: "cancelled", resolved_at: now })
      .eq("id", chargeId)
      .in("status", ["requested", "disputed", "failed"])
      .select("status")
      .maybeSingle();
    if (!data) return fail("This charge is already settled.", 409);
    await followClaim(chargeId, "dropped");
    return NextResponse.json({ status: "cancelled" });
  }

  if (charge.guest_id !== user.id) return fail("Only the guest can answer a charge.", 403);

  if (action === "dispute") {
    if (!note || note.length < 3) return fail("Tell us why you disagree.", 400);
    const { data } = await admin
      .from("trip_charges")
      .update({ status: "disputed", guest_note: note, responded_at: now })
      .eq("id", chargeId)
      .in("status", ["requested", "failed"])
      .select("status")
      .maybeSingle();
    if (!data) return fail("This charge can't be disputed any more.", 409);
    await followClaim(chargeId, "disputed");
    await notifyTrip(tripId, "charge_disputed", { amountCents: charge.amount_cents, note, key: chargeId });
    return NextResponse.json({ status: "disputed" });
  }

  const result = await chargeGuest(chargeId);
  if (!result.ok) return fail(result.error, 402);
  return NextResponse.json({
    status: "paid",
    message: result.fromDeposit
      ? `Paid ${formatCurrency(charge.amount_cents)} from your deposit.`
      : `Paid ${formatCurrency(charge.amount_cents)}.`,
  });
}
