CREATE TABLE achievement_definitions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  tier TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TEXT,
  progress_value INTEGER NOT NULL DEFAULT 0,
  progress_target INTEGER,
  last_evaluated_at TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, achievement_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_key) REFERENCES achievement_definitions(key) ON DELETE CASCADE
);

CREATE INDEX idx_user_achievements_user_unlocked
  ON user_achievements(user_id, unlocked_at DESC, achievement_key);

CREATE INDEX idx_user_achievements_user_progress
  ON user_achievements(user_id, achievement_key, progress_value DESC);
