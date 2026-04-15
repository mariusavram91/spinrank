ALTER TABLE matches ADD COLUMN matchup_key TEXT NOT NULL DEFAULT '';
ALTER TABLE matches ADD COLUMN delete_locked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE matches ADD COLUMN has_active_dispute INTEGER NOT NULL DEFAULT 0;

UPDATE matches
SET matchup_key = CASE
    WHEN matchup_key = '' THEN team_a_player_ids_json || '::' || team_b_player_ids_json
    ELSE matchup_key
  END,
  delete_locked_at = CASE
    WHEN delete_locked_at = '' THEN strftime('%Y-%m-%dT%H:%M:%fZ', datetime(created_at, '+45 minutes'))
    ELSE delete_locked_at
  END;

CREATE TABLE match_disputes (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  UNIQUE(match_id, created_by_user_id)
);

CREATE INDEX idx_matches_matchup_window
  ON matches(status, matchup_key, played_at DESC, id DESC);

CREATE INDEX idx_matches_creator_disputes
  ON matches(created_by_user_id, has_active_dispute, status, created_at DESC, id DESC);

CREATE INDEX idx_match_disputes_match_status
  ON match_disputes(match_id, status, updated_at DESC);

CREATE INDEX idx_match_disputes_creator_status
  ON match_disputes(created_by_user_id, status, updated_at DESC);
