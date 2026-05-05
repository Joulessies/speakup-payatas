-- App users (email/password and SMS registration) — accessed only via service role from API routes.
-- Run in Supabase SQL Editor after earlier migrations.

CREATE TABLE IF NOT EXISTS app_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE,
  phone_e164      TEXT UNIQUE,
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'staff', 'user')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_or_phone CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL),
  CONSTRAINT app_users_email_has_password CHECK (email IS NULL OR password_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON app_users (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE OR REPLACE FUNCTION app_users_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION app_users_set_updated_at();

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot read/write; service role bypasses RLS.

COMMENT ON TABLE app_users IS 'SpeakUp app accounts; use service role from Next.js API only.';
-- Next: optional seed rows — run sql/006_seed_admin_staff.sql
