# Cascade

Peer-to-peer car rental around Seattle. Guests find a car, book it and pay; hosts list cars, answer requests and run their calendar.

Next.js 16 (App Router), Supabase (auth, Postgres, storage), Stripe (PaymentIntents).

## Running it

```bash
npm install
npm run dev
```

`.env.local` needs:

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Trip writes, uploads, availability checks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/stripe` |

## Database

`supabase-schema.sql` is the full schema for a fresh project. Changes to an existing database live in `supabase/migrations/`, run in order in the Supabase SQL editor.

`20261013000000_booking_integrity.sql` stops double bookings at the database level, moves trip writes to the server only, and stops users editing fields they shouldn't (host and verified flags, ratings, trip counts). Run the overlap check at the top of the file first.

## Stripe webhook

Point a webhook at `/api/webhooks/stripe` with these events:

- `payment_intent.succeeded`
- `payment_intent.amount_capturable_updated`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

## How booking works

- Dates are Pacific calendar days; pick-up and return are at 10:00.
- Instant-book cars are charged at checkout. Other cars put a hold on the card, and the host's Accept charges it. Holds Stripe drops after about a week close the request.
- Unpaid checkouts hold the dates for 30 minutes.
- "Pay now" is 9% cheaper and free to cancel for 24 hours after the trip is confirmed. "Free cancellation" refunds in full until pick-up. A host cancelling always refunds in full.
- Weekly (7+ days) and monthly (30+ days) discounts come from the car's settings.
- Hosts earn 80% of the rental subtotal. Tax and protection aren't part of it.
- Payouts to hosts (Stripe Connect) aren't built yet.
