-- 1,000 demo reports: 125 in each of the 8 categories, inside Barangay Payatas.
-- Supabase → SQL Editor → paste this file → Run.
-- Safe to run again: it removes the previous demo rows first.
-- Real resident reports are left alone. Demo rows use receipt_id SPK-D0001 … SPK-D1000.

DELETE FROM reports WHERE receipt_id LIKE 'SPK-D%';

SELECT setseed(0.42);

INSERT INTO reports (
  receipt_id,
  reporter_hash,
  category,
  description,
  latitude,
  longitude,
  severity,
  status,
  verification_status,
  ai_category,
  admin_category,
  is_flagged,
  submitted_at,
  created_at,
  action_history
)
SELECT
  'SPK-D' || lpad(n::text, 4, '0'),
  md5('speakup-demo-' || n::text),
  category,
  description,
  round(lat::numeric, 6),
  round(lng::numeric, 6),
  severity,
  status,
  verification_status,
  category,
  CASE WHEN verification_status = 'valid' THEN category ELSE NULL END,
  verification_status = 'spam',
  created_at,
  created_at,
  jsonb_build_array(
    jsonb_build_object(
      'id', md5('speakup-demo-action-' || n::text),
      'status', status,
      'note', 'Demo report for the barangay dashboard.',
      'actor', 'Barangay staff',
      'created_at', created_at
    )
  )
FROM (
  SELECT
    n,
    category,
    description,
    CASE category
      WHEN 'drainage_flooding' THEN 14.7085 + (random() - 0.5) * 0.0009
      WHEN 'sanitation_health' THEN 14.7080 + (random() - 0.5) * 0.0009
      WHEN 'safety_concern' THEN 14.7060 + (random() - 0.5) * 0.0009
      WHEN 'infrastructure' THEN 14.7020 + (random() - 0.5) * 0.0010
      WHEN 'environmental' THEN 14.6970 + (random() - 0.5) * 0.0011
      WHEN 'noise_nuisance' THEN 14.6995 + (random() - 0.5) * 0.0014
      WHEN 'fire_hazard' THEN 14.7135 + (random() - 0.5) * 0.0010
      ELSE 14.7055 + (random() - 0.5) * 0.014
    END AS lat,
    CASE category
      WHEN 'drainage_flooding' THEN 121.1070 + (random() - 0.5) * 0.0009
      WHEN 'sanitation_health' THEN 121.0960 + (random() - 0.5) * 0.0009
      WHEN 'safety_concern' THEN 121.1020 + (random() - 0.5) * 0.0009
      WHEN 'infrastructure' THEN 121.1050 + (random() - 0.5) * 0.0010
      WHEN 'environmental' THEN 121.0940 + (random() - 0.5) * 0.0011
      WHEN 'noise_nuisance' THEN 121.0965 + (random() - 0.5) * 0.0014
      WHEN 'fire_hazard' THEN 121.1065 + (random() - 0.5) * 0.0010
      ELSE 121.0990 + (random() - 0.5) * 0.014
    END AS lng,
    CASE
      WHEN category IN ('drainage_flooding', 'fire_hazard') THEN 3 + floor(random() * 3)::int
      ELSE 1 + floor(random() * 4)::int
    END AS severity,
    CASE
      WHEN n % 20 IN (0, 1) THEN 'pending'
      WHEN n % 10 IN (0, 1) THEN 'pending'
      WHEN n % 10 IN (2, 3) THEN 'verified'
      WHEN n % 10 IN (4, 5) THEN 'in_progress'
      ELSE 'resolved'
    END AS status,
    CASE
      WHEN n % 20 = 0 THEN 'spam'
      WHEN n % 20 = 1 THEN 'duplicate'
      WHEN n % 20 IN (2, 3) THEN 'unreviewed'
      ELSE 'valid'
    END AS verification_status,
    CASE
      WHEN slot <= 19 THEN now() - (random() * interval '20 hours')
      WHEN slot <= 100 THEN now() - (random() * interval '28 days')
      ELSE now() - (interval '31 days' + random() * interval '80 days')
    END AS created_at
  FROM (
    SELECT
      n,
      ((n - 1) % 125) + 1 AS slot,
      category,
      CASE category
        WHEN 'drainage_flooding' THEN (ARRAY[
          'Clogged canal along Lupang Pangako. Water does not drain after rain.',
          'Knee-deep flood on the alley after a short downpour. Manhole is covered.',
          'Drainage beside the pathway is overflowing into the houses.'
        ])[1 + (n % 3)]
        WHEN 'sanitation_health' THEN (ARRAY[
          'Uncollected garbage piled at the corner for several days.',
          'Open pile of waste near the walkway, with a strong smell.',
          'Stagnant water and trash beside the homes in Payatas A.'
        ])[1 + (n % 3)]
        WHEN 'safety_concern' THEN (ARRAY[
          'Broken streetlight. The alley is dark after 7pm.',
          'Loose electrical wire hanging low across the footpath.',
          'Residents report an unlit stretch where people no longer feel safe walking.'
        ])[1 + (n % 3)]
        WHEN 'infrastructure' THEN (ARRAY[
          'Deep pothole in the middle of the road. Tricycles keep avoiding it.',
          'Cracked concrete path. The edge has started to collapse.',
          'Damaged footbridge railing near Phase 4.'
        ])[1 + (n % 3)]
        WHEN 'environmental' THEN (ARRAY[
          'Smoke and smell from burned trash in the open lot.',
          'Creek bank is littered and the water looks dark.',
          'Open burning of plastic beside the houses in Group 2.'
        ])[1 + (n % 3)]
        WHEN 'noise_nuisance' THEN (ARRAY[
          'Loud videoke past midnight on a weekday.',
          'Repeated loud music from a nearby house, still going after 1am.',
          'Noise from a gathering that kept the block awake.'
        ])[1 + (n % 3)]
        WHEN 'fire_hazard' THEN (ARRAY[
          'Stacked scrap and dry material too close to the houses.',
          'Residents smelled burning plastic near the upper road.',
          'Exposed wiring next to stored cardboard and wood.'
        ])[1 + (n % 3)]
        ELSE (ARRAY[
          'General concern reported by a resident. Needs a staff visit.',
          'Follow-up on an earlier barangay concern in the area.',
          'Resident asked the barangay to check this spot.'
        ])[1 + (n % 3)]
      END AS description
    FROM (
      SELECT
        n,
        CASE
          WHEN n <= 125 THEN 'drainage_flooding'
          WHEN n <= 250 THEN 'sanitation_health'
          WHEN n <= 375 THEN 'safety_concern'
          WHEN n <= 500 THEN 'infrastructure'
          WHEN n <= 625 THEN 'environmental'
          WHEN n <= 750 THEN 'noise_nuisance'
          WHEN n <= 875 THEN 'fire_hazard'
          ELSE 'other'
        END AS category
      FROM generate_series(1, 1000) AS g(n)
    ) AS numbered
  ) AS drafted
) AS rows;
