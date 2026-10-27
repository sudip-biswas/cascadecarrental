-- Trip rules: a buffer between trips and a weekend minimum per car, and the
-- hours a host can meet guests for pickups and returns, for all their cars.

-- ---------------------------------------------------------------------------
-- Vehicles: turnaround buffer and weekend minimum
-- ---------------------------------------------------------------------------

-- 0 keeps every booking that exists today valid.
alter table public.vehicles
  add column if not exists trip_buffer_hours smallint not null default 0
    check (trip_buffer_hours between 0 and 72),
  add column if not exists weekend_min_two_days boolean not null default false;

-- Vehicles use column grants (see booking_integrity), so new columns need their own.
grant select (trip_buffer_hours, weekend_min_two_days) on public.vehicles to anon, authenticated;
grant insert (trip_buffer_hours, weekend_min_two_days) on public.vehicles to authenticated;
grant update (trip_buffer_hours, weekend_min_two_days) on public.vehicles to authenticated;

-- ---------------------------------------------------------------------------
-- Host pickup and return hours
-- ---------------------------------------------------------------------------

-- One row per host. week holds seven days, Sunday first:
-- [{ "open": true, "from": "10:00", "to": "22:00" }, ...], in Seattle time.
-- No row means always available.
create table if not exists public.host_hours (
  host_id          uuid primary key references public.profiles(id) on delete cascade,
  always_available boolean not null default true,
  week             jsonb not null default '[
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"},
    {"open": true, "from": "10:00", "to": "22:00"}
  ]'::jsonb
    check (jsonb_typeof(week) = 'array' and jsonb_array_length(week) = 7),
  updated_at       timestamptz not null default now()
);
alter table public.host_hours enable row level security;

-- Anyone can see a host's hours (the car page tells guests when to pick up).
-- Hosts write their own row.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'host_hours' and policyname = 'host_hours_read') then
    create policy "host_hours_read" on public.host_hours for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'host_hours' and policyname = 'host_hours_own') then
    create policy "host_hours_own" on public.host_hours for all
      using (host_id = auth.uid())
      with check (host_id = auth.uid());
  end if;
end $$;

grant select on public.host_hours to anon, authenticated;
grant insert, update, delete on public.host_hours to authenticated;
