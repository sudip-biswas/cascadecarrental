-- Additional drivers on a trip. The guest adds them after booking, the host
-- approves or declines each one. Only the last 4 of a licence number is kept.
-- Additive and safe to run more than once.

create table if not exists public.trip_drivers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  -- Set from the email when it matches a Cascade account (see the trigger below).
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  date_of_birth date not null,
  licence_last4 text not null check (licence_last4 ~ '^[A-Z0-9]{4}$'),
  licence_state text not null check (licence_state ~ '^[A-Z]{2}$'),
  licence_expiry date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- When the host approved or declined.
  responded_at timestamptz
);

create index if not exists trip_drivers_trip_idx on public.trip_drivers (trip_id);
create index if not exists trip_drivers_profile_idx on public.trip_drivers (profile_id) where profile_id is not null;

-- The same person can't be on a trip twice at once. Declined or removed
-- drivers can be added again.
create unique index if not exists trip_drivers_one_live
  on public.trip_drivers (trip_id, lower(email))
  where status in ('pending', 'approved');

-- Links the driver to a Cascade account with the same email, and keeps
-- updated_at honest. Security definer to read auth.users.
create or replace function public.trip_drivers_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(btrim(new.email));
    select u.id into new.profile_id
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = new.email
    limit 1;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.trip_drivers_before_write() from public;

drop trigger if exists trip_drivers_before_write on public.trip_drivers;
create trigger trip_drivers_before_write
  before insert or update on public.trip_drivers
  for each row execute function public.trip_drivers_before_write();

alter table public.trip_drivers enable row level security;

-- Column grants: people can add a driver and move its status, nothing else.
-- The API routes use the service role and do the full checks.
revoke all on public.trip_drivers from anon, authenticated;
grant select on public.trip_drivers to authenticated;
grant insert (trip_id, added_by, full_name, email, date_of_birth, licence_last4, licence_state, licence_expiry)
  on public.trip_drivers to authenticated;
grant update (status, responded_at) on public.trip_drivers to authenticated;

-- The trip's guest and host can see its drivers.
drop policy if exists trip_drivers_select on public.trip_drivers;
create policy trip_drivers_select on public.trip_drivers for select to authenticated using (
  exists (
    select 1 from public.trips t
    where t.id = trip_drivers.trip_id and (t.guest_id = auth.uid() or t.host_id = auth.uid())
  )
);

-- The guest adds drivers to their own trip, always as pending.
drop policy if exists trip_drivers_guest_insert on public.trip_drivers;
create policy trip_drivers_guest_insert on public.trip_drivers for insert to authenticated with check (
  added_by = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.trips t
    where t.id = trip_drivers.trip_id
      and t.guest_id = auth.uid()
      and t.status in ('pending', 'approved', 'active')
      and t.ends_at > now()
  )
);

-- The guest can only take a driver off.
drop policy if exists trip_drivers_guest_remove on public.trip_drivers;
create policy trip_drivers_guest_remove on public.trip_drivers for update to authenticated using (
  exists (select 1 from public.trips t where t.id = trip_drivers.trip_id and t.guest_id = auth.uid())
) with check (
  status = 'removed'
  and exists (select 1 from public.trips t where t.id = trip_drivers.trip_id and t.guest_id = auth.uid())
);

-- Only the host approves or declines.
drop policy if exists trip_drivers_host_answer on public.trip_drivers;
create policy trip_drivers_host_answer on public.trip_drivers for update to authenticated using (
  exists (select 1 from public.trips t where t.id = trip_drivers.trip_id and t.host_id = auth.uid())
) with check (
  status in ('approved', 'declined')
  and exists (select 1 from public.trips t where t.id = trip_drivers.trip_id and t.host_id = auth.uid())
);
