-- Automatic pricing: Cascade sets a car's day prices from rules (weekday, season,
-- holidays and events, how far out, how busy nearby cars are), inside the host's
-- floor and ceiling. A price the host sets on the calendar always wins.
-- Additive and safe to run more than once.

alter table public.vehicles
  add column if not exists auto_pricing boolean not null default false,
  -- Null means the default: 60% of the daily rate.
  add column if not exists auto_price_min_cents integer check (auto_price_min_cents >= 100),
  -- Null means the default: 145% of the daily rate.
  add column if not exists auto_price_max_cents integer check (auto_price_max_cents >= 100);

-- Vehicles use column grants (see booking_integrity), so new columns need their own.
grant select (auto_pricing, auto_price_min_cents, auto_price_max_cents) on public.vehicles to anon, authenticated;
grant insert (auto_pricing, auto_price_min_cents, auto_price_max_cents) on public.vehicles to authenticated;
grant update (auto_pricing, auto_price_min_cents, auto_price_max_cents) on public.vehicles to authenticated;

-- Who set a day's price. Rows from before this are the host's.
alter table public.vehicle_daily_prices
  add column if not exists source text not null default 'host' check (source in ('host', 'auto'));

-- Dates that move prices across the area, like game days and festivals. Holidays are
-- worked out in code, so they don't need rows. Only the server reads this table.
create table if not exists public.pricing_events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 80),
  starts_on  date not null,
  ends_on    date not null,
  pct        smallint not null check (pct between -30 and 50),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table public.pricing_events enable row level security;

-- Writes automatic prices without touching a day the host priced, even one they
-- priced a moment ago. rows is [{vehicle_id, date, price_cents}].
create or replace function public.upsert_auto_prices(rows jsonb)
returns integer
language sql
set search_path = ''
as $$
  with written as (
    insert into public.vehicle_daily_prices (vehicle_id, date, price_cents, source)
    select (r->>'vehicle_id')::uuid, (r->>'date')::date, (r->>'price_cents')::integer, 'auto'
    from jsonb_array_elements(rows) r
    on conflict (vehicle_id, date) do update
      set price_cents = excluded.price_cents
      where vehicle_daily_prices.source = 'auto'
    returning 1
  )
  select count(*)::integer from written;
$$;

revoke all on function public.upsert_auto_prices(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_auto_prices(jsonb) to service_role;
