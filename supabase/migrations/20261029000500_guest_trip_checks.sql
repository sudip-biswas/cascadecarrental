-- Pre-trip checks for guests, the way Turo asks for them after booking: a
-- checked licence with a matching selfie (Stripe Identity, already on
-- profiles), and cover for the car: the guest's own insurance, or a
-- protection plan on the trip. The guest can't check in until both are done.
-- The rules live in lib/guest-checks.ts too. Additive and safe to run more
-- than once.

-- ---------------------------------------------------------------------------
-- The guest's own auto insurance, one policy per person, used on every trip
-- ---------------------------------------------------------------------------
create table if not exists public.guest_insurance (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- True when the guest says they have no insurance: then every trip needs a protection plan.
  has_none boolean not null default false,
  insurer text check (char_length(insurer) between 1 and 120),
  policy_number text check (char_length(policy_number) between 1 and 60),
  -- The last day the policy covers.
  expires_on date,
  -- Path in the insurance-cards bucket: <user id>/<file>.
  card_path text check (char_length(card_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_insurance_filled check (
    has_none or (insurer is not null and policy_number is not null and expires_on is not null)
  )
);

alter table public.guest_insurance enable row level security;

-- Only the guest reads or writes the row. Hosts and Cascade read it on the
-- server, and hosts only ever see the insurer and the end date.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'guest_insurance' and policyname = 'guest_insurance_own') then
    create policy guest_insurance_own on public.guest_insurance for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

revoke all on public.guest_insurance from anon;

-- Each trip's checks reminder goes out once.
alter table public.trips add column if not exists checks_reminded_at timestamptz;

-- ---------------------------------------------------------------------------
-- Private bucket for insurance card photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insurance-cards', 'insurance-cards', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- The guest manages their own folder. The host of a booked trip with that
-- guest can read it. Cascade staff use the service role.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'insurance_cards_own') then
    create policy insurance_cards_own on storage.objects for all to authenticated
      using (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'insurance_cards_trip_host') then
    create policy insurance_cards_trip_host on storage.objects for select to authenticated
      using (
        bucket_id = 'insurance-cards'
        and exists (
          select 1 from public.trips t
          where t.guest_id::text = (storage.foldername(name))[1]
            and t.host_id = auth.uid()
            and t.status in ('approved', 'active', 'completed')
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What a guest still has to do before checking in on a trip
-- ---------------------------------------------------------------------------
-- 'licence' until Stripe Identity has passed; 'cover' when the trip has no
-- protection plan and the guest's own policy is missing, declined or ends
-- before pick-up. Matches missingChecks in lib/guest-checks.ts.
create or replace function public.guest_trip_checks_missing(p_trip_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when coalesce(p.driving_license_verified, false) then null else 'licence' end,
    case
      when t.protection_plan is not null then null
      when gi.user_id is not null and not gi.has_none
        and gi.expires_on >= (t.starts_at at time zone 'America/Los_Angeles')::date then null
      else 'cover'
    end
  ], null)
  from public.trips t
  left join public.profiles p on p.id = t.guest_id
  left join public.guest_insurance gi on gi.user_id = t.guest_id
  where t.id = p_trip_id;
$$;

revoke all on function public.guest_trip_checks_missing(uuid) from public, anon, authenticated;

-- The guest's check-in is refused until the checks are done. The host's
-- side, and check-out, are never held up.
create or replace function public.trip_inspections_require_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'pickup' and new.role = 'guest'
    and cardinality(coalesce(public.guest_trip_checks_missing(new.trip_id), '{}')) > 0 then
    raise exception 'guest_checks_missing' using hint = 'Check your licence and add your insurance before checking in.';
  end if;
  return new;
end;
$$;

revoke all on function public.trip_inspections_require_checks() from public, anon, authenticated;

create or replace trigger trip_inspections_require_checks
  before insert or update on public.trip_inspections
  for each row execute function public.trip_inspections_require_checks();
