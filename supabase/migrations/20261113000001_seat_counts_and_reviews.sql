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
      s.starts_at,
      s.starts_at + interval '3 days',
      'DoubleTree by Hilton SeaTac, 18740 International Blvd',
      v.daily_rate_cents,
      v.daily_rate_cents * 3,
      (v.daily_rate_cents * 3 * 0.109)::int,
      (v.daily_rate_cents * 3 * 1.109)::int,
      v.distance_included_mi, v.extra_mile_fee_cents,
      'non_refundable', 'captured', 'completed',
      now(), now()
    FROM vehicles v
    CROSS JOIN LATERAL (
      SELECT now() - interval '60 days' - (RANDOM() * 120 || ' days')::interval AS starts_at
    ) s
    WHERE v.id = v_id;

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
        'Met us right at the DoubleTree exit with the car ready to go — keys in hand, no paperwork, no waiting in line. Car was clean inside and out and drove great the whole week. Best airport rental experience I''ve had, and I travel for work every month.',
        'Flying in for a conference and needed something reliable for 4 days. The team texted me the car''s location before I even got my luggage off the belt. No rental counter, no shuttle bus, no upsells at the desk. Just exactly what I booked at the price I saw.',
        'We did a road trip up to Vancouver and back — about 500 miles total. Miles included covered most of it and the per-mile overage was clearly priced upfront so there were zero surprises on the final bill. Car was comfortable for 3 adults with luggage.',
        'Third time renting from Cascade and the process gets faster every time. Text when you land, they meet you at the DoubleTree with the car. This trip it was literally a 2-minute handoff. Way better than waiting 45 minutes at the airport counter.',
        'Picked this up after a red-eye from the East Coast and the team was already there when I arrived. Car had a full tank and I was on the road in under 10 minutes. Return was just as quick — maybe 5 minutes tops. Really appreciate the no-counter model.',
        'Rented for a family trip to Mount Rainier — 5 adults plus a full trunk of gear. Miles included were generous enough that we never watched the odometer the whole trip. The total at checkout was exactly what I paid, tax already included. No surprise fees at pickup.',
        'Solo work trip, 5 days in Seattle. Booking was simple, the car was clean and in good shape. Only minor thing: communication is all over text which works fine, but an app would make it even smoother. The pickup logistics are genuinely the best part of the whole experience.',
        'Car was exactly as listed — no surprises on condition or odometer. The team clearly knows the Sea-Tac area well and they''re easy to reach by phone if you have questions. Much better value than the big-name companies inside the terminal, and faster too.',
        'Traveled with my partner for a week. The booking total was the amount charged — no resort fees, no hidden young driver charges, nothing extra. Car had a small scuff on the rear bumper (we noted it together at pickup) but ran perfectly. Return took 5 minutes.',
        'Used Cascade for a 3-day trip out to the Olympic Peninsula. Highway miles, some mountain pass roads — the car handled all of it fine. Good fuel economy for the distance. Pickup and drop-off were the fastest I''ve ever done at Sea-Tac. Would book again without hesitation.'
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
