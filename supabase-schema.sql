-- =============================================================
-- Cascade Car Rental — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;

-- =============================================================
-- PROFILES (extends auth.users)
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               TEXT NOT NULL DEFAULT '',
  avatar_url              TEXT,
  bio                     TEXT,
  phone                   TEXT,
  is_host                 BOOLEAN NOT NULL DEFAULT false,
  host_since              TIMESTAMPTZ,
  stripe_customer_id      TEXT UNIQUE,
  stripe_account_id       TEXT UNIQUE,
  driving_license_verified BOOLEAN NOT NULL DEFAULT false,
  identity_verified       BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- VEHICLES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  make                  TEXT NOT NULL,
  model                 TEXT NOT NULL,
  trim                  TEXT,
  year                  SMALLINT NOT NULL,
  color                 TEXT,
  license_plate         TEXT NOT NULL,
  vin                   TEXT UNIQUE,
  vehicle_type          TEXT NOT NULL DEFAULT 'sedan',
  fuel_type             TEXT NOT NULL DEFAULT 'gasoline',
  transmission          TEXT NOT NULL DEFAULT 'automatic',
  seats                 SMALLINT NOT NULL DEFAULT 5,
  doors                 SMALLINT,
  mpg                   SMALLINT,
  range_miles           SMALLINT,
  location_name         TEXT NOT NULL,
  location_lat          DOUBLE PRECISION NOT NULL DEFAULT 47.6062,
  location_lng          DOUBLE PRECISION NOT NULL DEFAULT -122.3321,
  location_address      TEXT,
  daily_rate_cents      INTEGER NOT NULL DEFAULT 5000,
  weekly_discount_pct   SMALLINT NOT NULL DEFAULT 0,
  monthly_discount_pct  SMALLINT NOT NULL DEFAULT 0,
  distance_included_mi  INTEGER NOT NULL DEFAULT 200,
  extra_mile_fee_cents  INTEGER NOT NULL DEFAULT 20,
  min_trip_days         SMALLINT NOT NULL DEFAULT 1,
  max_trip_days         SMALLINT NOT NULL DEFAULT 30,
  advance_notice_hours  SMALLINT NOT NULL DEFAULT 1,
  instant_book          BOOLEAN NOT NULL DEFAULT true,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'unlisted'
                        CHECK (status IN ('listed', 'unlisted', 'suspended')),
  rating_avg            NUMERIC(3,2),
  trip_count            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_host_id ON vehicles(host_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status) WHERE status = 'listed';
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_daily_rate ON vehicles(daily_rate_cents);
CREATE INDEX IF NOT EXISTS idx_vehicles_seats ON vehicles(seats);
CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel ON vehicles(fuel_type);

-- =============================================================
-- VEHICLE IMAGES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  position     SMALLINT NOT NULL DEFAULT 0,
  is_cover     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);

-- =============================================================
-- VEHICLE FEATURES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  feature     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_features_vehicle_id ON vehicle_features(vehicle_id);

