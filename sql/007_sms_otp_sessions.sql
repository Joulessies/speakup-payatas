-- Ephemeral SMS OTP codes for MessageBird / Semaphore flows — Next.js API uses service role only.
-- Run in Supabase SQL Editor after sql/005_app_users.sql

CREATE TABLE IF NOT EXISTS sms_otp_sessions (
  phone_last10   TEXT PRIMARY KEY CHECK (phone_last10 ~ '^[0-9]{10}$'),
  code           TEXT NOT NULL CHECK (char_length(code) = 6),
  expires_at     TIMESTAMPTZ NOT NULL,
  last_sent_at   TIMESTAMPTZ NOT NULL,
  attempts_left  SMALLINT NOT NULL DEFAULT 5 CHECK (attempts_left >= 0 AND attempts_left <= 10)
);

CREATE INDEX IF NOT EXISTS idx_sms_otp_expires ON sms_otp_sessions (expires_at);

ALTER TABLE sms_otp_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sms_otp_sessions IS 'SMS OTP pending verification; service role from Next.js only; rows deleted after success or lockout.';
