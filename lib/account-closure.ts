import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEarnings, owedCents } from "@/lib/earnings";
import { INSURANCE_BUCKET } from "@/lib/guest-checks";
import { LICENCE_BUCKET } from "@/lib/licence";
import { holdsDates, settleTripStatuses } from "@/lib/trips";
import { formatCurrency, formatDateTime } from "@/lib/utils";

/** Trust and record-keeping: no closing until this long after a trip ends. */
const COOL_OFF_HOURS = 72;
const HOUR = 60 * 60 * 1000;

/** Supabase has no permanent ban, so this is 100 years. */
const BAN_DURATION = "876000h";

/** The table isn't there yet, whichever way PostgREST says so. */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export type RefusalReason =
  | "trip_requested"
  | "trip_booked"
  | "trip_active"
  | "trip_recent"
  | "charge_open"
  | "claim_open"
  | "money_owed";

export interface Refusal {
  reason: RefusalReason;
  message: string;
}

const REFUSALS = {
  trip_active: "You have a trip in progress. You can close your account 72 hours after it ends.",
  trip_booked: "You have a booked trip. Finish or cancel it first.",
  trip_requested: "You have a booking request open. Cancel it or wait for an answer first.",
  claim_open: "You have an open damage claim. It has to be settled first.",
} as const;

const refuse = (reason: keyof typeof REFUSALS): Refusal => ({ reason, message: REFUSALS[reason] });

/**
 * trip_claims ships on another branch, so this has to work with or without it.
 * A missing table means no claims. Any other error throws, so a broken query
 * can never wave an account through. Open means not resolved or closed, as in
 * the table's own one-open-claim index. The cast is because the generated types
 * don't list the table yet.
 */
async function hasOpenClaim(userId: string): Promise<boolean> {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("trip_claims")
    .select("id")
    .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
    .not("status", "in", "(resolved,closed)")
    .limit(1);
  if (error) {
    if (error.code && MISSING_TABLE.has(error.code)) return false;
    throw error;
  }
  return data.length > 0;
}

/**
 * Why this person can't close their account, or null when they can. Settles
 * their trips first, so a finished trip counts as finished and any payout due
 * goes out. Every query throws on error rather than reading as "nothing open".
 */
export async function closureRefusal(userId: string): Promise<Refusal | null> {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("closed_at, stripe_account_id")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  // Already through these checks: a retry only has to finish the job.
  if (profile.closed_at) return null;

  await settleTripStatuses(userId);
  const party = `guest_id.eq.${userId},host_id.eq.${userId}`;

  const { data: open, error: openError } = await admin
    .from("trips")
    .select("status")
    .or(party)
    .in("status", ["pending", "approved", "active"])
    // An unpaid checkout nobody finished doesn't count.
    .or(holdsDates());
  if (openError) throw openError;
  if (open.some((t) => t.status === "active")) return refuse("trip_active");
  if (open.some((t) => t.status === "approved")) return refuse("trip_booked");
  if (open.length > 0) return refuse("trip_requested");

  const { data: recent, error: recentError } = await admin
    .from("trips")
    .select("ends_at")
    .or(party)
    .eq("status", "completed")
    .gt("ends_at", new Date(Date.now() - COOL_OFF_HOURS * HOUR).toISOString())
    .order("ends_at", { ascending: false })
    .limit(1);
  if (recentError) throw recentError;
  if (recent.length > 0) {
    const from = new Date(new Date(recent[0].ends_at).getTime() + COOL_OFF_HOURS * HOUR);
    return {
      reason: "trip_recent",
      message: `A trip ended less than 72 hours ago. You can close your account after ${formatDateTime(from)}.`,
    };
  }

  // A failed charge is still money owed, so it counts as unpaid too.
  const { data: charges, error: chargesError } = await admin
    .from("trip_charges")
    .select("guest_id, amount_cents")
    .or(party)
    .in("status", ["requested", "disputed", "failed"]);
  if (chargesError) throw chargesError;
  const owing = charges.filter((c) => c.guest_id === userId).reduce((sum, c) => sum + c.amount_cents, 0);
  if (owing > 0) {
    return { reason: "charge_open", message: `You have ${formatCurrency(owing)} in unpaid charges. Settle them first.` };
  }
  if (charges.length > 0) {
    return { reason: "charge_open", message: "You have a charge open with a guest. Wait for it to finish first." };
  }

  if (await hasOpenClaim(userId)) return refuse("claim_open");

  const earnings = await loadEarnings(admin, userId);
  // Trips finished before completed_at existed were paid by the old code, as in settle.
  const owed = owedCents({ ...earnings, trips: earnings.trips.filter((t) => t.completed_at) });
  if (owed > 0) {
    return {
      reason: "money_owed",
      message: profile.stripe_account_id
        ? `Cascade is still sending you ${formatCurrency(owed)}. Try again once it's in your bank.`
        : `Cascade still owes you ${formatCurrency(owed)}. Add your bank to get paid first.`,
    };
  }

  return null;
}

/** Empties a person's folder, whatever's in it, so it works however far a last try got. */
async function emptyFolder(bucket: string, userId: string) {
  const storage = createAdminClient().storage.from(bucket);
  for (;;) {
    const { data: files, error } = await storage.list(userId, { limit: 100 });
    if (error) throw error;
    if (!files?.length) return;
    const { data: removed, error: removeError } = await storage.remove(files.map((f) => `${userId}/${f.name}`));
    if (removeError) throw removeError;
    if (!removed?.length) throw new Error(`[closure] nothing removed from ${bucket}`);
  }
}

/** Host pages hang off personas, so closing takes them down. Photo first, so a retry can still find it. */
async function removePersonas(userId: string) {
  const admin = createAdminClient();
  const { data: personas, error } = await admin.from("host_personas").select("id, avatar_url").eq("owner_id", userId);
  if (error) throw error;
  if (!personas.length) return;

  const photos = personas.flatMap((p) => p.avatar_url?.split("?")[0].split("/").pop() ?? []);
  if (photos.length) {
    const { error: removeError } = await admin.storage.from("persona-avatars").remove(photos);
    if (removeError) throw removeError;
  }
  const { error: deleteError } = await admin.from("host_personas").delete().eq("owner_id", userId);
  if (deleteError) throw deleteError;
}

/** Bans the login, and clears the name and photo auth keeps from sign-up. */
async function banLogin(userId: string) {
  const { auth } = createAdminClient();
  const { data, error } = await auth.admin.getUserById(userId);
  if (error) throw error;
  const cleared = Object.fromEntries(Object.keys(data.user.user_metadata ?? {}).map((key) => [key, null]));
  const { error: banError } = await auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
    user_metadata: cleared,
  });
  if (banError) throw banError;
}

/**
 * Closes an account. Throws when a step fails, and every step can run again, so
 * the fix is to call it again. The database half is one transaction. The login
 * goes last, so the person stays signed in to retry until the rest is done.
 * False when a booking landed after closureRefusal looked.
 */
export async function closeAccount(userId: string): Promise<boolean> {
  const { data: begun, error } = await createAdminClient().rpc("begin_account_closure", { p_user_id: userId });
  if (error) throw error;
  if (!begun) return false;

  await removePersonas(userId);
  await emptyFolder(LICENCE_BUCKET, userId);
  await emptyFolder(INSURANCE_BUCKET, userId);
  await banLogin(userId);
  return true;
}
