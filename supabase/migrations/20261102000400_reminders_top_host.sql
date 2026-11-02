-- Top host for guests, and honest trip counts on car listings. Additive and
-- safe to run more than once.

-- ---------------------------------------------------------------------------
-- Top host
-- ---------------------------------------------------------------------------
-- The daily tick stores the result of lib/top-host.ts here, so search can show
-- the tag without working it out per card. Anyone can read it. Only the server
-- can write it: it's outside the column update grant, and the trigger below
-- freezes it as well.
alter table public.profiles
  add column if not exists top_host boolean not null default false;

grant select (top_host) on public.profiles to anon, authenticated;

-- Its own trigger, not another line in protect_profile_columns: replacing that
-- function here would undo anything a neighbouring migration adds to it.
create or replace function public.protect_top_host()
returns trigger
language plpgsql
-- Invoker, so current_user is the caller and not the function owner.
security invoker
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.top_host := old.top_host;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'protect_top_host' and tgrelid = 'public.profiles'::regclass) then
    create trigger protect_top_host
      before update on public.profiles
      for each row execute function public.protect_top_host();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A car's trip count
-- ---------------------------------------------------------------------------
-- vehicles.trip_count only moved when a guest left a review, so a car with
-- finished trips and no reviews still read "New listing". It now moves when a
-- trip finishes too. Row-level, so settling many trips at once counts each car.
create or replace function public.update_vehicle_trip_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update vehicles set
    trip_count = (
      select count(*) from trips
      where vehicle_id = new.vehicle_id and status = 'completed'
    )
  where id = new.vehicle_id;
  return null;
end;
$$;

-- Only ever run by its trigger.
revoke execute on function public.update_vehicle_trip_count() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_trip_completed' and tgrelid = 'public.trips'::regclass) then
    create trigger on_trip_completed
      after update of status on public.trips
      for each row
      when (new.status = 'completed' and old.status is distinct from 'completed')
      execute function public.update_vehicle_trip_count();
  end if;
end $$;

-- Catch up the cars that fell behind. Only ever raises a count.
update public.vehicles v
set trip_count = done.trips
from (
  select vehicle_id, count(*) as trips from public.trips
  where status = 'completed'
  group by vehicle_id
) done
where done.vehicle_id = v.id and done.trips > v.trip_count;
