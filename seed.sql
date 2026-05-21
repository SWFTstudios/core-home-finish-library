-- Dev seed data (optional). Run after schema:
-- npx wrangler d1 execute render-portal-db --local --file=./seed.sql

INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES
  ('dev-pd-001', 'pd@corehome.internal', 'PD Demo User', 'PD'),
  ('dev-id-001', 'id@corehome.internal', 'ID Demo User', 'ID');

INSERT OR IGNORE INTO finishes (id, name, category, description, hex_color) VALUES
  ('fin-matte-pink', 'Matte Pink', 'color', 'Soft matte body finish', '#E8A0BF'),
  ('fin-reflect-silver', 'Reflective Silver', 'material', 'Logo / accent metallic', '#C0C0C0'),
  ('fin-soft-touch-black', 'Soft-Touch Black', 'texture', 'Rubberized grip coating', '#1A1A1A'),
  ('fin-gloss-white', 'Gloss White', 'coating', 'High-gloss exterior', '#F5F5F5'),
  ('fin-brushed-steel', 'Brushed Steel', 'material', 'Stainless lid treatment', '#8A8D91');
