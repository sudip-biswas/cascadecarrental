-- Indexes for the search filters: features and the unlimited miles add-on are
-- looked up by value, then joined back to listed cars. Additive and safe to run
-- more than once.

create index if not exists idx_vehicle_features_feature
  on public.vehicle_features (feature, vehicle_id);

create index if not exists idx_vehicle_extras_unlimited
  on public.vehicle_extras (vehicle_id)
  where unlimited_miles and active;

create index if not exists idx_vehicles_listed_price
  on public.vehicles (daily_rate_cents)
  where status = 'listed';
