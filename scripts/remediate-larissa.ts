/**
 * One-time remediation for Larissa Bardina-Siekawitch's trip (19d8eede).
 *
 * What happened: payment succeeded on Stripe but the webhook never landed, so
 * the row stayed payment_status=pending. The settle sweep refunded it. Sudip
 * re-charged manually in Stripe Dashboard.
 *
 * This script:
 *   1. Restores the trip row to active/captured
 *   2. Places the $250 Basic deposit hold on her saved card
 *
 * Run from project root:
 *   PATH="/Users/sudipbiswas/.nvm/versions/node/v20.20.2/bin:$PATH" npx tsx scripts/remediate-larissa.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Stripe from "stripe";

const TRIP_ID = "19d8eede-609e-4ad0-b68d-406a6e997cc2";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/** REST helper — bypasses supabase-js to avoid the Node 20 WebSocket issue. */
async function supabase(method: string, table: string, params?: Record<string, string>, body?: object) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method,
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "PATCH" ? "return=minimal" : "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table} failed (${res.status}): ${text}`);
  }
  if (method === "PATCH") return null;
  return res.json();
}

async function run() {
  // 1. Fetch the current trip row
  const trips = await supabase("GET", "trips", {
    id: `eq.${TRIP_ID}`,
    select: "id,status,payment_status,deposit_status,deposit_cents,stripe_payment_method_id,guest_id,vehicle_id",
  }) as Record<string, unknown>[];

  const trip = trips?.[0];
  if (!trip) {
    console.error("Trip not found:", TRIP_ID);
    process.exit(1);
  }

  console.log("Current trip state:", {
    status: trip.status,
    payment_status: trip.payment_status,
    deposit_status: trip.deposit_status,
  });

  // 2. Restore the trip row
  await supabase("PATCH", "trips", { id: `eq.${TRIP_ID}` }, {
    status: "active",
    payment_status: "captured",
    cancelled_at: null,
    cancellation_reason: null,
    updated_at: new Date().toISOString(),
  });
  console.log("✓ Trip row restored: status=active, payment_status=captured");

  // 3. Place the deposit hold
  if (trip.deposit_status !== "none") {
    console.log(`Skipping deposit hold — deposit_status is already "${trip.deposit_status}"`);
    return;
  }
  if (!trip.stripe_payment_method_id) {
    console.error("No stripe_payment_method_id on trip — place deposit manually in Stripe.");
    return;
  }

  // Load guest's Stripe customer ID
  const profiles = await supabase("GET", "profiles", {
    id: `eq.${trip.guest_id}`,
    select: "stripe_customer_id",
  }) as Record<string, unknown>[];
  const customer = profiles?.[0]?.stripe_customer_id as string | null;

  if (!customer) {
    console.error("No stripe_customer_id on guest profile — place deposit manually in Stripe.");
    return;
  }

  // Load vehicle for description
  const vehicles = await supabase("GET", "vehicles", {
    id: `eq.${trip.vehicle_id}`,
    select: "year,make,model",
  }) as Record<string, unknown>[];
  const v = vehicles?.[0];
  const car = v ? `${v.year} ${v.make} ${v.model}` : "car";

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: trip.deposit_cents as number,
        currency: "usd",
        customer,
        payment_method: trip.stripe_payment_method_id as string,
        payment_method_types: ["card"],
        capture_method: "manual",
        off_session: true,
        confirm: true,
        description: `Security deposit, ${car}`,
        metadata: { trip_id: TRIP_ID, kind: "deposit" },
      },
      { idempotencyKey: `deposit-${TRIP_ID}` }
    );

    const depositStatus = pi.status === "requires_capture" ? "held" : "failed";
    await supabase("PATCH", "trips", { id: `eq.${TRIP_ID}` }, {
      deposit_status: depositStatus,
      deposit_payment_intent_id: pi.id,
      updated_at: new Date().toISOString(),
    });

    if (pi.status === "requires_capture") {
      console.log(`✓ Deposit hold placed: $${(trip.deposit_cents as number) / 100} authorization. PI: ${pi.id}`);
    } else {
      console.error(`Deposit hold failed — PI status is "${pi.status}". PI: ${pi.id}`);
    }
  } catch (err: unknown) {
    const e = err as { type?: string; code?: string; message?: string };
    console.error("Deposit hold threw:", e.type, e.code, e.message);
  }
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