-- =============================================================
-- VEHICLE AVAILABILITY (host-blocked dates)
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  blocked_from TIMESTAMPTZ NOT NULL,
  blocked_to   TIMESTAMPTZ NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_vehicle_id ON vehicle_availability(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_availability_dates ON vehicle_availability(blocked_from, blocked_to);

-- =============================================================
-- TRIPS
-- =============================================================
CREATE TABLE IF NOT EXISTS trips (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id                  UUID NOT NULL REFERENCES vehicles(id),
  guest_id                    UUID NOT NULL REFERENCES profiles(id),
  host_id                     UUID NOT NULL REFERENCES profiles(id),
  starts_at                   TIMESTAMPTZ NOT NULL,
  ends_at                     TIMESTAMPTZ NOT NULL,
  pickup_location             TEXT NOT NULL,
  daily_rate_cents            INTEGER NOT NULL,
  subtotal_cents              INTEGER NOT NULL,
  tax_cents                   INTEGER NOT NULL,
  total_cents                 INTEGER NOT NULL,
  distance_included_mi        INTEGER NOT NULL DEFAULT 200,
  extra_mile_fee_cents        INTEGER NOT NULL DEFAULT 20,
  rate_type                   TEXT NOT NULL DEFAULT 'non_refundable'
                              CHECK (rate_type IN ('refundable', 'non_refundable')),
  protection_plan             TEXT CHECK (protection_plan IN ('basic', 'standard', 'premium')),
  protection_cost_cents       INTEGER NOT NULL DEFAULT 0,
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_charge_id            TEXT,
  payment_status              TEXT NOT NULL DEFAULT 'pending'
                              CHECK (payment_status IN ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  pay_later                   BOOLEAN NOT NULL DEFAULT false,
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled_guest', 'cancelled_host')),
  cancellation_reason         TEXT,
  cancelled_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_guest_id ON trips(guest_id);
CREATE INDEX IF NOT EXISTS idx_trips_host_id ON trips(host_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_dates ON trips(vehicle_id, starts_at, ends_at)
  WHERE status NOT IN ('cancelled_guest', 'cancelled_host');

-- Trigger: update vehicle stats after trip completion
CREATE OR REPLACE FUNCTION update_vehicle_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE vehicles SET
      trip_count = (
        SELECT COUNT(*) FROM trips
        WHERE vehicle_id = NEW.vehicle_id AND status = 'completed'
      ),
      updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_trip_status_change
  AFTER INSERT OR UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_stats();

-- =============================================================
-- CONVERSATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID REFERENCES trips(id) ON DELETE SET NULL,
  guest_id   UUID NOT NULL REFERENCES profiles(id),
  host_id    UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guest_id, host_id, trip_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_guest_id ON conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON conversations(host_id);
CREATE INDEX IF NOT EXISTS idx_conversations_trip_id ON conversations(trip_id);

-- =============================================================
-- MESSAGES
-- =============================================================
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES profiles(id),
  body             TEXT NOT NULL,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at DESC);

-- Enable Realtime for messages
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =============================================================
-- REVIEWS
-- =============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL UNIQUE REFERENCES trips(id),
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
  reviewer_id         UUID NOT NULL REFERENCES profiles(id),
  reviewee_id         UUID NOT NULL REFERENCES profiles(id),
  rating_overall      SMALLINT NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_cleanliness  SMALLINT CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_accuracy     SMALLINT CHECK (rating_accuracy BETWEEN 1 AND 5),
  rating_value        SMALLINT CHECK (rating_value BETWEEN 1 AND 5),
  body                TEXT,
  host_reply          TEXT,
  host_replied_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vehicle_id ON reviews(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);

-- Trigger: update vehicle rating after review
CREATE OR REPLACE FUNCTION update_vehicle_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE vehicles SET
    rating_avg = (
      SELECT AVG(rating_overall)::NUMERIC(3,2)
      FROM reviews WHERE vehicle_id = NEW.vehicle_id
    ),
    trip_count = (
      SELECT COUNT(*) FROM trips
      WHERE vehicle_id = NEW.vehicle_id AND status = 'completed'
    ),
    updated_at = now()
  WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_review_insert
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_rating();

-- =============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- VEHICLES
CREATE POLICY "vehicles_select_listed" ON vehicles FOR SELECT
  USING (status = 'listed' OR host_id = auth.uid());
CREATE POLICY "vehicles_insert_own" ON vehicles FOR INSERT
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "vehicles_update_own" ON vehicles FOR UPDATE
  USING (host_id = auth.uid());
CREATE POLICY "vehicles_delete_own" ON vehicles FOR DELETE
  USING (host_id = auth.uid());

-- VEHICLE IMAGES
CREATE POLICY "vehicle_images_select" ON vehicle_images FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id
    AND (v.status = 'listed' OR v.host_id = auth.uid())
  ));
CREATE POLICY "vehicle_images_insert_own" ON vehicle_images FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));
CREATE POLICY "vehicle_images_delete_own" ON vehicle_images FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));

-- VEHICLE FEATURES (same pattern as images)
CREATE POLICY "vehicle_features_select" ON vehicle_features FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id
    AND (v.status = 'listed' OR v.host_id = auth.uid())
  ));
CREATE POLICY "vehicle_features_insert_own" ON vehicle_features FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));

-- VEHICLE AVAILABILITY
CREATE POLICY "vehicle_availability_select" ON vehicle_availability FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id
    AND (v.status = 'listed' OR v.host_id = auth.uid())
  ));
CREATE POLICY "vehicle_availability_insert_own" ON vehicle_availability FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));
CREATE POLICY "vehicle_availability_delete_own" ON vehicle_availability FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));

-- TRIPS
CREATE POLICY "trips_select_participant" ON trips FOR SELECT
  USING (guest_id = auth.uid() OR host_id = auth.uid());
CREATE POLICY "trips_insert_guest" ON trips FOR INSERT
  WITH CHECK (guest_id = auth.uid());
CREATE POLICY "trips_update_participant" ON trips FOR UPDATE
  USING (guest_id = auth.uid() OR host_id = auth.uid());

-- CONVERSATIONS
CREATE POLICY "conversations_select_participant" ON conversations FOR SELECT
  USING (guest_id = auth.uid() OR host_id = auth.uid());
CREATE POLICY "conversations_insert_participant" ON conversations FOR INSERT
  WITH CHECK (guest_id = auth.uid() OR host_id = auth.uid());

-- MESSAGES
CREATE POLICY "messages_select_participant" ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id
    AND (c.guest_id = auth.uid() OR c.host_id = auth.uid())
  ));
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c WHERE c.id = conversation_id
      AND (c.guest_id = auth.uid() OR c.host_id = auth.uid())
    )
  );

-- REVIEWS
CREATE POLICY "reviews_select_public" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_reviewer" ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "reviews_update_host_reply" ON reviews FOR UPDATE
  USING (reviewee_id = auth.uid());

-- =============================================================
-- SUPABASE STORAGE BUCKET
-- =============================================================
-- Run this in Storage section OR uncomment here:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);
-- CREATE POLICY "vehicle_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-images');
-- CREATE POLICY "vehicle_images_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vehicle-images' AND auth.role() = 'authenticated');
-- CREATE POLICY "vehicle_images_owner_delete" ON storage.objects FOR DELETE USING (bucket_id = 'vehicle-images' AND auth.uid()::text = (storage.foldername(name))[1]);
