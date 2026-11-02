-- The check-in lock reads the licence result the app writes: the profile's
-- driving_license_verified, set when a host approves the licence. Puts back the
-- rule from guest_trip_checks if it was changed, and stops guests writing to
-- trip_checkins, if that table exists, because a row there can't unlock check-in
-- any more. Additive and safe to run more than once.
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

do $$
begin
  if to_regclass('public.trip_checkins') is not null then
    revoke insert, update, delete on public.trip_checkins from anon, authenticated;
  end if;
end $$;
