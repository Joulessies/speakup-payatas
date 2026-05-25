-- Alter app_users to add suspension columns
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS suspension_offense INTEGER DEFAULT 0;

COMMENT ON COLUMN app_users.suspended_until IS 'The timestamp until which the user account remains suspended. NULL if active.';
COMMENT ON COLUMN app_users.suspension_offense IS 'The count of offenses (1st, 2nd, 3rd permanent).';
