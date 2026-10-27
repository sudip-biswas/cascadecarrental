-- Listing reports: a signed-in guest flags a car page (wrong photos, a scam,
-- something unsafe). Staff read them on the admin page and mark them sorted.

create table if not exists public.listing_reports (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null
    check (reason in ('inaccurate', 'photos', 'scam', 'unsafe', 'offensive', 'other')),
  details     text check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_listing_reports_status_created
  on public.listing_reports (status, created_at desc);

-- One open report per person per car, so a double click doesn't file two.
create unique index if not exists listing_reports_one_open
  on public.listing_reports (vehicle_id, reporter_id)
  where status = 'open';

alter table public.listing_reports enable row level security;

-- People file and see their own reports. Staff use the service role.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'listing_reports' and policyname = 'listing_reports_insert_own') then
    create policy "listing_reports_insert_own" on public.listing_reports for insert
      with check (reporter_id = auth.uid() and status = 'open' and resolved_at is null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listing_reports' and policyname = 'listing_reports_select_own') then
    create policy "listing_reports_select_own" on public.listing_reports for select
      using (reporter_id = auth.uid());
  end if;
end $$;

grant select, insert on public.listing_reports to authenticated;
