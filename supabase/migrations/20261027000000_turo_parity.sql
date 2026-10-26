-- Turo parity: driver checks, extras, delivery, deposits, check-in/out,
-- post-trip charges, trip changes, two-way reviews, favorites, promo codes
-- and notifications.

-- ---------------------------------------------------------------------------
-- Profiles: verification, date of birth, suspension
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists identity_status text not null default 'unverified'
    check (identity_status in ('unverified', 'pending', 'verified', 'failed')),
  add column if not exists identity_session_id text,
  add column if not exists identity_error text,
  add column if not exists suspended_at timestamptz;

-- profiles_update_own lets people edit their own row from the browser. Without
-- this, anyone could mark themselves verified or swap their Stripe ids.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
-- Invoker, so current_user is the caller and not the function owner.
security invoker
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.driving_license_verified := old.driving_license_verified;
    new.identity_verified := old.identity_verified;
    new.identity_status := old.identity_status;
    new.identity_session_id := old.identity_session_id;
    new.identity_error := old.identity_error;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_account_id := old.stripe_account_id;
    new.suspended_at := old.suspended_at;
    new.is_host := old.is_host or new.is_host;
    -- A checked date of birth comes from the ID, so it can't be edited after.
    if old.identity_verified then
      new.date_of_birth := old.date_of_birth;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Vehicles: age rules, deposit, delivery
-- ---------------------------------------------------------------------------

alter table public.vehicles
  add column if not exists min_age smallint not null default 18 check (min_age between 18 and 30),
  add column if not exists young_driver_fee_cents integer not null default 0 check (young_driver_fee_cents >= 0),
  add column if not exists deposit_cents integer not null default 0 check (deposit_cents between 0 and 500000),
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists delivery_radius_mi smallint not null default 10 check (delivery_radius_mi between 1 and 100),
  add column if not exists delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  add column if not exists delivery_fee_per_mi_cents integer not null default 0 check (delivery_fee_per_mi_cents >= 0),
  add column if not exists airport_delivery_fee_cents integer check (airport_delivery_fee_cents >= 0);

-- ---------------------------------------------------------------------------
-- Extras a host offers on a car: child seat, prepaid fuel, unlimited miles…
-- ---------------------------------------------------------------------------

create table if not exists public.vehicle_extras (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 300),
  price_cents integer not null check (price_cents between 0 and 100000),
  per text not null default 'trip' check (per in ('day', 'trip')),
  max_quantity smallint not null default 1 check (max_quantity between 1 and 10),
  unlimited_miles boolean not null default false,
  active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_vehicle_extras_vehicle_id on public.vehicle_extras (vehicle_id);

alter table public.vehicle_extras enable row level security;

create policy vehicle_extras_select on public.vehicle_extras for select using (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_extras.vehicle_id and (v.status = 'listed' or v.host_id = auth.uid())
  )
);
create policy vehicle_extras_manage_own on public.vehicle_extras for all using (
  exists (select 1 from public.vehicles v where v.id = vehicle_extras.vehicle_id and v.host_id = auth.uid())
) with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_extras.vehicle_id and v.host_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Trips: what was booked on top of the rental
-- ---------------------------------------------------------------------------

alter table public.trips
  -- subtotal_cents stays "what the host is paid from": rental after discounts,
  -- plus extras and delivery. These break it down.
  add column if not exists rental_cents integer,
  add column if not exists extras jsonb not null default '[]'::jsonb,
  add column if not exists extras_cents integer not null default 0,
  add column if not exists delivery_cents integer not null default 0,
  add column if not exists delivery_address text,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists young_driver_cents integer not null default 0,
  add column if not exists promo_code text,
  add column if not exists promo_cents integer not null default 0,
  add column if not exists unlimited_miles boolean not null default false,
  add column if not exists stripe_payment_method_id text,
  add column if not exists deposit_cents integer not null default 0,
  add column if not exists deposit_payment_intent_id text,
  add column if not exists deposit_status text not null default 'none'
    check (deposit_status in ('none', 'held', 'released', 'captured', 'failed')),
  add column if not exists pickup_reminded_at timestamptz,
  add column if not exists return_reminded_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists paid_out_at timestamptz;

-- ---------------------------------------------------------------------------
-- Check-in and check-out: photos, odometer, fuel or charge
-- ---------------------------------------------------------------------------

create table if not exists public.trip_inspections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null check (kind in ('pickup', 'return')),
  recorded_by uuid not null references public.profiles(id),
  role text not null check (role in ('guest', 'host')),
  odometer_mi integer check (odometer_mi between 0 and 2000000),
  fuel_pct smallint check (fuel_pct between 0 and 100),
  photos text[] not null default '{}',
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (trip_id, kind, role)
);
create index if not exists idx_trip_inspections_trip_id on public.trip_inspections (trip_id);

alter table public.trip_inspections enable row level security;

