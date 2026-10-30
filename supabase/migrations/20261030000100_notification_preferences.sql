-- What each person wants to hear about, set on their profile. Trip and account
-- email can't be turned off, so it has no column. A missing row means the
-- defaults here. Additive and safe to run more than once.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  messages_email boolean not null default true,
  recommendations_email boolean not null default false,
  offers_email boolean not null default false,
  news_email boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Only you read or change yours. The server reads it to decide what to email.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_own') then
    create policy notification_preferences_own on public.notification_preferences for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

revoke all on public.notification_preferences from anon;
