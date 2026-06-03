-- Multi-material catalog: material_slug on finishes and graphic types
-- Safe to re-run (skips if columns already exist)

ALTER TABLE finishes ADD COLUMN material_slug TEXT NOT NULL DEFAULT 'stainless_steel';
ALTER TABLE graphic_application_types ADD COLUMN material_slug TEXT;

UPDATE finishes SET material_slug = 'stainless_steel' WHERE material_slug IS NULL OR material_slug = '';
UPDATE graphic_application_types SET material_slug = 'stainless_steel' WHERE material_slug IS NULL OR material_slug = '';