create policy trip_inspections_select_participant on public.trip_inspections for select using (
  exists (
    select 1 from public.trips t
    where t.id = trip_inspections.trip_id and (t.guest_id = auth.uid() or t.host_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Charges after a trip: extra miles, fuel, tolls, cleaning, damage…
-- ---------------------------------------------------------------------------

create table if not exists public.trip_charges (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  guest_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('extra_miles', 'fuel', 'tolls', 'cleaning', 'smoking', 'late_return', 'damage', 'other')),
  amount_cents integer not null check (amount_cents between 100 and 2000000),
  description text not null check (char_length(description) between 3 and 2000),
  photos text[] not null default '{}',
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'disputed', 'declined', 'cancelled', 'failed')),
  stripe_payment_intent_id text,
  paid_from_deposit boolean not null default false,
  guest_note text check (char_length(guest_note) <= 2000),
  -- Why the last attempt to collect failed, for both sides and admins.
  failure_reason text check (char_length(failure_reason) <= 500),
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  paid_out_at timestamptz
);
create index if not exists idx_trip_charges_trip_id on public.trip_charges (trip_id);
create index if not exists idx_trip_charges_status on public.trip_charges (status);

alter table public.trip_charges enable row level security;

create policy trip_charges_select_participant on public.trip_charges for select using (
  host_id = auth.uid() or guest_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Trip changes: new dates or times, the host says yes or no
-- ---------------------------------------------------------------------------

create table if not exists public.trip_changes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  old_starts_at timestamptz not null,
  old_ends_at timestamptz not null,
  new_starts_at timestamptz not null,
  new_ends_at timestamptz not null,
  -- New totals, so accepting applies exactly what the guest saw.
  pricing jsonb not null,
  difference_cents integer not null,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'cancelled', 'failed')),
  stripe_payment_intent_id text,
  stripe_refund_id text,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (new_ends_at > new_starts_at)
);
create index if not exists idx_trip_changes_trip_id on public.trip_changes (trip_id);
-- One open request per trip at a time.
create unique index if not exists trip_changes_one_open on public.trip_changes (trip_id) where status = 'requested';

alter table public.trip_changes enable row level security;

create policy trip_changes_select_participant on public.trip_changes for select using (
  exists (
    select 1 from public.trips t
    where t.id = trip_changes.trip_id and (t.guest_id = auth.uid() or t.host_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Reviews both ways: hosts review guests too
-- ---------------------------------------------------------------------------

alter table public.reviews
  add column if not exists kind text not null default 'guest_to_host'
    check (kind in ('guest_to_host', 'host_to_guest'));

alter table public.reviews drop constraint if exists reviews_trip_id_key;
alter table public.reviews drop constraint if exists reviews_trip_id_reviewer_id_key;
alter table public.reviews add constraint reviews_trip_id_reviewer_id_key unique (trip_id, reviewer_id);

-- Guests only write guest reviews from the browser. Host reviews of guests go
-- through /api/reviews with the service role.
drop policy if exists reviews_insert_reviewer on public.reviews;
create policy reviews_insert_reviewer on public.reviews for insert with check (
  reviewer_id = auth.uid()
  and kind = 'guest_to_host'
  and exists (
    select 1 from public.trips t
    where t.id = reviews.trip_id
      and t.guest_id = auth.uid()
      and t.status = 'completed'
      and t.vehicle_id = reviews.vehicle_id
      and t.host_id = reviews.reviewee_id
  )
);

-- A guest's track record looks up reviews by the person reviewed.
create index if not exists idx_reviews_reviewee_kind on public.reviews (reviewee_id, kind);

-- Only guests' reviews count towards a car's rating.
create or replace function public.update_vehicle_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.kind <> 'guest_to_host' then
    return new;
  end if;
  update vehicles set
    rating_avg = (
      select avg(rating_overall)::numeric(3,2)
      from reviews where vehicle_id = new.vehicle_id and kind = 'guest_to_host'
    ),
    trip_count = (
      select count(*) from trips
      where vehicle_id = new.vehicle_id and status = 'completed'
    ),
    updated_at = now()
  where id = new.vehicle_id;
  return new;
end;
$$;

-- reviews_update_host_reply lets the person reviewed edit the row. Keep that to
-- the reply, so nobody can change the stars they were given.
create or replace function public.protect_review_columns()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if old.kind <> 'guest_to_host' then
      raise exception 'Only replies to guest reviews can be edited';
    end if;
    new := jsonb_populate_record(old, jsonb_build_object(
      'host_reply', new.host_reply,
      'host_replied_at', new.host_replied_at
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists protect_review_columns on public.reviews;
create trigger protect_review_columns
  before update on public.reviews
  for each row execute function public.protect_review_columns();

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

alter table public.favorites enable row level security;

create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Promo codes. Read and redeemed by the server only.
-- ---------------------------------------------------------------------------

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9-]{3,24}$'),
  description text,
  percent_off smallint check (percent_off between 1 and 100),
  amount_off_cents integer check (amount_off_cents > 0),
  max_redemptions integer check (max_redemptions > 0),
  per_user_limit smallint not null default 1 check (per_user_limit > 0),
  min_days smallint not null default 1,
  first_trip_only boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_cents is null))
);

alter table public.promo_codes enable row level security;
-- No policies: only the service role reads or writes promo codes.

-- ---------------------------------------------------------------------------
-- Notifications: the in-app feed for guests and hosts, and what was emailed
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  trip_id uuid references public.trips(id) on delete cascade,
  -- One notice per event: retries and the cron can't send the same one twice.
  dedupe_key text unique,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private bucket for check-in, check-out and charge photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;
