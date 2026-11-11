-- 2,750 demo reports: 125 in each of the 22 map classifications, inside Barangay Payatas.
-- Supabase → SQL Editor → paste this file → Run.
-- Safe to run again: it removes the previous demo rows first.
-- Real resident reports are left alone. Demo rows use receipt_id SPK-D0001 … SPK-D2750.

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
  round((base_lat + (random() - 0.5) * 0.0008)::numeric, 6),
  round((base_lng + (random() - 0.5) * 0.0008)::numeric, 6),
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
    base_lat,
    base_lng,
    CASE
      WHEN category IN ('drainage_flooding', 'fire_hazard', 'safety_concern') THEN 3 + floor(random() * 3)::int
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
      g.n,
      ((g.n - 1) % 125) + 1 AS slot,
      places.category,
      places.base_lat,
      places.base_lng,
      (ARRAY[places.line_a, places.line_b, places.line_c])[1 + (g.n % 3)] AS description
    FROM generate_series(1, 2750) AS g(n)
    JOIN (
      SELECT
        row_number() OVER () - 1 AS ord,
        category,
        14.6960 + ((row_number() OVER () - 1) / 5) * 0.0045 AS base_lat,
        121.0880 + ((row_number() OVER () - 1) % 5) * 0.0050 AS base_lng,
        line_a,
        line_b,
        line_c
      FROM (
        VALUES
          ('safety_concern', 'Broken streetlight. The alley is dark after 7pm.', 'Residents report an unlit stretch where people no longer feel safe walking.', 'A fight was reported on the pathway and the block asked for a visit.'),
          ('threats_harassment', 'A resident reported repeated threats from a neighbor.', 'Harassment was reported along the walkway.', 'Someone is intimidating residents near the corner.'),
          ('fire_hazard', 'Stacked scrap and dry material too close to the houses.', 'Residents smelled burning plastic near the road.', 'Exposed wiring next to stored cardboard and wood.'),
          ('medical_health', 'A household asked for health assistance.', 'Residents reported a sick neighbor who needs a barangay check.', 'Medicine assistance was requested for an elderly resident.'),
          ('road_traffic', 'Vehicles are blocking the alley during the day.', 'Tricycles cannot pass because the road is obstructed.', 'Traffic builds up at the corner every afternoon.'),
          ('road_accidents', 'A motorcycle slipped at this corner.', 'Residents marked this spot as accident-prone.', 'A tricycle and a pedestrian nearly collided here.'),
          ('noise_nuisance', 'Loud videoke past midnight on a weekday.', 'Repeated loud music from a nearby house, still going after 1am.', 'Noise from a gathering kept the block awake.'),
          ('electrical_concerns', 'A wire is hanging low across the footpath.', 'The post is sparking when it rains.', 'Residents reported an illegal connection on the pole.'),
          ('animal_concerns', 'A stray dog bit a passerby near the pathway.', 'Dead animal reported beside the walkway.', 'Aggressive dogs are blocking the alley.'),
          ('family_domestic', 'A family dispute was reported and needs a discreet visit.', 'Neighbors heard a domestic incident and asked the barangay to check.', 'A household asked for help with a family conflict.'),
          ('substance_concerns', 'Residents reported suspected drug activity at this spot.', 'People are gathering here for substance use.', 'The block asked for a check on substance-related activity.'),
          ('social_welfare', 'An elderly resident asked for social welfare assistance.', 'A family requested help from the barangay social services.', 'Assistance was requested for a resident who cannot leave the house.'),
          ('legal_mediation', 'Neighbors asked the Lupon to mediate a boundary dispute.', 'A resident requested barangay mediation for an unpaid agreement.', 'Two households want a hearing for a long-running dispute.'),
          ('infrastructure', 'Deep pothole in the middle of the road. Tricycles keep avoiding it.', 'Cracked concrete path. The edge has started to collapse.', 'Damaged footbridge railing near the pathway.'),
          ('clearance_concerns', 'A resident asked about a barangay clearance.', 'Follow-up on a certificate request.', 'The household needs a document from the clearance desk.'),
          ('service_assistance', 'Residents requested barangay equipment for a cleanup.', 'A household asked for assistance moving debris after the rain.', 'The block requested a service visit from the barangay.'),
          ('environmental', 'Smoke and smell from burned trash in the open lot.', 'Creek bank is littered and the water looks dark.', 'Open burning of plastic beside the houses.'),
          ('inquiries', 'A resident asked about the barangay office schedule.', 'Question about where to follow up a concern.', 'Inquiry on which desk handles this type of request.'),
          ('garbage_concerns', 'Uncollected garbage piled at the corner for several days.', 'Missed collection left waste on the pathway.', 'A large pile of trash is blocking the alley.'),
          ('drainage_flooding', 'Clogged canal. Water does not drain after rain.', 'Knee-deep flood on the alley after a short downpour.', 'Drainage beside the pathway is overflowing into the houses.'),
          ('sanitation_health', 'Stagnant water and trash beside the homes.', 'Open pile of waste near the walkway, with a strong smell.', 'Residents reported mosquitoes breeding in standing water.'),
          ('other', 'General concern reported by a resident. Needs a staff visit.', 'Follow-up on an earlier barangay concern in the area.', 'Resident asked the barangay to check this spot.')
      ) AS lines(category, line_a, line_b, line_c)
    ) AS places ON places.ord = ((g.n - 1) / 125)
  ) AS drafted
) AS rows;
