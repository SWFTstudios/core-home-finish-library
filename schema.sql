-- Render Portal — D1 schema (SQLite)
-- Run: npm run db:migrate (remote) or npm run db:migrate:local

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT,
  team       TEXT CHECK(team IN ('PD','ID','GD','Admin')),
  created_at TEXT DEFAULT (datetime('now')),
  department TEXT,
  job_title  TEXT,
  onboarding_completed_at TEXT,
  last_sign_in_at TEXT,
  updated_at TEXT
);

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

CREATE TABLE IF NOT EXISTS material_types (
  id         TEXT PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  enabled    INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS graphic_application_types (
  id            TEXT PRIMARY KEY,
  template_key  TEXT NOT NULL,
  label         TEXT NOT NULL,
  ui_label      TEXT NOT NULL,
  material_slug TEXT,
  sort_order    INTEGER DEFAULT 0,
  UNIQUE (material_slug, template_key)
);

CREATE TABLE IF NOT EXISTS finishes (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL,
  material_slug    TEXT NOT NULL DEFAULT 'stainless_steel',
  name             TEXT NOT NULL,
  category         TEXT,
  description      TEXT,
  hex_color        TEXT,
  image_url        TEXT,
  figma_node_id    TEXT,
  durability_score INTEGER,
  durability_notes TEXT,
  price_band       TEXT,
  cost_tier        INTEGER,
  finish_process   TEXT,
  process_steps    INTEGER,
  extensions       TEXT,
  source_file      TEXT,
  template_id      TEXT DEFAULT 'finish_library_ak',
  created_at       TEXT DEFAULT (datetime('now')),
  UNIQUE (material_slug, slug)
);

CREATE TABLE IF NOT EXISTS finish_graphic_compat (
  finish_id   TEXT NOT NULL REFERENCES finishes(id) ON DELETE CASCADE,
  graphic_id  TEXT NOT NULL REFERENCES graphic_application_types(id) ON DELETE CASCADE,
  compatible  INTEGER DEFAULT 0,
  PRIMARY KEY (finish_id, graphic_id)
);

CREATE TABLE IF NOT EXISTS render_requests (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  product_type  TEXT,
  requested_by  TEXT REFERENCES profiles(id),
  status        TEXT DEFAULT 'Draft'
                CHECK(status IN ('Draft','Submitted','In Progress','Delivered','Revision Requested')),
  notes         TEXT,
  deadline      TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_finishes (
  id         TEXT PRIMARY KEY,
  request_id TEXT REFERENCES render_requests(id),
  finish_id  TEXT REFERENCES finishes(id),
  zone       TEXT,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS renders (
  id           TEXT PRIMARY KEY,
  request_id   TEXT REFERENCES render_requests(id),
  uploaded_by  TEXT REFERENCES profiles(id),
  file_url     TEXT,
  version      INTEGER DEFAULT 1,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
