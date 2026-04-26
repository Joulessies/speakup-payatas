-- ============================================================
-- Module 1b: Geofence Function for Payatas, Quezon City
-- Checks if a point falls within the Payatas boundary
-- ============================================================

CREATE OR REPLACE FUNCTION is_within_payatas(
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  payatas_boundary GEOMETRY;
  test_point       GEOMETRY;
BEGIN
  -- Approximate boundary polygon of Payatas, Quezon City
  -- GeoJSON coordinates: [longitude, latitude]
  payatas_boundary := ST_SetSRID(
    ST_GeomFromGeoJSON('{
      "type": "Polygon",
      "coordinates": [[
        [121.0850, 14.6950],
        [121.0870, 14.6920],
        [121.0930, 14.6905],
        [121.1000, 14.6910],
        [121.1060, 14.6935],
        [121.1110, 14.6980],
        [121.1135, 14.7040],
        [121.1130, 14.7100],
        [121.1110, 14.7150],
        [121.1070, 14.7185],
        [121.1010, 14.7200],
        [121.0950, 14.7195],
        [121.0900, 14.7170],
        [121.0865, 14.7120],
        [121.0845, 14.7060],
        [121.0840, 14.7000],
        [121.0850, 14.6950]
      ]]
    }'),
    4326
  );

  test_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326);

  -- 200m buffer around the boundary to account for GPS drift
  RETURN ST_DWithin(
    test_point::GEOGRAPHY,
    payatas_boundary::GEOGRAPHY,
    200
  );
END;
$$;
