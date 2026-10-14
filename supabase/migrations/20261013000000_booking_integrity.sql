-- =============================================================
-- Booking integrity and tighter row security.
--
-- Trip writes now go through the server (service role) only, so guests
-- can't create or edit trips directly. The database also refuses two live
-- trips on the same car at the same time.
--
-- Before running: this finds trips that already overlap. The constraint
-- below can't be added while any exist, so cancel the duplicates first.
--
--   SELECT a.id, b.id, a.vehicle_id, a.starts_at, a.ends_at, b.starts_at, b.ends_at
--   FROM trips a JOIN trips b
--     ON a.vehicle_id = b.vehicle_id AND a.id < b.id
--    AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
--   WHERE a.status NOT IN ('cancelled_guest', 'cancelled_host')
--     AND b.status NOT IN ('cancelled_guest', 'cancelled_host');
-- =============================================================

BEGIN;

-- ---------- Trips: no double booking ----------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE trips
  ADD CONSTRAINT trips_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled_guest', 'cancelled_host'));

ALTER TABLE trips ADD CONSTRAINT trips_ends_after_start CHECK (ends_at > starts_at);

-- When the trip was confirmed. "Pay now" bookings get 24 hours of free
-- cancellation from this moment, so a slow host doesn't eat into it.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
UPDATE trips SET approved_at = updated_at WHERE status IN ('approved', 'active', 'completed') AND approved_at IS NULL;

-- A released card hold is "voided", not "failed".
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_payment_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_payment_status_check
  CHECK (payment_status IN ('pending', 'authorized', 'captured', 'refunded', 'voided', 'failed'));

-- ---------- Trips: server-only writes ----------
DROP POLICY IF EXISTS "trips_insert_guest" ON trips;
DROP POLICY IF EXISTS "trips_update_participant" ON trips;

-- ---------- Profiles: users edit their own details, not their flags ----------
REVOKE INSERT, UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, bio, phone, updated_at) ON profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- Vehicles: ratings and trip counts come from triggers ----------
REVOKE INSERT, UPDATE ON vehicles FROM anon, authenticated;
GRANT INSERT (
  host_id, make, model, trim, year, color, license_plate, vin, vehicle_type, fuel_type,
  transmission, seats, doors, mpg, range_miles, location_name, location_lat, location_lng,
  location_address, daily_rate_cents, weekly_discount_pct, monthly_discount_pct,
  distance_included_mi, extra_mile_fee_cents, min_trip_days, max_trip_days,
  advance_notice_hours, instant_book, description, status
) ON vehicles TO authenticated;
GRANT UPDATE (
  make, model, trim, year, color, license_plate, vin, vehicle_type, fuel_type,
  transmission, seats, doors, mpg, range_miles, location_name, location_lat, location_lng,
  location_address, daily_rate_cents, weekly_discount_pct, monthly_discount_pct,
  distance_included_mi, extra_mile_fee_cents, min_trip_days, max_trip_days,
  advance_notice_hours, instant_book, description, status, updated_at
) ON vehicles TO authenticated;

DROP POLICY IF EXISTS "vehicles_insert_own" ON vehicles;
CREATE POLICY "vehicles_insert_own" ON vehicles FOR INSERT
  WITH CHECK (host_id = auth.uid() AND status <> 'suspended');
-- A suspended car stays suspended until Cascade lifts it.
DROP POLICY IF EXISTS "vehicles_update_own" ON vehicles;
CREATE POLICY "vehicles_update_own" ON vehicles FOR UPDATE
  USING (host_id = auth.uid() AND status <> 'suspended')
  WITH CHECK (host_id = auth.uid() AND status <> 'suspended');

-- Old listings could save nonsense like -39 MPG. Clear those, then stop new ones.
UPDATE vehicles SET mpg = NULL WHERE mpg < 1 OR mpg > 150;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_mpg_range CHECK (mpg IS NULL OR mpg BETWEEN 1 AND 150);

-- ---------- Reviews: only for your own finished trip ----------
DROP POLICY IF EXISTS "reviews_insert_reviewer" ON reviews;
CREATE POLICY "reviews_insert_reviewer" ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND t.guest_id = auth.uid()
        AND t.status = 'completed'
        AND t.vehicle_id = reviews.vehicle_id
        AND t.host_id = reviews.reviewee_id
    )
  );
-- Hosts can reply, not change the rating.
REVOKE UPDATE ON reviews FROM anon, authenticated;
GRANT UPDATE (host_reply, host_replied_at) ON reviews TO authenticated;

-- ---------- Messages: recipients can mark them read ----------
REVOKE UPDATE ON messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON messages TO authenticated;
DROP POLICY IF EXISTS "messages_mark_read" ON messages;
CREATE POLICY "messages_mark_read" ON messages FOR UPDATE
  USING (
    sender_id <> auth.uid() AND EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id
      AND (c.guest_id = auth.uid() OR c.host_id = auth.uid())
    )
  );

-- ---------- Private columns: only the server reads these ----------
-- Phone numbers, Stripe ids, plates, VINs, exact addresses and block notes
-- are hidden from the public API. Owners read them through the server.
REVOKE SELECT ON profiles FROM anon, authenticated;
GRANT SELECT (
  id, full_name, avatar_url, bio, is_host, host_since,
  driving_license_verified, identity_verified, created_at, updated_at
) ON profiles TO anon, authenticated;

REVOKE SELECT ON vehicles FROM anon, authenticated;
GRANT SELECT (
  id, host_id, make, model, trim, year, color, vehicle_type, fuel_type, transmission,
  seats, doors, mpg, range_miles, location_name, location_lat, location_lng,
  daily_rate_cents, weekly_discount_pct, monthly_discount_pct, distance_included_mi,
  extra_mile_fee_cents, min_trip_days, max_trip_days, advance_notice_hours, instant_book,
  description, status, rating_avg, trip_count, created_at, updated_at
) ON vehicles TO anon, authenticated;

REVOKE SELECT ON vehicle_availability FROM anon, authenticated;
GRANT SELECT (id, vehicle_id, blocked_from, blocked_to, created_at)
  ON vehicle_availability TO anon, authenticated;

-- ---------- Triggers run as owner, so they work under the grants above ----------
ALTER FUNCTION update_vehicle_stats() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION update_vehicle_rating() SECURITY DEFINER SET search_path = public;
-- Auth runs this with its own search_path, where "profiles" doesn't resolve.
ALTER FUNCTION handle_new_user() SET search_path = public;

COMMIT;
