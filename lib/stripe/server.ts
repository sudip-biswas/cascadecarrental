import Stripe from "stripe";

// Lazy-instantiated to avoid build-time errors when env vars aren't present
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Named export for convenience
export const stripe = {
  get customers() { return getStripe().customers; },
  get paymentIntents() { return getStripe().paymentIntents; },
  get webhooks() { return getStripe().webhooks; },
  get charges() { return getStripe().charges; },
  get refunds() { return getStripe().refunds; },
  get accounts() { return getStripe().accounts; },
  get accountLinks() { return getStripe().accountLinks; },
  get transfers() { return getStripe().transfers; },
  get identity() { return getStripe().identity; },
};
