-- User folders: save configurator selections for review before render requests

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
