-- Per-request access by department, plus each preparer's saved defaults, plus comments.
-- Run: npm run db:migrate:access (remote) or npm run db:migrate:access:local
-- level is 'view' | 'comment' | 'edit'; a department with no row has no access.
-- The preparer (render_requests.requested_by) and Admins always have full access.

-- Set once a preparer has saved their defaults (even "nobody"), so an empty list is not "never saved".
ALTER TABLE profiles ADD COLUMN request_access_set_at TEXT;

CREATE TABLE IF NOT EXISTS profile_request_access_defaults (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  level      TEXT NOT NULL CHECK(level IN ('view','comment','edit')),
  PRIMARY KEY (profile_id, department)
);

CREATE TABLE IF NOT EXISTS request_access (
  request_id TEXT NOT NULL REFERENCES render_requests(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  level      TEXT NOT NULL CHECK(level IN ('view','comment','edit')),
  PRIMARY KEY (request_id, department)
);
CREATE INDEX IF NOT EXISTS idx_request_access_dept ON request_access (department);

CREATE TABLE IF NOT EXISTS request_comments (
  id         TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES render_requests(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES profiles(id),
  body       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_request_comments_request ON request_comments (request_id, created_at);

-- Requests made before this migration keep working for the teams that render them.
INSERT OR IGNORE INTO request_access (request_id, department, level)
  SELECT id, 'Industrial Design', 'edit' FROM render_requests;
INSERT OR IGNORE INTO request_access (request_id, department, level)
  SELECT id, 'Visualization', 'edit' FROM render_requests;
