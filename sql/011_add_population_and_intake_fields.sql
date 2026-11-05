-- Dropping and re-adding in one statement means the category rule is never missing, even if the run stops midway.
ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_category_check,
  ADD CONSTRAINT reports_category_check CHECK (
    category IN (
      'safety_concern',
      'threats_harassment',
      'fire_hazard',
      'medical_health',
      'road_traffic',
      'road_accidents',
      'noise_nuisance',
      'electrical_concerns',
      'animal_concerns',
      'family_domestic',
      'substance_concerns',
      'social_welfare',
      'legal_mediation',
      'infrastructure',
      'drainage_flooding',
      'clearance_concerns',
      'service_assistance',
      'environmental',
      'garbage_concerns',
      'sanitation_health',
      'inquiries',
      'other'
    )
  );

CREATE TABLE IF NOT EXISTS report_intake_details (
  report_id           UUID PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  source              TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'facebook_page', 'text_messages', 'phone_call', 'walk_ins', 'referral')),
  nature_of_concern   TEXT CHECK (nature_of_concern IN ('complaint', 'report', 'inquiry')),
  area                TEXT CHECK (area IN ('area_a', 'area_b', 'lupang_pangako', 'group_13', 'others')),
  concern_department  TEXT,
  location_known      BOOLEAN NOT NULL DEFAULT TRUE,
  reporter_name       TEXT,
  reporter_contact    TEXT,
  reporter_address    TEXT,
  reporter_age        SMALLINT CHECK (reporter_age BETWEEN 1 AND 120),
  reporter_gender     TEXT CHECK (reporter_gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  responders          TEXT,
  remarks             TEXT,
  encoded_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_intake_details_source ON report_intake_details (source);
CREATE INDEX IF NOT EXISTS idx_report_intake_details_location_unknown
  ON report_intake_details (report_id) WHERE location_known = FALSE;

ALTER TABLE report_intake_details ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE report_intake_details IS
  'Private per-report intake source, complainant details, and reporter age/gender. Service role only.';

-- Makes the Supabase API see the new table right away instead of answering "not found in the schema cache".
NOTIFY pgrst, 'reload schema';
