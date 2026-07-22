-- Cost bands + factory verification (private euro, public band letter)
-- Safe to re-run on fresh D1; ALTER TABLE fails if columns already exist on SQLite.

ALTER TABLE finishes ADD COLUMN unit_price_adder REAL;
ALTER TABLE finishes ADD COLUMN cost_band TEXT;
ALTER TABLE finishes ADD COLUMN cost_index INTEGER;
ALTER TABLE finishes ADD COLUMN verified_status TEXT
  CHECK(verified_status IS NULL OR verified_status IN ('yes','no','needs_review'));
ALTER TABLE finishes ADD COLUMN factory_comments TEXT;

ALTER TABLE material_types ADD COLUMN reference_piece TEXT;
ALTER TABLE material_types ADD COLUMN reference_moq INTEGER;

CREATE TABLE IF NOT EXISTS cost_bands (
  material_slug TEXT NOT NULL,
  band          TEXT NOT NULL,
  from_eur      REAL NOT NULL,
  to_eur        REAL,
  sort_order    INTEGER DEFAULT 0,
  PRIMARY KEY (material_slug, band)
);

CREATE INDEX IF NOT EXISTS idx_cost_bands_material
  ON cost_bands (material_slug, sort_order);
