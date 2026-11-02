import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { chargeWindow } from "@/lib/charges";

const DAY_MS = 86_400_000;

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** The Stripe customer behind someone's saved cards, if they've paid before. */
export async function customerOf(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", userId).single();
  if (error) throw error;
  return data.stripe_customer_id;
}

/** Someone's saved cards. No customer at Stripe reads as no cards. */
export async function listCards(customer: string | null): Promise<SavedCard[]> {
  if (!customer) return [];
  try {
    const { data } = await stripe.customers.listPaymentMethods(customer, { type: "card", limit: 100 });
    return data.flatMap((pm) =>
      pm.card
        ? [{ id: pm.id, brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }]
        : []
    );
  } catch (err) {
    if ((err as Stripe.errors.StripeError).code === "resource_missing") return [];
    throw err;
  }
}

/** The card, only if it's on this customer. Someone else's and made-up ids look the same. */
export async function ownedCard(customer: string | null, id: string): Promise<Stripe.PaymentMethod | null> {
  if (!customer) return null;
  try {
    const pm = await stripe.paymentMethods.retrieve(id);
    return pm.customer === customer ? pm : null;
  } catch (err) {
    if ((err as Stripe.errors.StripeError).code === "resource_missing") return null;
    throw err;
  }
}

/**
 * Why this exact card has to stay, or null. Trips charge it off-session for
 * the deposit and for anything the host sends after the return.
 */
export async function cardHeldBy(userId: string, paymentMethodId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: trips, error } = await admin
    .from("trips")
    .select("id, status, ends_at")
    .eq("guest_id", userId)
    .eq("stripe_payment_method_id", paymentMethodId)
    .in("status", ["pending", "approved", "active", "completed"]);
  if (error) throw error;

  if (trips.some((t) => t.status !== "completed")) return "This card is on a current trip. You can remove it after the trip.";

  const open = trips.filter((t) => chargeWindow(t).open);
  if (open.length > 0) {
    const closes = Math.max(...open.map((t) => chargeWindow(t).closesAt.getTime()));
    const days = Math.ceil((closes - Date.now()) / DAY_MS);
    return `This card can still be charged for a recent trip. You can remove it in ${days === 1 ? "1 day" : `${days} days`}.`;
  }

  // A charge sent late in the window is collected after the window shuts.
  if (trips.length > 0) {
    const { data: charges, error: chargesError } = await admin
      .from("trip_charges")
      .select("id")
      .in("trip_id", trips.map((t) => t.id))
      .in("status", ["requested", "disputed", "failed"])
      .limit(1);
    if (chargesError) throw chargesError;
    if (charges.length > 0) return "This card has a charge still open. You can remove it once that's settled.";
  }
  return null;
}
