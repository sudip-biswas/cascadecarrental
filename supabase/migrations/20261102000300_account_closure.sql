-- Closing an account. The person stays on their trips, receipts, reviews and
-- charges, because those have foreign keys and the business needs the records,
-- so the profile row is kept and cleared instead of removed. Additive and safe
-- to run more than once.

-- closed_at is private: no grant to anon or authenticated. Profiles only have
-- column grants, so a new column starts with none.
alter table public.profiles add column if not exists closed_at timestamptz;

-- Same rules as before, plus: closed_at only moves on the server, and a closed
-- profile can't be edited with a session that's still alive.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if old.closed_at is not null then
      return null;
    end if;
    new.driving_license_verified := old.driving_license_verified;
    new.identity_verified := old.identity_verified;
    new.identity_status := old.identity_status;
    new.identity_session_id := old.identity_session_id;
    new.identity_error := old.identity_error;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_account_id := old.stripe_account_id;
    new.suspended_at := old.suspended_at;
    new.closed_at := old.closed_at;
    new.is_host := old.is_host or new.is_host;
    -- A checked date of birth comes from the ID, so it can't be edited after.
    if old.identity_verified then
      new.date_of_birth := old.date_of_birth;
    end if;
  end if;
  return new;
end;
$$;

-- No new trips for a closed account. Takes the same lock a trip's foreign keys
-- do, and doesn't filter on closed_at, so it waits for a closure in progress
-- and then sees its result.
create or replace function public.trips_refuse_closed_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  person record;
begin
  for person in
    select closed_at from public.profiles where id in (new.guest_id, new.host_id) for key share
  loop
    if person.closed_at is not null then
      raise exception 'This account is closed.' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trips_refuse_closed_accounts' and tgrelid = 'public.trips'::regclass) then
    create trigger trips_refuse_closed_accounts before insert on public.trips
      for each row execute function public.trips_refuse_closed_accounts();
  end if;
end $$;

-- The database half of closing, in one transaction: stamps closed_at, takes the
-- cars off search, and clears the profile, the licence row and the insurance
-- row. The lock waits for any booking in flight and holds off new ones, so the
-- open trip check here can't be raced. False when a trip is open after all.
-- A closure already begun skips the check, so a retry always finishes.
create or replace function public.begin_account_closure(p_user_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  stamped timestamptz;
begin
  select closed_at into stamped from public.profiles where id = p_user_id for update;
  if not found then
    return false;
  end if;

  if stamped is null and exists (
    select 1 from public.trips t
    where (t.guest_id = p_user_id or t.host_id = p_user_id)
      and (
        t.status in ('approved', 'active')
        -- An unpaid checkout only holds its dates for 30 minutes, as in holdsDates.
        or (t.status = 'pending' and (t.payment_status not in ('pending', 'failed') or t.created_at >= now() - interval '30 minutes'))
      )
  ) then
    return false;
  end if;

  update public.profiles
  set closed_at = coalesce(closed_at, now()),
      full_name = 'Closed account',
      avatar_url = null,
      bio = null,
      phone = null,
      date_of_birth = null,
      -- The photos behind these are going, so the marks go with them.
      driving_license_verified = false,
      identity_verified = false,
      identity_status = 'unverified',
      identity_session_id = null,
      identity_error = null,
      updated_at = now()
  where id = p_user_id;

  update public.vehicles set status = 'unlisted', updated_at = now()
  where host_id = p_user_id and status = 'listed';

  delete from public.guest_licences where user_id = p_user_id;
  delete from public.guest_insurance where user_id = p_user_id;

  return true;
end;
$$;

-- Server only. Supabase grants new functions to anon and authenticated by default.
revoke execute on function public.begin_account_closure(uuid) from public, anon, authenticated;
revoke execute on function public.trips_refuse_closed_accounts() from public, anon, authenticated;
grant execute on function public.begin_account_closure(uuid) to service_role;
