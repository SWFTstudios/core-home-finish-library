-- Render Portal — D1 schema (SQLite)
-- Run: npm run db:migrate (remote) or npm run db:migrate:local

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT,
  team       TEXT CHECK(team IN ('PD','ID','GD','Admin')),
  created_at TEXT DEFAULT (datetime('now'))
);

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
  id                       TEXT PRIMARY KEY,
  title                    TEXT NOT NULL,
  product_type             TEXT,
  requested_by             TEXT REFERENCES profiles(id),
  status                   TEXT DEFAULT 'Draft'
                           CHECK(status IN ('Draft','Submitted','In Progress','Delivered','Revision Requested')),
  notes                    TEXT,
  deadline                 TEXT,
  material_slug            TEXT,
  graphic_application_id   TEXT REFERENCES graphic_application_types(id),
  source                   TEXT CHECK(source IN ('configurator', 'request_form')),
  spec_snapshot            TEXT,
  created_at               TEXT DEFAULT (datetime('now')),
  updated_at               TEXT DEFAULT (datetime('now'))
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

CREATE TABLE IF NOT EXISTS saved_folders (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  name       TEXT NOT NULL DEFAULT 'My folder',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_folder_items (
  id                     TEXT PRIMARY KEY,
  folder_id              TEXT NOT NULL REFERENCES saved_folders(id) ON DELETE CASCADE,
  material_slug          TEXT NOT NULL,
  finish_id              TEXT NOT NULL REFERENCES finishes(id),
  graphic_application_id TEXT,
  spec_snapshot          TEXT NOT NULL,
  notes                  TEXT,
  selected_for_review    INTEGER DEFAULT 1,
  sort_order             INTEGER DEFAULT 0,
  created_at             TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saved_folders_profile
  ON saved_folders (profile_id);

CREATE INDEX IF NOT EXISTS idx_saved_folder_items_folder
  ON saved_folder_items (folder_id, sort_order, created_at);
