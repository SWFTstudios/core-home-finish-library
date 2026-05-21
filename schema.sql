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

CREATE TABLE IF NOT EXISTS finishes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT,
  description   TEXT,
  hex_color     TEXT,
  image_url     TEXT,
  figma_node_id TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
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
