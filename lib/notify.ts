import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { formatCurrency, formatDateTime, formatRange } from "@/lib/utils";

export interface Notice {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  tripId?: string | null;
  /** Same key, same notice: retries and the cron never send it twice. */
  dedupeKey?: string;
  email?: boolean;
  actionLabel?: string;
}

/** Adds a notice to someone's feed and emails it. Never throws. */
export async function notify(notice: Notice): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("notifications")
      .insert({
        user_id: notice.userId,
        kind: notice.kind,
        title: notice.title,
        body: notice.body ?? null,
        href: notice.href ?? null,
        trip_id: notice.tripId ?? null,
        dedupe_key: notice.dedupeKey ?? null,
      })
      .select("id")
      .single();
    // 23505: already sent.
    if (error) {
      if (error.code !== "23505") console.error("[notify]", error.message);
      return;
    }
    if (notice.email === false) return;

    const { data } = await admin.auth.admin.getUserById(notice.userId);
    const to = data.user?.email;
    if (!to) return;
    const sent = await sendEmail({
      to,
      subject: notice.title,
      lines: notice.body ? notice.body.split("\n") : [],
      action: notice.href ? { label: notice.actionLabel ?? "Open Cascade", href: notice.href } : undefined,
    });
    if (sent) {
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

interface TripContext {
  id: string;
  guest_id: string;
  host_id: string;
  starts_at: string;
  ends_at: string;
  total_cents: number;
  pickup_location: string;
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
  vehicle: { make: string; model: string; location_address: string | null } | null;
}

async function loadTrip(tripId: string): Promise<TripContext | null> {
  const { data } = await createAdminClient()
    .from("trips")
    .select(
      "id, guest_id, host_id, starts_at, ends_at, total_cents, pickup_location, guest:profiles!guest_id(full_name), host:profiles!host_id(full_name), vehicle:vehicles(make, model, location_address)"
    )
    .eq("id", tripId)
    .maybeSingle();
  return data as unknown as TripContext | null;
}

const first = (name: string | undefined | null, fallback: string) => name?.trim().split(/\s+/)[0] || fallback;

export type TripEvent =
  | "requested"
  | "booked"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled_by_guest"
  | "cancelled_by_host"
  | "cancelled_by_cascade"
  | "pickup_soon"
  | "return_soon"
  | "completed"
  | "change_requested"
  | "change_accepted"
  | "change_declined"
  | "charge_requested"
  | "charge_paid"
  | "charge_disputed"
  | "charge_failed"
  | "deposit_held"
  | "deposit_released"
  | "review_from_guest"
  | "review_from_host"
  | "driver_added"
  | "driver_approved"
  | "driver_declined";

/**
 * The emails and feed items for one moment in a trip, to whoever needs them.
 * `extra` fills in amounts and notes for the events that have them.
 */
export async function notifyTrip(
  tripId: string,
  event: TripEvent,
  extra: { amountCents?: number; note?: string; key?: string } = {}
): Promise<void> {
  const trip = await loadTrip(tripId);
  if (!trip) return;
  const car = trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "car";
  const guest = first(trip.guest?.full_name, "Your guest");
  const host = first(trip.host?.full_name, "Your host");
  const when = formatRange(trip.starts_at, trip.ends_at);
  const guestTrip = `/trips/${trip.id}`;
  const hostTrip = `/host/trips/${trip.id}`;
  const amount = extra.amountCents != null ? formatCurrency(extra.amountCents) : "";
  const key = (who: string) => `${event}:${trip.id}:${who}${extra.key ? `:${extra.key}` : ""}`;

  const toGuest = (title: string, body: string, actionLabel = "See your trip", href = guestTrip) =>
    notify({ userId: trip.guest_id, kind: event, title, body, href, tripId, dedupeKey: key("guest"), actionLabel });
  const toHost = (title: string, body: string, actionLabel = "Open the trip", href = hostTrip) =>
    notify({ userId: trip.host_id, kind: event, title, body, href, tripId, dedupeKey: key("host"), actionLabel });

  switch (event) {
    case "requested":
      await Promise.all([
        toHost(`${guest} wants to book your ${car}`, `${when}.\nAccept to charge their card, or decline to release the hold. Answer before pick-up.`, "Answer the request"),
        toGuest(`Request sent to ${host}`, `${car}, ${when}.\nYour card is held, not charged. You'll hear back as soon as ${host} answers.`),
      ]);
      return;
    case "booked":
      await Promise.all([
        toHost(`${guest} booked your ${car}`, `${when}.\nPick-up at ${trip.pickup_location}.`),
        toGuest(`You're booked: ${car}`, `${when}.\nThe exact pick-up spot is on your trip page. Paid ${formatCurrency(trip.total_cents)}.`),
      ]);
      return;
    case "accepted":
      await toGuest(`${host} said yes`, `${car}, ${when}.\nYour card has been charged ${formatCurrency(trip.total_cents)}. The exact pick-up spot is on your trip page.`);
      return;
    case "declined":
      await toGuest(`${host} can't take this one`, `${car}, ${when}.\nThe hold on your card is released. Nothing was charged.`, "Find another car", "/search");
      return;
    case "expired":
      await Promise.all([
        toGuest(`Your request to ${host} closed`, `${car}, ${when}.\n${host} didn't answer in time, so the hold on your card is released.`, "Find another car", "/search"),
        toHost(`A request from ${guest} expired`, `${car}, ${when}.\nIt closed before you answered, and the guest's hold was released.`),
      ]);
      return;
    case "cancelled_by_guest":
      await Promise.all([
        toHost(`${guest} cancelled`, `${car}, ${when}.\nThose dates are open again.`),
        toGuest("Your trip is cancelled", `${car}, ${when}.${amount ? `\n${amount} is on its way back to your card.` : ""}`),
      ]);
      return;
    case "cancelled_by_host":
      await toGuest(`${host} cancelled your trip`, `${car}, ${when}.\nYou get everything back.`, "Find another car", "/search");
      return;
    case "cancelled_by_cascade":
      await Promise.all([
        toGuest("Your trip is cancelled", `${car}, ${when}.\nCascade cancelled it and refunded you in full.`, "Find another car", "/search"),
        toHost(`${guest}'s trip is cancelled`, `${car}, ${when}.\nCascade cancelled it and refunded the guest. Those dates are open again.`),
      ]);
      return;
    case "pickup_soon":
      await Promise.all([
        toGuest(`Pick-up is coming up: ${car}`, `${formatDateTime(trip.starts_at)} at ${trip.vehicle?.location_address ?? trip.pickup_location}.\nTake photos of the car and note the miles and fuel when you get there. Your trip page has a check-in for that.`, "Open check-in"),
        toHost(`${guest} picks up soon`, `${car}, ${formatDateTime(trip.starts_at)}.\nLog the miles and fuel and take photos at handover.`),
      ]);
      return;
    case "return_soon":
      await toGuest(`Return the ${car} by ${formatDateTime(trip.ends_at)}`, `Bring it back with the same fuel, and take photos when you drop it off. Need longer? Ask ${host} for more time from your trip page.`, "Open check-out");
      return;
    case "completed":
      await Promise.all([
        toGuest(`Thanks for driving the ${car}`, `Your receipt is ready. When you have a minute, tell other guests how it went.`, "See receipt and review", `${guestTrip}/receipt`),
        toHost(`${guest}'s trip is done`, `${car}, ${when}.\nYour share is on its way to your bank. You can review ${guest}, and send any charges for extra miles, fuel or tolls within 7 days.`),
      ]);
      return;
    case "change_requested":
      await toHost(`${guest} asked to change their trip`, `${car}.${extra.note ? `\n${extra.note}` : ""}`, "Answer the change");
      return;
    case "change_accepted":
      await toGuest(`${host} accepted your change`, `${car}, now ${when}.${amount ? `\n${extra.note ?? ""}` : ""}`.trim());
      return;
    case "change_declined":
      await toGuest(`${host} couldn't make that change`, `${car}. Your trip stays ${when}.`);
      return;
    case "charge_requested":
      await toGuest(`${host} sent a charge for ${amount}`, `${extra.note ?? ""}\nPay it or tell us why you disagree from your trip page. If you don't answer in 3 days it's charged to your card.`.trim(), "Review the charge");
      return;
    case "charge_paid":
      await toHost(`${guest} paid ${amount}`, `It's added to your next payout.`);
      return;
    case "charge_disputed":
      await toHost(`${guest} disputed a charge`, `${amount}. Cascade will look at the photos and both sides, then decide.${extra.note ? `\nTheir note: ${extra.note}` : ""}`);
      return;
    case "charge_failed":
      await toGuest(`We couldn't charge ${amount}`, `Your card on file was declined for a charge from ${host}. Pay it from your trip page.`, "Pay the charge");
      return;
    case "deposit_held":
      await toGuest(`${amount} deposit held`, `It's a hold on your card, not a charge, and it's released a couple of days after you return the ${car}.`);
      return;
    case "deposit_released":
      await toGuest("Your deposit is released", `The ${amount} hold for the ${car} is gone from your card. Banks can take a few days to show it.`);
      return;
    case "review_from_guest":
      await toHost(`${guest} reviewed your ${car}`, `${extra.note ?? ""}\nYou can reply from Ratings.`.trim(), "See the review", "/host/business/ratings");
      return;
    case "review_from_host":
      await toGuest(`${host} reviewed you`, `${car}, ${when}.${extra.note ? `\n${extra.note}` : ""}`);
      return;
    // `note` is the driver's name, `key` their row.
    case "driver_added":
      await toHost(`${guest} added a driver: ${extra.note ?? "someone new"}`, `${car}, ${when}.\nApprove or decline them from the trip page. They can't drive until you approve.`, "Review the driver", `${hostTrip}#drivers`);
      return;
    case "driver_approved":
      await toGuest(`${host} approved ${extra.note ?? "your driver"}`, `${car}, ${when}.\nThey can drive the car on this trip. You still have to be there for pick-up and return.`);
      return;
    case "driver_declined":
      await toGuest(`${host} declined ${extra.note ?? "your driver"}`, `${car}, ${when}.\nThey can't drive the car on this trip. Message ${host} if you're not sure why.`);
      return;
  }
}

/** A burst of messages in one conversation sends one email per this window. */
const MESSAGE_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/**
 * Tells the other person in a conversation about a new message, in their
 * feed and by email, at most once per window so a quick back-and-forth
 * doesn't flood their inbox.
 */
export async function notifyMessage(conversationId: string, senderId: string, body: string): Promise<void> {
  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("id, guest_id, host_id, trip_id, guest:profiles!guest_id(full_name), host:profiles!host_id(full_name)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return;
  const fromHost = senderId === conv.host_id;
  if (!fromHost && senderId !== conv.guest_id) return;
  const sender = (fromHost ? conv.host : conv.guest) as { full_name: string } | null;
  const name = first(sender?.full_name, fromHost ? "Your host" : "Your guest");
  const userId = fromHost ? conv.guest_id : conv.host_id;
  const text = body.trim();
  await notify({
    userId,
    kind: "message",
    title: `New message from ${name}`,
    body: text ? (text.length > 280 ? `${text.slice(0, 277)}…` : text) : `${name} sent photos.`,
    href: fromHost ? `/messages/${conv.id}` : `/host/inbox/${conv.id}`,
    tripId: conv.trip_id,
    dedupeKey: `message:${conv.id}:${userId}:${Math.floor(Date.now() / MESSAGE_EMAIL_WINDOW_MS)}`,
    actionLabel: "Read and reply",
  });
}

/** notifyMessage once the response is out. */
export function notifyMessageLater(conversationId: string, senderId: string, body: string): void {
  const send = () => notifyMessage(conversationId, senderId, body).catch((err) => console.error("[notify] failed", err));
  try {
    after(send);
  } catch {
    void send();
  }
}

/**
 * notifyTrip once the response is out, so a slow email never holds up a
 * request or a booking. Outside a request it just sends in the background.
 */
export function notifyTripLater(
  tripId: string,
  event: TripEvent,
  extra: { amountCents?: number; note?: string; key?: string } = {}
): void {
  const send = () => notifyTrip(tripId, event, extra).catch((err) => console.error("[notify] failed", err));
  try {
    after(send);
  } catch {
    void send();
  }
}
