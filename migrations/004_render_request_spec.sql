-- Render request spec extensions (material, graphic, source, snapshot)
-- Run: wrangler d1 execute render-portal-db --local --file=./migrations/004_render_request_spec.sql

ALTER TABLE render_requests ADD COLUMN material_slug TEXT;
ALTER TABLE render_requests ADD COLUMN graphic_application_id TEXT REFERENCES graphic_application_types(id);
ALTER TABLE render_requests ADD COLUMN source TEXT CHECK(source IN ('configurator', 'request_form'));
ALTER TABLE render_requests ADD COLUMN spec_snapshot TEXT;
