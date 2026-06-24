-- Finish PNG asset layer (separate from catalog metadata)
-- Run: npm run db:migrate:assets (remote) or db:migrate:assets:local

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finish_asset_variants (
  id              TEXT PRIMARY KEY,
  material_slug   TEXT NOT NULL,
  variant_slug    TEXT NOT NULL,
  label           TEXT NOT NULL,
  category_folder TEXT,
  asset_kind      TEXT NOT NULL
    CHECK(asset_kind IN ('base_finish', 'graphic_combo')),
  source_filename TEXT,
  UNIQUE (material_slug, variant_slug, asset_kind)
);

CREATE TABLE IF NOT EXISTS finish_asset_files (
  id           TEXT PRIMARY KEY,
  variant_id   TEXT NOT NULL REFERENCES finish_asset_variants(id),
  role         TEXT NOT NULL DEFAULT 'swatch'
    CHECK(role IN ('swatch', 'preview_front', 'preview_back', 'combo')),
  public_path  TEXT NOT NULL,
  sha256       TEXT,
  width        INTEGER,
  height       INTEGER,
  version      INTEGER DEFAULT 1,
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (variant_id, role, version)
);

CREATE TABLE IF NOT EXISTS finish_asset_links (
  finish_id    TEXT NOT NULL REFERENCES finishes(id) ON DELETE RESTRICT,
  variant_id   TEXT NOT NULL REFERENCES finish_asset_variants(id) ON DELETE RESTRICT,
  graphic_id   TEXT NOT NULL DEFAULT '',
  priority     INTEGER DEFAULT 0,
  PRIMARY KEY (finish_id, variant_id, graphic_id)
);

CREATE INDEX IF NOT EXISTS idx_finish_asset_links_finish
  ON finish_asset_links (finish_id, priority);

CREATE INDEX IF NOT EXISTS idx_finish_asset_files_variant_active
  ON finish_asset_files (variant_id, is_active, role);
