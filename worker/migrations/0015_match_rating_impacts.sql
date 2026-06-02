CREATE TABLE match_rating_impacts (
  match_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  global_delta INTEGER NOT NULL,
  global_before INTEGER NOT NULL,
  global_after INTEGER NOT NULL,
  global_gap INTEGER NOT NULL,
  season_score_delta INTEGER,
  season_gap INTEGER,
  expected_win_probability REAL NOT NULL,
  effective_k_factor REAL NOT NULL,
  outcome TEXT NOT NULL,
  season_breakdown_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, user_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_match_rating_impacts_user_match
  ON match_rating_impacts(user_id, match_id);
