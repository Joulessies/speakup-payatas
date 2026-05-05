-- ============================================================
-- Module 1d: Full backend persistence upgrade
-- Makes all API routes use real Supabase storage
-- ============================================================

-- Ensure reports supports current app categories and workflow fields.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE reports
ADD CONSTRAINT reports_category_check CHECK (
  category IN (
    'drainage_flooding',
    'fire_hazard',
    'safety_concern',
    'infrastructure',
    'sanitation_health',
    'noise_nuisance',
    'environmental',
    'other'
  )
);

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports
ADD CONSTRAINT reports_status_check CHECK (
  status IN ('pending', 'verified', 'in_progress', 'resolved')
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS receipt_id TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unreviewed';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_category VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_category VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS action_history JSONB DEFAULT '[]'::jsonb;

-- Confirmation/upvote persistence
CREATE TABLE IF NOT EXISTS report_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  reporter_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_id, reporter_hash)
);

CREATE INDEX IF NOT EXISTS idx_report_confirmations_report_id ON report_confirmations(report_id);

ALTER TABLE report_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read confirmations" ON report_confirmations;
CREATE POLICY "Allow read confirmations" ON report_confirmations
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert confirmations" ON report_confirmations;
CREATE POLICY "Allow insert confirmations" ON report_confirmations
  FOR INSERT WITH CHECK (true);
