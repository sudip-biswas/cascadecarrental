-- Scheduled messages: a host's message templates, and the copy of each one
-- waiting to go out on a trip.

-- ---------------------------------------------------------------------------
-- Templates: what to send, when, and to which trips
-- ---------------------------------------------------------------------------

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  -- Only the host sees the name.
  name text not null check (char_length(name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  -- The trip moment it hangs off, and how far before or after it.
  event text not null check (event in ('booked', 'trip_start', 'three_quarters', 'trip_end')),
  offset_minutes integer not null default 0 check (offset_minutes between 0 and 7200),
  direction text not null default 'after' check (direction in ('before', 'after')),
  trip_type text not null default 'all'
    check (trip_type in ('all', 'any_delivery', 'no_delivery', 'custom_delivery', 'airport_delivery')),
  -- Null means every car the host has, including ones listed later.
  vehicle_ids uuid[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_message_templates_host on public.message_templates (host_id);

alter table public.message_templates enable row level security;

drop policy if exists message_templates_manage_own on public.message_templates;
create policy message_templates_manage_own on public.message_templates for all
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- ---------------------------------------------------------------------------
-- One template's send on one trip. The name and body are copied in when it's
-- scheduled, so the queue still reads right if the template goes away.
-- ---------------------------------------------------------------------------

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.message_templates(id) on delete set null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled')),
  sent_at timestamptz,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, template_id)
);
-- The sender only ever looks for scheduled rows that are due.
create index if not exists idx_scheduled_messages_due on public.scheduled_messages (send_at) where status = 'scheduled';
create index if not exists idx_scheduled_messages_host on public.scheduled_messages (host_id, send_at);

alter table public.scheduled_messages enable row level security;

-- Hosts read their own queue. Scheduling, sending and skipping happen on the
-- server, after it checks the host owns the trip.
drop policy if exists scheduled_messages_select_own on public.scheduled_messages;
create policy scheduled_messages_select_own on public.scheduled_messages for select
  using (host_id = auth.uid());
