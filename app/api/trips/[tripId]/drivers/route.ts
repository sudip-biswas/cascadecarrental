import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTripLater } from "@/lib/notify";
import { MAX_DRIVERS, checkDriver, driverInput, driversOpen } from "@/lib/drivers";
import type { TripDriver } from "@/lib/supabase/types";

const answer = z.object({
  driverId: z.string().uuid(),
  action: z.enum(["approve", "decline", "remove"]),
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

async function loadTrip(tripId: string) {
  const { data } = await createAdminClient()
    .from("trips")
    .select("id, guest_id, host_id, status, starts_at, ends_at, vehicle:vehicles(min_age)")
    .eq("id", tripId)
    .maybeSingle();
  return data as unknown as {
    id: string;
    guest_id: string;
    host_id: string;
    status: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
    starts_at: string;
    ends_at: string;
    vehicle: { min_age: number } | null;
  } | null;
}

/** The guest adds a driver. The host has to approve them before they drive. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to add a driver.", 401);

  const parsed = driverInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the driver's details.", 400);
  const input = parsed.data;

  const trip = await loadTrip(tripId);
  if (!trip) return fail("Trip not found", 404);
  if (trip.guest_id !== user.id) return fail("Only the guest on the trip can add drivers.", 403);
  if (!driversOpen(trip)) return fail("Drivers can only be added before the trip ends.", 409);
  if (input.email === user.email?.toLowerCase()) return fail("You're already the primary driver.", 400);

  const check = checkDriver(input, trip, trip.vehicle?.min_age ?? 18);
  if (!check.ok) return fail(check.message, 400);

  const admin = createAdminClient();
  const { count } = await admin
    .from("trip_drivers")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .in("status", ["pending", "approved"]);
  if ((count ?? 0) >= MAX_DRIVERS) return fail(`A trip can have up to ${MAX_DRIVERS} extra drivers.`, 409);

  const { data: driver, error } = await admin
    .from("trip_drivers")
    .insert({
      trip_id: tripId,
      added_by: user.id,
      full_name: input.fullName,
      email: input.email,
      date_of_birth: input.dateOfBirth,
      licence_last4: input.licenceLast4,
      licence_state: input.licenceState,
      licence_expiry: input.licenceExpiry,
    })
    .select("id, full_name")
    .single();
  if (error || !driver) {
    // 23505: trip_drivers_one_live, already on the trip.
    return error?.code === "23505"
      ? fail("That driver is already on this trip.", 409)
      : fail("Couldn't add the driver. Try again.", 500);
  }

  notifyTripLater(tripId, "driver_added", { note: driver.full_name, key: driver.id });
  return NextResponse.json({ driverId: driver.id });
}

/** The host approves or declines a driver; the guest can take one off. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Unauthorized", 401);

  const parsed = answer.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid action", 400);
  const { driverId, action } = parsed.data;

  const admin = createAdminClient();
  const [trip, { data: driver }] = await Promise.all([
    loadTrip(tripId),
    admin.from("trip_drivers").select("id, status, full_name").eq("id", driverId).eq("trip_id", tripId).maybeSingle(),
  ]);
  if (!trip || !driver) return fail("Driver not found", 404);
  if (action === "remove" ? trip.guest_id !== user.id : trip.host_id !== user.id) return fail("Forbidden", 403);
  if (!driversOpen(trip)) return fail("This trip is over, so its drivers can't change.", 409);

  // Which states each action moves a driver from. The host can still decline
  // someone they approved, and approve someone they declined.
  const from: Record<typeof action, TripDriver["status"][]> = {
    approve: ["pending", "declined"],
    decline: ["pending", "approved"],
    remove: ["pending", "approved"],
  };
  const to: Record<typeof action, TripDriver["status"]> = { approve: "approved", decline: "declined", remove: "removed" };
  if (!from[action].includes(driver.status)) return fail("This driver has already changed. Refresh to see.", 409);

  const { data: moved } = await admin
    .from("trip_drivers")
    .update({ status: to[action], ...(action === "remove" ? {} : { responded_at: new Date().toISOString() }) })
    .eq("id", driverId)
    .eq("status", driver.status)
    .select("id");
  if (!moved?.length) return fail("This driver has already changed. Refresh to see.", 409);

  if (action === "approve") notifyTripLater(tripId, "driver_approved", { note: driver.full_name, key: driverId });
  if (action === "decline") notifyTripLater(tripId, "driver_declined", { note: driver.full_name, key: driverId });
  return NextResponse.json({ status: to[action] });
}
