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
