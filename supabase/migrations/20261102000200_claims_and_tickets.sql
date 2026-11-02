-- Damage claims, and tickets as a charge kind. Additive and safe to run more
-- than once.

-- ---------------------------------------------------------------------------
-- Tickets: a new charge kind.
--
-- The kind check came from the table's first version and only lists the old
-- kinds. A second check can't widen it, because every check on a table has to
-- pass. So the old column steps aside with its check still on it, keeps every
-- value, and takes a default so new rows pass. A new `kind` column carries the
-- full list. Nothing reads kind_v1 any more.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_charges' and column_name = 'kind_v1'
  ) then
    alter table public.trip_charges rename column kind to kind_v1;
    alter table public.trip_charges alter column kind_v1 set default 'other';
    alter table public.trip_charges add column kind text;
    update public.trip_charges set kind = kind_v1;
    alter table public.trip_charges alter column kind set not null;
    alter table public.trip_charges add constraint trip_charges_kind_allowed
      check (kind in ('extra_miles', 'fuel', 'tolls', 'ticket', 'cleaning', 'smoking', 'late_return', 'damage', 'other'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Damage claims. Money still moves through trip_charges: a claim only links to
-- the charge the host sends from it.
-- ---------------------------------------------------------------------------

create table if not exists public.trip_claims (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  host_id uuid not null references public.profiles(id),
  guest_id uuid not null references public.profiles(id),
  reported_by text not null check (reported_by in ('host', 'guest')),
  incident_at timestamptz not null,
  description text not null check (char_length(description) between 10 and 2000),
  -- Paths in the private trip-photos bucket.
  photos text[] not null default '{}',
  estimate_cents integer check (estimate_cents between 100 and 2000000),
  -- Past the 24 hours. Flagged, not refused.
  reported_late boolean not null default false,
  status text not null default 'reported'
    check (status in ('reported', 'with_guest', 'disputed', 'escalated', 'resolved', 'closed')),
  charge_id uuid references public.trip_charges(id) on delete set null,
  escalated_at timestamptz,
  documents_due_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open claim per trip.
create unique index if not exists trip_claims_one_open on public.trip_claims (trip_id)
  where status not in ('resolved', 'closed');
create index if not exists idx_trip_claims_host_id on public.trip_claims (host_id, status);
create index if not exists idx_trip_claims_guest_id on public.trip_claims (guest_id);
create index if not exists idx_trip_claims_status on public.trip_claims (status);
create index if not exists idx_trip_claims_charge_id on public.trip_claims (charge_id);

alter table public.trip_claims enable row level security;

-- The two people on the trip can read their claim. Every write goes through
-- the server with the admin client.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trip_claims' and policyname = 'trip_claims_select_participant') then
    create policy trip_claims_select_participant on public.trip_claims for select to authenticated
      using (host_id = auth.uid() or guest_id = auth.uid());
  end if;
end $$;

revoke all on public.trip_claims from anon;
revoke insert, update, delete, truncate, references, trigger on public.trip_claims from authenticated;
grant select on public.trip_claims to authenticated;

notify pgrst, 'reload schema';
