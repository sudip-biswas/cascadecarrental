-- =============================================================
-- Correct young-driver fee and deposit for ALL vehicles.
-- Migration 000000 only updated NULL/0 rows; existing non-zero
-- values were left untouched. This pass overwrites them all.
-- =============================================================

-- $10/day young driver fee (was $20 on many cars)
UPDATE vehicles SET young_driver_fee_cents = 1000;

-- $250 security hold (was $500 on cars seeded before the correction)
UPDATE vehicles SET deposit_cents = 25000;

-- Also correct the homepage metadata description that still says $11.99
-- (the description lives in app/(marketing)/page.tsx, not here — handled in code).
