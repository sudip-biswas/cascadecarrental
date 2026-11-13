-- =============================================================
-- Fix known incorrect seat counts on micro/subcompact vehicles
-- (default is 5; these cars physically seat fewer)
-- =============================================================
UPDATE vehicles SET seats = 2
  WHERE make = 'Smart' AND model ILIKE '%Fortwo%';

UPDATE vehicles SET seats = 4
  WHERE (make = 'Scion' AND model = 'iQ')
     OR (make = 'Fiat'  AND model = '500')
     OR (make = 'Fiat'  AND model ILIKE '%500%');

-- =============================================================
-- Seed reviews — synthetic past trips and guest reviews.
-- Creates 5 fake auth users used only as review authors.
-- Run this in the Supabase SQL Editor (requires superuser / postgres role).
-- If it fails on auth.users insertion your plan restricts direct auth writes;
-- ask Cascade support to run the review insert block manually with real trip IDs.
-- =============================================================
DO $$
DECLARE
  r1 UUID := '10000000-0000-0000-0000-000000000001';
  r2 UUID := '10000000-0000-0000-0000-000000000002';
  r3 UUID := '10000000-0000-0000-0000-000000000003';
  r4 UUID := '10000000-0000-0000-0000-000000000004';
  r5 UUID := '10000000-0000-0000-0000-000000000005';
  host UUID;
  v_id UUID;
  t_id UUID;
BEGIN
  -- Pick the single fleet host
  SELECT id INTO host FROM profiles WHERE is_host = true LIMIT 1;
  IF host IS NULL THEN
    RAISE NOTICE 'No host profile found — skipping review seed.';
    RETURN;
  END IF;

  -- Create auth.users stubs (no password, confirmed, inactive accounts)
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_user_meta_data, created_at, updated_at, is_anonymous)
  VALUES
    (r1,'authenticated','authenticated','seed-r1@cascade-internal','',now(),'{"full_name":"James K."}','2026-02-01','2026-02-01',false),
    (r2,'authenticated','authenticated','seed-r2@cascade-internal','',now(),'{"full_name":"Sarah M."}','2026-03-01','2026-03-01',false),
    (r3,'authenticated','authenticated','seed-r3@cascade-internal','',now(),'{"full_name":"David L."}','2026-04-01','2026-04-01',false),
    (r4,'authenticated','authenticated','seed-r4@cascade-internal','',now(),'{"full_name":"Emily R."}','2026-05-01','2026-05-01',false),
    (r5,'authenticated','authenticated','seed-r5@cascade-internal','',now(),'{"full_name":"Marcus T."}','2026-06-01','2026-06-01',false)
  ON CONFLICT (id) DO NOTHING;

  -- Profiles are auto-created by trigger, but seed them explicitly in case
  INSERT INTO profiles (id, full_name, created_at, updated_at)
  VALUES
    (r1,'James K.','2026-02-01','2026-02-01'),
    (r2,'Sarah M.','2026-03-01','2026-03-01'),
    (r3,'David L.','2026-04-01','2026-04-01'),
    (r4,'Emily R.','2026-05-01','2026-05-01'),
    (r5,'Marcus T.','2026-06-01','2026-06-01')
  ON CONFLICT (id) DO NOTHING;

  -- Helper: for each vehicle we want to review, create a past trip then a review.
  -- We iterate up to 15 listed vehicles (picking ones with no reviews yet).
  FOR v_id IN
    SELECT id FROM vehicles
    WHERE status = 'listed' AND trip_count = 0
    ORDER BY year DESC, daily_rate_cents DESC
    LIMIT 15
  LOOP
    t_id := gen_random_uuid();

    -- Use rotating reviewer IDs
    INSERT INTO trips (
      id, vehicle_id, guest_id, host_id,
      starts_at, ends_at,
      pickup_location, daily_rate_cents,
      subtotal_cents, tax_cents, total_cents,
      distance_included_mi, extra_mile_fee_cents,
      rate_type, payment_status, status,
      created_at, updated_at
    )
    SELECT
      t_id, v_id,
      CASE (ROW_NUMBER() OVER (ORDER BY v.id))::int % 5
        WHEN 0 THEN r1 WHEN 1 THEN r2 WHEN 2 THEN r3 WHEN 3 THEN r4 ELSE r5 END,
      v.host_id,
      (now() - interval '60 days' - (RANDOM() * 120 || ' days')::interval),
      (now() - interval '60 days' - (RANDOM() * 120 || ' days')::interval + interval '3 days'),
      'DoubleTree by Hilton SeaTac, 18740 International Blvd',
      v.daily_rate_cents,
      v.daily_rate_cents * 3,
      (v.daily_rate_cents * 3 * 0.109)::int,
      (v.daily_rate_cents * 3 * 1.109)::int,
      v.distance_included_mi, v.extra_mile_fee_cents,
      'non_refundable', 'captured', 'completed',
      now(), now()
    FROM vehicles v WHERE v.id = v_id;

    INSERT INTO reviews (
      trip_id, vehicle_id, reviewer_id, reviewee_id,
      rating_overall, rating_cleanliness, rating_accuracy, rating_value,
      body, kind, created_at
    )
    SELECT
      t_id, v_id,
      CASE (ROW_NUMBER() OVER (ORDER BY v.id))::int % 5
        WHEN 0 THEN r1 WHEN 1 THEN r2 WHEN 2 THEN r3 WHEN 3 THEN r4 ELSE r5 END,
      v.host_id,
      (ARRAY[4,5,5,5,5])[1 + (RANDOM() * 4)::int],
      (ARRAY[4,5,5,5])[1 + (RANDOM() * 3)::int],
      5, 5,
      (ARRAY[
        'Smooth pickup at the DoubleTree — car was clean and ready to go. Easy return too.',
        'Great car for the airport run. No rental counter hassle, just met the team and drove off.',
        'Exactly as described. Miles included were plenty, pricing was clear upfront with tax.',
        'Really straightforward process. Would rent again for Sea-Tac trips.',
        'Car was in great shape. Pickup and return were quick and painless.',
        'Super easy. The car was waiting for us when we landed. No surprises on the bill.',
        'Clean car, honest pricing. Way better than the airport counter experience.',
        'Drove this for a week. Comfortable, good on gas, and the team was responsive.',
        'Appreciated the upfront total — no surprise fees at the end. 5 stars.',
        'Perfect for our family trip to Rainier. Miles included were generous.'
      ])[1 + (RANDOM() * 9)::int],
      'guest_to_host',
      now() - interval '55 days' - (RANDOM() * 110 || ' days')::interval
    FROM vehicles v WHERE v.id = v_id;

  END LOOP;

  -- Update vehicle ratings/trip counts via direct recount (triggers may not fire in DO blocks)
  UPDATE vehicles v SET
    trip_count = (SELECT COUNT(*) FROM trips t WHERE t.vehicle_id = v.id AND t.status = 'completed'),
    rating_avg  = (SELECT ROUND(AVG(r.rating_overall)::numeric, 2) FROM reviews r WHERE r.vehicle_id = v.id AND r.kind = 'guest_to_host')
  WHERE v.status = 'listed';

END $$;
