-- Example: seed or promote Core Home teammates in remote D1.
-- Copy to a private file (do not commit real emails if the repo is public), then:
--   npx wrangler d1 execute render-portal-db --remote --file=./scripts/seed-team-profiles.sql
--
-- Profiles are also created automatically on first successful @corehome.com sign-in.
-- Use this only to pre-assign team roles (PD / ID / GD / Admin).

INSERT OR IGNORE INTO profiles (id, email, full_name, team) VALUES
  ('replace-uuid-1', 'name.pd@corehome.com', 'PD Name', 'PD'),
  ('replace-uuid-2', 'name.id@corehome.com', 'ID Name', 'ID'),
  ('replace-uuid-3', 'name.gd@corehome.com', 'GD Name', 'GD');

-- Promote an existing auto-created profile to Admin:
-- UPDATE profiles SET team = 'Admin' WHERE email = 'name@corehome.com';
