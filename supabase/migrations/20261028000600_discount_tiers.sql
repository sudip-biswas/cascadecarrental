-- Turo-style discount tiers and a last-minute price boost per car.
-- weekly_discount_pct and monthly_discount_pct stay as the 1-week and 1-month
-- tiers. A trip gets the single best tier it qualifies for, never a stack.
-- Additive and safe to run more than once.

alter table public.vehicles
  -- Off trips of 3+ days.
  add column if not exists three_day_discount_pct smallint not null default 0
    check (three_day_discount_pct between 0 and 50),
  -- Off trips of 14+ days.
  add column if not exists two_week_discount_pct smallint not null default 0
    check (two_week_discount_pct between 0 and 50),
  -- Off trips of 21+ days.
  add column if not exists three_week_discount_pct smallint not null default 0
    check (three_week_discount_pct between 0 and 50),
  -- Added to the rental when pick-up is within 24 hours of booking.
  add column if not exists last_minute_boost_pct smallint not null default 0
    check (last_minute_boost_pct between 0 and 25);

-- Vehicles use column grants (see booking_integrity), so new columns need their own.
grant select (three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct)
  on public.vehicles to anon, authenticated;
grant insert (three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct)
  on public.vehicles to authenticated;
grant update (three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct)
  on public.vehicles to authenticated;

