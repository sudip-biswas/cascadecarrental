-- Pay over time: how a trip was paid. Klarna, Affirm and Afterpay can't be
-- charged again later, so on those trips stripe_payment_method_id holds the
-- card kept on file for the deposit and costs after the trip, not the lender.
-- Null on trips from before this, which were all paid by card. Additive and
-- safe to run more than once.

alter table public.trips
  add column if not exists paid_with text
    check (paid_with in ('card', 'klarna', 'affirm', 'afterpay_clearpay'));
