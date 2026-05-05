-- Default admin & staff rows for app_users (run after 005_app_users.sql).
-- Sign-in emails: admin@speakup.local / staff@speakup.local
-- Default passwords (change in production): admin123 / staff123
-- Hashes match lib/password.ts (scrypt). Skips insert if email already exists.
-- The login API still upserts these from ADMIN_* / STAFF_* env on each auth request.

INSERT INTO app_users (email, password_hash, role)
SELECT 'admin@speakup.local', $pwd$scrypt$DiMPL9Bdo+lsriJcuDPNrA==$C3Dxm2oZF1+dHY4d+65U1TB/nmAZuFWResNut9IA6D7oMCftDpUfx2gi808D/CQP4j5NZrJysztSvIKxRDhFbg==$pwd$, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@speakup.local');

INSERT INTO app_users (email, password_hash, role)
SELECT 'staff@speakup.local', $pwd$scrypt$2lJ9pGCB8O6FXIQ0HHOL1g==$n2z+52wBkxkkwHsWv1j3WJtx+O3A485y5ZNFJYKTE6s9rTCXgu9TlOEgvxYv1/kupUvNZTyEeWVuumiuq5KnYQ==$pwd$, 'staff'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'staff@speakup.local');
