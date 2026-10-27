-- Delivery locations: a host's named handover spots (airport, hotels, transit),
-- a custom-address delivery radius, which cars each one applies to, and the
-- spot a trip was booked with. Replaces the per-car delivery settings, which
-- are copied in below and left in place.

-- ---------------------------------------------------------------------------
-- Host locations
-- ---------------------------------------------------------------------------

create table if not exists public.host_locations (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  -- custom: delivery to an address of the guest's choice within radius_mi of the car.
  kind text not null check (kind in ('home', 'airport', 'hotel', 'transit', 'other', 'custom')),
  name text not null check (char_length(name) between 2 and 80),
  address text check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  fee_cents integer not null default 0 check (fee_cents between 0 and 50000),
  -- Custom delivery only: added for each mile from the car.
  fee_per_mi_cents integer not null default 0 check (fee_per_mi_cents between 0 and 1000),
  radius_mi smallint check (radius_mi between 1 and 100),
  -- Delivery is free for trips of this many days or more.
  free_from_days smallint check (free_from_days between 1 and 90),
  vehicle_access text not null default 'in_person' check (vehicle_access in ('lockbox', 'in_person', 'remote_unlock')),
  -- Only shown to the guest once the trip is booked, e.g. the lockbox code and where it is.
  handover_note text check (char_length(handover_note) <= 1000),
  all_vehicles boolean not null default true,
  enabled boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint host_locations_custom_radius check ((kind = 'custom') = (radius_mi is not null))
);
create index if not exists idx_host_locations_host_id on public.host_locations (host_id);
-- One custom radius per host.
create unique index if not exists host_locations_one_custom on public.host_locations (host_id) where kind = 'custom';

-- The cars a location applies to when it isn't on all of them. fee_cents is a
-- per-car price, null for the location's own.
create table if not exists public.host_location_vehicles (
  location_id uuid not null references public.host_locations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  fee_cents integer check (fee_cents between 0 and 50000),
  primary key (location_id, vehicle_id)
);
create index if not exists idx_host_location_vehicles_vehicle_id on public.host_location_vehicles (vehicle_id);

-- Addresses and handover notes are private: hosts see their own, and guests get
-- names and prices through the server.
alter table public.host_locations enable row level security;
alter table public.host_location_vehicles enable row level security;

drop policy if exists host_locations_manage_own on public.host_locations;
create policy host_locations_manage_own on public.host_locations for all
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists host_location_vehicles_manage_own on public.host_location_vehicles;
create policy host_location_vehicles_manage_own on public.host_location_vehicles for all using (
  exists (select 1 from public.host_locations l where l.id = host_location_vehicles.location_id and l.host_id = auth.uid())
) with check (
  exists (select 1 from public.host_locations l where l.id = host_location_vehicles.location_id and l.host_id = auth.uid())
  and exists (select 1 from public.vehicles v where v.id = host_location_vehicles.vehicle_id and v.host_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Trips: the spot the guest picked, kept as it was when they booked
-- ---------------------------------------------------------------------------

alter table public.trips
  add column if not exists pickup_spot_id uuid references public.host_locations(id) on delete set null,
  add column if not exists pickup_spot_kind text
    check (pickup_spot_kind in ('car', 'home', 'airport', 'hotel', 'transit', 'other', 'custom')),
  add column if not exists pickup_spot_name text,
  add column if not exists vehicle_access text check (vehicle_access in ('lockbox', 'in_person', 'remote_unlock')),
  add column if not exists handover_note text;

-- ---------------------------------------------------------------------------
-- Copy the per-car delivery settings in. Each insert only links cars to the
-- location it just made, so running this again changes nothing.
-- ---------------------------------------------------------------------------

-- Airport delivery: one Sea-Tac location per host, at the lowest of their car
-- prices, with a per-car price where a car charged more.
with made as (
  insert into public.host_locations
    (host_id, kind, name, address, lat, lng, fee_cents, vehicle_access, handover_note, all_vehicles)
  select v.host_id, 'airport', 'Seattle-Tacoma International Airport',
    '17801 International Blvd, SeaTac, WA 98158', 47.4436, -122.3016,
    min(v.airport_delivery_fee_cents), 'in_person', 'Meet at the arrivals curb.', false
  from public.vehicles v
  where v.airport_delivery_fee_cents is not null
    and not exists (select 1 from public.host_locations l where l.host_id = v.host_id and l.kind = 'airport')
  group by v.host_id
  returning id, host_id, fee_cents
)
insert into public.host_location_vehicles (location_id, vehicle_id, fee_cents)
select made.id, v.id, nullif(v.airport_delivery_fee_cents, made.fee_cents)
from made
join public.vehicles v on v.host_id = made.host_id and v.airport_delivery_fee_cents is not null
on conflict do nothing;

-- Address delivery: one custom radius per host, as wide as their widest car,
-- at the lowest base and per-mile fee, with a per-car base fee where it differs.
with made as (
  insert into public.host_locations
    (host_id, kind, name, fee_cents, fee_per_mi_cents, radius_mi, vehicle_access, all_vehicles)
  select v.host_id, 'custom', 'Delivery to your address',
    min(v.delivery_fee_cents), least(min(v.delivery_fee_per_mi_cents), 1000), max(v.delivery_radius_mi), 'in_person', false
  from public.vehicles v
  where v.delivery_enabled
    and not exists (select 1 from public.host_locations l where l.host_id = v.host_id and l.kind = 'custom')
  group by v.host_id
  returning id, host_id, fee_cents
)
insert into public.host_location_vehicles (location_id, vehicle_id, fee_cents)
select made.id, v.id, nullif(least(v.delivery_fee_cents, 50000), made.fee_cents)
from made
join public.vehicles v on v.host_id = made.host_id and v.delivery_enabled
on conflict do nothing;
