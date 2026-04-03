ALTER TABLE elo_segments ADD COLUMN matches_played_equivalent REAL NOT NULL DEFAULT 0;
ALTER TABLE elo_segments ADD COLUMN last_match_at TEXT NOT NULL DEFAULT '';
