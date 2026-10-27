import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MessageTemplate, ScheduledMessage, Trip } from "@/lib/supabase/types";
import { notify } from "@/lib/notify";
import { AIRPORT } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/site";
import { formatDay, formatTime } from "@/lib/utils";
import { fillVariables, type TripType } from "@/components/messaging/scheduled/options";

export * from "@/components/messaging/scheduled/options";

type TripTimes = Pick<Trip, "starts_at" | "ends_at" | "approved_at" | "created_at">;

/** When a template goes out on a trip. */
export function sendTime(t: Pick<MessageTemplate, "event" | "offset_minutes" | "direction">, trip: TripTimes): Date {
  const start = new Date(trip.starts_at).getTime();
  const end = new Date(trip.ends_at).getTime();
  const anchor = {
    booked: new Date(trip.approved_at ?? trip.created_at).getTime(),
    trip_start: start,
    three_quarters: start + (end - start) * 0.75,
    trip_end: end,
  }[t.event];
  // Nothing can go out before the booking it belongs to.
  const sign = t.direction === "before" && t.event !== "booked" ? -1 : 1;
  return new Date(anchor + sign * t.offset_minutes * 60_000);
}

type DeliveryTrip = Pick<Trip, "delivery_address" | "pickup_spot_kind">;

export function matchesTripType(type: TripType, trip: DeliveryTrip): boolean {
  // Trips booked before pickup spots carry only the address.
  const kind = trip.pickup_spot_kind;
  const delivered = kind ? kind !== "car" && kind !== "home" : !!trip.delivery_address;
  const airport = kind ? kind === "airport" : trip.delivery_address === AIRPORT.name;
  switch (type) {
    case "all":
      return true;
    case "any_delivery":
      return delivered;
    case "no_delivery":
      return !delivered;
    case "custom_delivery":
      return kind ? kind === "custom" : delivered && !airport;
    case "airport_delivery":
      return airport;
  }
}

/** A template added later shouldn't fire for moments a trip has already passed. */
const LATE_START_MS = 15 * 60 * 1000;
/** Past this, a message is about a moment long gone, so it's skipped instead of sent. */
const TOO_LATE_MS = 36 * 60 * 60 * 1000;

const SYNC_TRIP_SELECT =
  "id, host_id, guest_id, vehicle_id, status, payment_status, starts_at, ends_at, approved_at, created_at, delivery_address, pickup_spot_kind";

type SyncTrip = Pick<
  Trip,
  | "id"
  | "host_id"
  | "guest_id"
  | "vehicle_id"
  | "status"
  | "payment_status"
  | "starts_at"
  | "ends_at"
  | "approved_at"
  | "created_at"
  | "delivery_address"
  | "pickup_spot_kind"
>;

const isBooked = (trip: Pick<Trip, "status" | "payment_status">) =>
  ["approved", "active", "completed"].includes(trip.status) && trip.payment_status === "captured";

/**
 * Lines up a trip's scheduled messages with the host's templates. Call it
 * when a trip is booked, its dates move, or it's cancelled: new matches are
 * queued, times follow the trip, and anything that no longer applies is
 * cancelled. Sent and skipped ones are left alone. Never throws.
 */
export async function syncTripMessages(tripId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: trip } = await admin.from("trips").select(SYNC_TRIP_SELECT).eq("id", tripId).maybeSingle();
    if (!trip) return;
    await syncTrip(trip);
  } catch (err) {
    console.error("[scheduled-messages] sync failed", tripId, err);
  }
}

const QUEUE_SELECT = "id, trip_id, template_id, status, name, body, send_at";
type Queued = Pick<ScheduledMessage, "id" | "trip_id" | "template_id" | "status" | "name" | "body" | "send_at">;

