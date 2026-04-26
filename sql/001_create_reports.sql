-- ============================================================
-- Module 1: Database Schema for SpeakUp Payatas
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_hash TEXT        NOT NULL,
  category    TEXT          NOT NULL
    CHECK (category IN ('flooding','fire','crime','infrastructure','health','environmental','other')),
  description TEXT,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  location    GEOGRAPHY(POINT, 4326),
  severity    INTEGER       DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  status      TEXT          DEFAULT 'pending'
    CHECK (status IN ('pending','verified','resolved')),
  photo_url   TEXT,
  created_at  TIMESTAMPTZ   DEFAULT now(),
  synced_at   TIMESTAMPTZ
);

-- Auto-populate the geography column from lat/lng on insert or update
CREATE OR REPLACE FUNCTION set_report_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::GEOGRAPHY;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_location
  BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION set_report_location();

-- Spatial index for fast geo-queries in high-density Payatas
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);

-- Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (via anon key)
CREATE POLICY "Allow anonymous inserts"
  ON reports FOR INSERT
  WITH CHECK (true);

-- Allow public reads for verified/pending reports
CREATE POLICY "Allow public reads"
  ON reports FOR SELECT
  USING (true);
