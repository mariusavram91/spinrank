CREATE TABLE achievement_jobs (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TEXT,
  last_error TEXT
);

CREATE INDEX idx_achievement_jobs_created_at
  ON achievement_jobs(created_at, id);
