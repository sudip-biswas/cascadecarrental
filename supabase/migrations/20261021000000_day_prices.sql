-- Hosts' per-day prices, which the calendar sets, now price guest trips too.

-- The calendar's table, in case it was never created on this database.
CREATE TABLE IF NOT EXISTS vehicle_daily_prices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, date)
);
ALTER TABLE vehicle_daily_prices ENABLE ROW LEVEL SECURITY;

-- Hosts manage their own cars' prices. Guests never read the table: the server does.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_daily_prices') THEN
    CREATE POLICY "vehicle_daily_prices_host" ON vehicle_daily_prices FOR ALL
      USING (EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()));
  END IF;
END $$;

-- The rental before discounts. With per-day prices it is no longer daily rate × days,
-- so the receipt reads it from here. Older trips leave it empty.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS base_cents INTEGER;
