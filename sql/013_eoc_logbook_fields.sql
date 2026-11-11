-- Barangay logbook fields from the Payatas Speak Up sheet: EOC staff and the four statuses.
-- Supabase → SQL Editor → paste → Run.

ALTER TABLE report_intake_details
  ADD COLUMN IF NOT EXISTS eoc_staff TEXT,
  ADD COLUMN IF NOT EXISTS eoc_status TEXT;

ALTER TABLE report_intake_details
  DROP CONSTRAINT IF EXISTS report_intake_details_eoc_status_check;

ALTER TABLE report_intake_details
  ADD CONSTRAINT report_intake_details_eoc_status_check
  CHECK (
    eoc_status IS NULL
    OR eoc_status IN ('pending', 'transferred', 'pending_with_mission_order', 'responded')
  );

NOTIFY pgrst, 'reload schema';
