-- Guest instructions per car: how pick-up works, a welcome note for check-in,
-- a guide to the car's quirks, and FAQs. Only shown to guests once a trip on
-- the car is booked. Additive and safe to run more than once.

create table if not exists public.vehicle_guest_instructions (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  -- How the guest gets the keys, shown as one line on both trip pages.
  check_in_method text not null default 'in_person'
    check (check_in_method in ('in_person', 'lockbox', 'keyless')),
  -- Applies to every trip except deliveries, where the host brings the car.
  pickup_instructions text check (char_length(pickup_instructions) <= 5000),
  welcome_message text check (char_length(welcome_message) <= 170),
  car_guide text check (char_length(car_guide) <= 5000),
  -- [{ "question": "...", "answer": "..." }]
  faqs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 20),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_guest_instructions enable row level security;

-- True when the signed-in user has a booked trip (not just a request) on the
-- car. Security definer so the check doesn't depend on the trips policies.
create or replace function public.has_booked_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.vehicle_id = p_vehicle_id
      and t.guest_id = auth.uid()
      and t.status in ('approved', 'active', 'completed')
  );
$$;

revoke all on function public.has_booked_vehicle(uuid) from public;
grant execute on function public.has_booked_vehicle(uuid) to authenticated;

drop policy if exists vehicle_guest_instructions_host on public.vehicle_guest_instructions;
create policy vehicle_guest_instructions_host on public.vehicle_guest_instructions for all to authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_guest_instructions.vehicle_id and v.host_id = auth.uid())
) with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_guest_instructions.vehicle_id and v.host_id = auth.uid())
);

drop policy if exists vehicle_guest_instructions_booked_guest on public.vehicle_guest_instructions;
create policy vehicle_guest_instructions_booked_guest on public.vehicle_guest_instructions for select to authenticated using (
  public.has_booked_vehicle(vehicle_id)
);
