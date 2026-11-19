-- Email sign-in (codes + sessions) and profile / onboarding fields.
-- Run: npm run db:migrate:auth (remote) or npm run db:migrate:auth:local

ALTER TABLE profiles ADD COLUMN department TEXT;
ALTER TABLE profiles ADD COLUMN job_title TEXT;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TEXT;
ALTER TABLE profiles ADD COLUMN last_sign_in_at TEXT;
ALTER TABLE profiles ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS auth_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes (email, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions (profile_id);
