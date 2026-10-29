-- Safety & inspections: a yearly inspection checklist per car and a log of the
-- work done on it. A car whose inspection is overdue can't be listed again
-- until a passing one is in; cars already listed stay listed. The checklist
-- items, work kinds and the yearly rule live in lib/safety.ts. Additive and
-- safe to run more than once.

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  inspected_on date not null,
  odometer_mi integer check (odometer_mi between 0 and 2000000),
  -- { "<item id>": "pass" | "fail" | "na" }, one key per checklist item.
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  -- True when nothing on the checklist failed.
  passed boolean not null,
  -- Who did it: the host, or a shop's name.
  inspector text check (char_length(inspector) <= 120),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_inspections_vehicle_idx on public.vehicle_inspections (vehicle_id, inspected_on desc);

alter table public.vehicle_inspections enable row level security;

-- ---------------------------------------------------------------------------
-- Maintenance log
-- ---------------------------------------------------------------------------
create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  done_on date not null,
  kind text not null check (kind in (
    'oil_change', 'tires', 'brakes', 'battery', 'fluids', 'wipers', 'alignment', 'recall', 'repair', 'cleaning', 'other'
  )),
  odometer_mi integer check (odometer_mi between 0 and 2000000),
  cost_cents integer check (cost_cents between 0 and 10000000),
  notes text check (char_length(notes) <= 2000),
  -- When the same work is next due, by date, by miles, or both.
  next_due_on date,
  next_due_mi integer check (next_due_mi between 0 and 2000000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, done_on desc);

alter table public.vehicle_maintenance enable row level security;

-- ---------------------------------------------------------------------------
-- Only the car's host reads and writes either table
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_inspections' and policyname = 'vehicle_inspections_host') then
    create policy vehicle_inspections_host on public.vehicle_inspections for all to authenticated using (
      exists (select 1 from public.vehicles v where v.id = vehicle_inspections.vehicle_id and v.host_id = auth.uid())
    ) with check (
      exists (select 1 from public.vehicles v where v.id = vehicle_inspections.vehicle_id and v.host_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicle_maintenance' and policyname = 'vehicle_maintenance_host') then
    create policy vehicle_maintenance_host on public.vehicle_maintenance for all to authenticated using (
      exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.host_id = auth.uid())
    ) with check (
      exists (select 1 from public.vehicles v where v.id = vehicle_maintenance.vehicle_id and v.host_id = auth.uid())
    );
  end if;
end $$;

revoke all on public.vehicle_inspections, public.vehicle_maintenance from anon;

-- ---------------------------------------------------------------------------
-- No listing a car whose inspection is overdue
-- ---------------------------------------------------------------------------
-- An inspection is due a year after the last passing one, or a year after the
-- car was added when it has none. Matches inspectionDueOn in lib/safety.ts.
create or replace function public.vehicle_inspection_due_on(p_vehicle_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(
    (select max(i.inspected_on) from public.vehicle_inspections i where i.vehicle_id = p_vehicle_id and i.passed),
    (select (v.created_at at time zone 'America/Los_Angeles')::date from public.vehicles v where v.id = p_vehicle_id)
  ) + interval '1 year')::date;
$$;

revoke all on function public.vehicle_inspection_due_on(uuid) from public, anon, authenticated;

create or replace function public.vehicles_require_inspection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'listed' and old.status is distinct from 'listed'
    and public.vehicle_inspection_due_on(new.id) < (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'inspection_overdue' using hint = 'Submit a passing inspection to list this car.';
  end if;
  return new;
end;
$$;

revoke all on function public.vehicles_require_inspection() from public, anon, authenticated;

create or replace trigger vehicles_require_inspection
  before update of status on public.vehicles
  for each row execute function public.vehicles_require_inspection();
