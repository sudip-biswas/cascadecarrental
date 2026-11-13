-- All fleet cars are company-operated: instant book, correct age floor, deposit hold.
-- These align the database with the guest-facing policy the site now states.

UPDATE vehicles SET instant_book = true;

UPDATE vehicles SET min_age = 21
  WHERE min_age IS NULL OR min_age < 21;

UPDATE vehicles SET young_driver_fee_cents = 1000
  WHERE young_driver_fee_cents IS NULL OR young_driver_fee_cents = 0;

-- $250 hold ($0 with Complete — enforced in checkout logic).
UPDATE vehicles SET deposit_cents = 25000
  WHERE deposit_cents IS NULL OR deposit_cents = 0;