async function syncTrip(trip: SyncTrip, templates?: MessageTemplate[], queued?: Queued[]) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (!queued) {
    const { data } = await admin.from("scheduled_messages").select(QUEUE_SELECT).eq("trip_id", trip.id);
    queued = data ?? [];
  }
  const existing = queued;

  if (!isBooked(trip)) {
    // Cancelled, or not paid for yet: nothing should go out.
    const waiting = existing.filter((s) => s.status === "scheduled").map((s) => s.id);
    if (waiting.length) {
      await admin.from("scheduled_messages").update({ status: "cancelled", updated_at: now }).in("id", waiting);
    }
    return;
  }

  if (!templates) {
    const { data } = await admin.from("message_templates").select("*").eq("host_id", trip.host_id).eq("active", true);
    templates = data ?? [];
  }
  const matching = templates.filter(
    (t) =>
      t.active &&
      (!t.vehicle_ids || t.vehicle_ids.includes(trip.vehicle_id)) &&
      matchesTripType(t.trip_type, trip)
  );

  const inserts = [];
  for (const t of matching) {
    const at = sendTime(t, trip);
    const row = existing.find((s) => s.template_id === t.id);
    const late = at.getTime() < Date.now() - LATE_START_MS;
    // A booking time in the future is bad data, not a booking still to come.
    const unbooked = t.event === "booked" && at.getTime() - t.offset_minutes * 60_000 > Date.now() + 60_000;
    if (!row) {
      if (late || unbooked) continue;
      inserts.push({
        template_id: t.id,
        trip_id: trip.id,
        host_id: trip.host_id,
        guest_id: trip.guest_id,
        name: t.name,
        body: t.body,
        send_at: at.toISOString(),
      });
    } else if (
      (row.status === "scheduled" &&
        (row.name !== t.name || row.body !== t.body || new Date(row.send_at).getTime() !== at.getTime())) ||
      (row.status === "cancelled" && !late)
    ) {
      // Follows template edits and new trip times. A template switched back on picks its trips up again.
      await admin
        .from("scheduled_messages")
        .update({ name: t.name, body: t.body, send_at: at.toISOString(), status: "scheduled", updated_at: now })
        .eq("id", row.id)
        .eq("status", row.status);
    }
  }
  if (inserts.length) {
    // The unique (trip, template) pair makes a second sync at the same moment a no-op.
    await admin.from("scheduled_messages").upsert(inserts, { onConflict: "trip_id,template_id", ignoreDuplicates: true });
  }

  const keep = new Set(matching.map((t) => t.id));
  const dropped = existing.filter((s) => s.status === "scheduled" && (!s.template_id || !keep.has(s.template_id)));
  if (dropped.length) {
    await admin
      .from("scheduled_messages")
      .update({ status: "cancelled", updated_at: now })
      .in("id", dropped.map((s) => s.id))
      .eq("status", "scheduled");
  }
}

/**
 * Re-syncs every upcoming or ongoing trip of a host, after they add, edit,
 * switch or delete a template.
 */
export async function syncHostMessages(hostId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: trips }, { data: templates }] = await Promise.all([
    admin
      .from("trips")
      .select(SYNC_TRIP_SELECT)
      .eq("host_id", hostId)
      .in("status", ["approved", "active"])
      .eq("payment_status", "captured")
      .gt("ends_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    admin.from("message_templates").select("*").eq("host_id", hostId).eq("active", true),
  ]);
  // The queue is read a hundred trips at a time, so only rows that change cost a write.
  const byTrip = new Map<string, Queued[]>();
  const ids = (trips ?? []).map((t) => t.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { data: queued } = await admin.from("scheduled_messages").select(QUEUE_SELECT).in("trip_id", ids.slice(i, i + 100));
    for (const row of queued ?? []) byTrip.set(row.trip_id, [...(byTrip.get(row.trip_id) ?? []), row]);
  }
  for (const trip of trips ?? []) {
    try {
      await syncTrip(trip, templates ?? [], byTrip.get(trip.id) ?? []);
    } catch (err) {
      console.error("[scheduled-messages] sync failed", trip.id, err);
    }
  }
}

/**
 * Re-syncs a trip's queue once the response is out, so booking, cancelling
 * or moving a trip never waits on it. Right after a booking, `sendDue` also
 * posts what's already due, like a welcome message set to go immediately.
 */
