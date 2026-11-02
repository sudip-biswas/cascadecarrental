-- Manual licence check, the way Turo does it: the guest uploads a photo of
-- their licence and a selfie holding it, and the host compares them with the
-- booking. It replaces Stripe Identity. The result lands on the same profile
-- columns, so the check-in lock and every "licence checked" mark are unchanged:
-- identity_status is 'pending' while it waits, 'failed' with identity_error when
-- rejected, and 'verified' when approved. Additive and safe to run more than once.

create table if not exists public.guest_licences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Paths in the guest-licences bucket: <user id>/<file>.
  licence_path text not null check (char_length(licence_path) <= 300),
  selfie_path text not null check (char_length(selfie_path) <= 300),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.guest_licences enable row level security;

-- The guest can see their own row. All writes, and every photo link, go through the server.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'guest_licences' and policyname = 'guest_licences_read_own') then
    create policy guest_licences_read_own on public.guest_licences for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

revoke all on public.guest_licences from anon;
revoke insert, update, delete on public.guest_licences from authenticated;

-- Private, with no storage policies: only the server can read or write it, and
-- it hands out short-lived links to the guest's host once the trip is booked.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-licences', 'guest-licences', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Private columns stay private
-- ---------------------------------------------------------------------------
-- booking_integrity keeps phones, dates of birth, Stripe ids, plates, VINs and
-- exact addresses away from the public API, but a table-wide read grant had
-- come back on both tables. Owners read those columns through the server.
-- Revoking a table grant drops the column grants too, so they're set again here.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, full_name, avatar_url, bio, is_host, host_since,
  driving_license_verified, identity_verified, created_at, updated_at
) on public.profiles to anon, authenticated;

do $$
declare
  public_columns text;
begin
  select string_agg(quote_ident(column_name), ', ') into public_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'vehicles'
    and column_name not in ('license_plate', 'vin', 'location_address');
  revoke select on public.vehicles from anon, authenticated;
  execute format('grant select (%s) on public.vehicles to anon, authenticated', public_columns);
end $$;

-- ---------------------------------------------------------------------------
-- Guests can set their own date of birth
-- ---------------------------------------------------------------------------
-- The profile form and checkout both write it. protect_profile_columns freezes
-- it once a licence is approved.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, bio, phone, date_of_birth, updated_at) on public.profiles to authenticated;
