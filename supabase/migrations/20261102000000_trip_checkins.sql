-- Per-trip licence + selfie check-in. The guest uploads a photo of their
-- licence and a selfie after booking; the host reviews and approves before
-- pick-up. The guest can't start their check-in inspection until approved.
-- Additive and safe to run more than once.

-- ---------------------------------------------------------------------------
-- The check-in record, one per trip
-- ---------------------------------------------------------------------------
create table if not exists public.trip_checkins (
  id uuid primary key default gen_random_uuid(),
  -- One check-in per trip; upserted when the guest resubmits after rejection.
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  -- Paths in the checkin-photos bucket: <trip id>/<uuid>.<ext>
  license_path text not null check (char_length(license_path) between 1 and 300),
  selfie_path  text not null check (char_length(selfie_path)  between 1 and 300),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  -- Shown to the guest when the host rejects.
  host_notes text check (char_length(host_notes) <= 2000),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.trip_checkins enable row level security;

-- Guest reads and writes their own row; host of the trip reads it.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trip_checkins' and policyname = 'trip_checkins_guest') then
    create policy trip_checkins_guest on public.trip_checkins for all to authenticated
      using  (guest_id = auth.uid())
      with check (guest_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trip_checkins' and policyname = 'trip_checkins_host_read') then
    create policy trip_checkins_host_read on public.trip_checkins for select to authenticated
      using (
        exists (
          select 1 from public.trips t
          where t.id = trip_id and t.host_id = auth.uid()
        )
      );
  end if;
end $$;

revoke all on public.trip_checkins from anon;

-- ---------------------------------------------------------------------------
-- Private bucket for licence + selfie photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Paths: <trip_id>/<uuid>.<ext>. Guest manages their trip's folder; host of
-- that trip can read it (for pending through completed trips).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'checkin_photos_guest') then
    create policy checkin_photos_guest on storage.objects for all to authenticated
      using (
        bucket_id = 'checkin-photos'
        and exists (
          select 1 from public.trips t
          where t.id::text = (storage.foldername(name))[1]
            and t.guest_id = auth.uid()
        )
      )
      with check (
        bucket_id = 'checkin-photos'
        and exists (
          select 1 from public.trips t
          where t.id::text = (storage.foldername(name))[1]
            and t.guest_id = auth.uid()
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'checkin_photos_host') then
    create policy checkin_photos_host on storage.objects for select to authenticated
      using (
        bucket_id = 'checkin-photos'
        and exists (
          select 1 from public.trips t
          where t.id::text = (storage.foldername(name))[1]
            and t.host_id = auth.uid()
            and t.status in ('pending', 'approved', 'active', 'completed')
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Update the pre-trip checks gate to use trip_checkins instead of
-- profiles.driving_license_verified
-- ---------------------------------------------------------------------------
-- 'licence' until the host has approved this trip's check-in photos;
-- 'cover' when the trip has no protection plan and the guest's own policy
-- is missing, declined or ends before pick-up. Matches guestChecks() in
-- lib/guest-checks.ts.
create or replace function public.guest_trip_checks_missing(p_trip_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when exists (
      select 1 from public.trip_checkins tc
      where tc.trip_id = p_trip_id and tc.status = 'approved'
    ) then null else 'licence' end,
    case
      when t.protection_plan is not null then null
      when gi.user_id is not null and not gi.has_none
        and gi.expires_on >= (t.starts_at at time zone 'America/Los_Angeles')::date then null
      else 'cover'
    end
  ], null)
  from public.trips t
  left join public.guest_insurance gi on gi.user_id = t.guest_id
  where t.id = p_trip_id;
$$;

revoke all on function public.guest_trip_checks_missing(uuid) from public, anon, authenticated;