export function syncTripMessagesLater(tripId: string, { sendDue = false } = {}): void {
  const run = async () => {
    await syncTripMessages(tripId);
    if (sendDue) await sendDueScheduledMessages({ tripId });
  };
  const safe = () => run().catch((err) => console.error("[scheduled-messages] failed", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

interface SendTrip {
  id: string;
  guest_id: string;
  host_id: string;
  status: Trip["status"];
  payment_status: Trip["payment_status"];
  starts_at: string;
  ends_at: string;
  pickup_location: string;
  delivery_address: string | null;
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
  vehicle: { make: string; model: string; license_plate: string | null; location_address: string | null } | null;
}

const first = (name: string | null | undefined, fallback: string) => name?.trim().split(/\s+/)[0] || fallback;

function tripValues(trip: SendTrip): Record<string, string> {
  const car = trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "car";
  return {
    GuestName: first(trip.guest?.full_name, "there"),
    HostName: first(trip.host?.full_name, "your host"),
    CarName: car,
    LicensePlate: trip.vehicle?.license_plate ?? "",
    TripStartDate: formatDay(trip.starts_at),
    TripStartTime: formatTime(trip.starts_at),
    TripEndDate: formatDay(trip.ends_at),
    TripEndTime: formatTime(trip.ends_at),
    PickupLocation: trip.delivery_address ?? trip.pickup_location,
    PickupAddress: trip.delivery_address ?? trip.vehicle?.location_address ?? trip.pickup_location,
    TripLink: absoluteUrl(`/trips/${trip.id}`),
  };
}

/** The trip's conversation, started by the host if the guest hasn't written yet. */
async function tripConversation(trip: SendTrip): Promise<string | null> {
  const admin = createAdminClient();
  const find = () =>
    admin
      .from("conversations")
      .select("id")
      .eq("guest_id", trip.guest_id)
      .eq("host_id", trip.host_id)
      .eq("trip_id", trip.id)
      .maybeSingle();
  const { data: found } = await find();
  if (found) return found.id;
  const { data: created } = await admin
    .from("conversations")
    .insert({ guest_id: trip.guest_id, host_id: trip.host_id, trip_id: trip.id })
    .select("id")
    .single();
  // Lost a race with someone else starting it: use theirs.
  return created?.id ?? (await find()).data?.id ?? null;
}

export interface SendResult {
  sent: number;
  skipped: number;
}

/**
 * Posts every scheduled message that's due into its trip's conversation, as
 * the host, and tells the guest the way any new message does. `userId`
 * limits it to one person's trips (host or guest), `tripId` to one trip.
 * One small query when nothing is due. Each row is claimed before it's sent,
 * so overlapping runs can't post it twice.
 */
export async function sendDueScheduledMessages(scope: { userId?: string; tripId?: string } = {}): Promise<SendResult> {
  const admin = createAdminClient();
  const now = new Date();
  let query = admin
    .from("scheduled_messages")
    .select("id, trip_id, body, send_at")
    .eq("status", "scheduled")
    .lte("send_at", now.toISOString())
    .order("send_at")
    .limit(100);
  if (scope.userId) query = query.or(`host_id.eq.${scope.userId},guest_id.eq.${scope.userId}`);
  if (scope.tripId) query = query.eq("trip_id", scope.tripId);
  const { data: due } = await query;
  const result: SendResult = { sent: 0, skipped: 0 };
  if (!due?.length) return result;

  const { data: tripRows } = await admin
    .from("trips")
    .select(
      "id, guest_id, host_id, status, payment_status, starts_at, ends_at, pickup_location, delivery_address, guest:profiles!guest_id(full_name), host:profiles!host_id(full_name), vehicle:vehicles(make, model, license_plate, location_address)"
    )
    .in("id", [...new Set(due.map((d) => d.trip_id))]);
  const trips = new Map(((tripRows ?? []) as unknown as SendTrip[]).map((t) => [t.id, t]));

  for (const item of due) {
    const trip = trips.get(item.trip_id);
    const stamp = new Date().toISOString();
    const close = (status: ScheduledMessage["status"]) =>
      admin
        .from("scheduled_messages")
        .update({ status, updated_at: stamp })
        .eq("id", item.id)
        .eq("status", "scheduled");

    if (!trip || !isBooked(trip)) {
      await close("cancelled");
      continue;
    }
    if (now.getTime() - new Date(item.send_at).getTime() > TOO_LATE_MS) {
      await close("skipped");
      result.skipped++;
      continue;
    }

    const { data: claimed } = await admin
      .from("scheduled_messages")
      .update({ status: "sent", sent_at: stamp, updated_at: stamp })
      .eq("id", item.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    try {
      const conversationId = await tripConversation(trip);
      if (!conversationId) throw new Error("no conversation");
      const body = fillVariables(item.body, tripValues(trip)).trim().slice(0, 2000);
      const { data: message, error } = await admin
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: trip.host_id, body })
        .select("id")
        .single();
      if (error) throw error;
      await admin.from("scheduled_messages").update({ message_id: message.id }).eq("id", item.id);

      const host = first(trip.host?.full_name, "Your host");
      await notify({
        userId: trip.guest_id,
        kind: "message",
        title: `New message from ${host}`,
        body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
        href: `/messages/${conversationId}`,
        tripId: trip.id,
        dedupeKey: `scheduled-message:${item.id}`,
        actionLabel: "Read and reply",
      });
      result.sent++;
    } catch (err) {
      // Put it back so the next run tries again.
      console.error("[scheduled-messages] send failed", item.id, err);
      await admin
        .from("scheduled_messages")
        .update({ status: "scheduled", sent_at: null, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }
  }
  return result;
}
