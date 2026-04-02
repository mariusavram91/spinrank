CREATE TABLE segment_share_links (
  id TEXT PRIMARY KEY,
  segment_type TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (consumed_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_segment_share_links_segment
  ON segment_share_links (segment_type, segment_id, created_by_user_id);
