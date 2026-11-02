-- Top host for guests. Additive and safe to run more than once.

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
