-- Monthly rentals, like Turo: every car starts with discounts for longer
-- trips and can be booked for up to three months. The same defaults live in
-- DEFAULT_DISCOUNTS (lib/pricing.ts) and DEFAULT_MAX_TRIP_DAYS
-- (lib/listing-limits.ts). Additive and safe to run more than once.

alter table public.vehicles
  alter column three_day_discount_pct set default 5,
  alter column weekly_discount_pct set default 15,
  alter column two_week_discount_pct set default 20,
  alter column three_week_discount_pct set default 25,
  alter column monthly_discount_pct set default 30,
  alter column max_trip_days set default 90;

-- Cars still on the old listing defaults (10% a week, 20% a month and nothing
-- else) move to the new ones. Discounts a host changed stay as they are.
update public.vehicles
set three_day_discount_pct = 5,
    weekly_discount_pct = 15,
    two_week_discount_pct = 20,
    three_week_discount_pct = 25,
    monthly_discount_pct = 30
where three_day_discount_pct = 0
  and weekly_discount_pct = 10
  and two_week_discount_pct = 0
  and three_week_discount_pct = 0
  and monthly_discount_pct = 20;

-- 30 days was the old longest trip, too short for a monthly rental. Cars a host
-- set to something else keep it.
update public.vehicles set max_trip_days = 90 where max_trip_days = 30;
