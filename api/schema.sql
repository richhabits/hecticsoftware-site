CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', name TEXT, email TEXT, company TEXT, phone TEXT,
  project_type TEXT, platforms TEXT, features TEXT, budget TEXT, timeline TEXT, description TEXT, links TEXT,
  quote TEXT, admin_notes TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT, size INTEGER, uploaded_by TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
-- Studio console: pipeline history and the opportunity finder.
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, kind TEXT NOT NULL, body TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_ref ON activity(ref_type, ref_id);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY, business TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL, stage TEXT, title TEXT NOT NULL, buyer TEXT, url TEXT,
  summary TEXT, value_low INTEGER, value_high INTEGER, deadline INTEGER, published INTEGER, region TEXT, score INTEGER NOT NULL, why TEXT,
  status TEXT NOT NULL DEFAULT 'new', notes TEXT, pitch TEXT, found_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_rank ON opportunities(status, score);
-- Live feed: every GitHub push (signed webhook). Commit text stays private to the studio.
CREATE TABLE IF NOT EXISTS pushes (
  id TEXT PRIMARY KEY, repo TEXT NOT NULL, product TEXT, branch TEXT, commits INTEGER, message TEXT, private INTEGER, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pushes_at ON pushes(at);
