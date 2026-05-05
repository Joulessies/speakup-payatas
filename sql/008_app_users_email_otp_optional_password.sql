-- Allow email-only accounts verified via Supabase Auth Email OTP (password_hash nullable).
-- Run in Supabase SQL Editor after 005_app_users.sql.

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_has_password;

COMMENT ON COLUMN app_users.password_hash IS 'NULL when the user signs in only via Supabase email OTP (no password set).';
