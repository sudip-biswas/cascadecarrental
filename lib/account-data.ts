import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstName } from "@/components/search/vehicle";

const PAGE = 1000;

/** Every row of a query, past the API's limit of 1000 at a time. Throws on error. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** Columns picked one by one, so a new one stays out until someone decides it belongs. */
const TRIP_COLUMNS =
  "id, status, payment_status, starts_at, ends_at, daily_rate_cents, subtotal_cents, tax_cents, total_cents, rate_type, protection_plan, protection_cost_cents, distance_included_mi, extra_mile_fee_cents, extras, extras_cents, delivery_cents, young_driver_cents, promo_code, promo_cents, deposit_cents, deposit_status, cancellation_reason, cancelled_at, completed_at, paid_out_at, created_at";

const CAR = "vehicle:vehicles(make, model, year)";

const CHARGE_COLUMNS =
  "id, trip_id, guest_id, kind, amount_cents, description, status, paid_from_deposit, guest_note, failure_reason, resolution_note, created_at, responded_at, resolved_at, paid_out_at";

const REVIEW_COLUMNS =
  "id, trip_id, kind, rating_overall, rating_cleanliness, rating_accuracy, rating_value, rating_maintenance, rating_communication, rating_convenience, issue_tags, body, host_reply, host_replied_at, created_at";

type Named = { full_name: string | null } | null;

/**
 * Everything Cascade holds about one person, for their own download. The other
 * party on a trip or review shows as a first name only: no phone, email,
 * address or id. Only the messages this person wrote are included. Stripe ids,
 * storage paths and signed links stay out.
 */
export async function loadAccountData(user: Pick<User, "id" | "email">) {
  const admin = createAdminClient();
  const id = user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, avatar_url, bio, phone, date_of_birth, is_host, host_since, driving_license_verified, identity_verified, identity_status, created_at")
    .eq("id", id)
    .single();
  if (profileError) throw profileError;

  const [asGuest, asHost, messages, written, received, charges, favorites, preferences] = await Promise.all([
    // delivery_address is the guest's own, so it's only on this side.
    all((from, to) =>
      admin
        .from("trips")
        .select(`${TRIP_COLUMNS}, delivery_address, ${CAR}, host:profiles!host_id(full_name)`)
        .eq("guest_id", id)
        .order("created_at")
        .order("id")
        .range(from, to)
        .overrideTypes<Record<string, unknown>[], { merge: false }>()
    ),
    all((from, to) =>
      admin
        .from("trips")
        .select(`${TRIP_COLUMNS}, ${CAR}, guest:profiles!guest_id(full_name)`)
        .eq("host_id", id)
        .order("created_at")
        .order("id")
        .range(from, to)
        .overrideTypes<Record<string, unknown>[], { merge: false }>()
    ),
    all((from, to) =>
      admin
        .from("messages")
        .select("id, conversation_id, body, photos, read_at, created_at")
        .eq("sender_id", id)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    all((from, to) =>
      admin
        .from("reviews")
        .select(`${REVIEW_COLUMNS}, ${CAR}, reviewee:profiles!reviewee_id(full_name)`)
        .eq("reviewer_id", id)
        .order("created_at")
        .order("id")
        .range(from, to)
        .overrideTypes<Record<string, unknown>[], { merge: false }>()
    ),
    all((from, to) =>
      admin
        .from("reviews")
        .select(`${REVIEW_COLUMNS}, ${CAR}, reviewer:profiles!reviewer_id(full_name)`)
        .eq("reviewee_id", id)
        .order("created_at")
        .order("id")
        .range(from, to)
        .overrideTypes<Record<string, unknown>[], { merge: false }>()
    ),
    all((from, to) =>
      admin
        .from("trip_charges")
        .select(CHARGE_COLUMNS)
        .or(`guest_id.eq.${id},host_id.eq.${id}`)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    all((from, to) =>
      admin
        .from("favorites")
        .select(`vehicle_id, created_at, ${CAR}`)
        .eq("user_id", id)
        .order("created_at")
        .order("vehicle_id")
        .range(from, to)
    ),
    admin
      .from("notification_preferences")
      .select("messages_email, recommendations_email, offers_email, news_email, updated_at")
      .eq("user_id", id)
      .maybeSingle(),
  ]);
  if (preferences.error) throw preferences.error;

  /** Swaps a joined profile for its first name. */
  const named = (row: Record<string, unknown>, key: string, label: string) => {
    const { [key]: person, ...rest } = row;
    return { ...rest, [label]: firstName((person as Named)?.full_name) };
  };

  return {
    exported_at: new Date().toISOString(),
    profile: { id, email: user.email ?? null, ...profile },
    trips: {
      as_guest: asGuest.map((t) => named(t, "host", "host_name")),
      as_host: asHost.map((t) => named(t, "guest", "guest_name")),
    },
    messages_sent: messages.map(({ photos, ...m }) => ({ ...m, photo_count: photos.length })),
    reviews: {
      written: written.map((r) => named(r, "reviewee", "about")),
      received: received.map((r) => named(r, "reviewer", "from")),
    },
    charges: charges.map(({ guest_id, ...c }) => ({ ...c, role: guest_id === id ? "guest" : "host" })),
    favorites,
    notification_preferences: preferences.data,
  };
}
