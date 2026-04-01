CREATE TABLE season_participants (
  season_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (season_id, user_id),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tournament_participants (
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (tournament_id, user_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE match_players (
  match_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  team TEXT NOT NULL,
  PRIMARY KEY (match_id, user_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tournament_bracket_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  round_title TEXT NOT NULL,
  match_index INTEGER NOT NULL,
  left_player_id TEXT,
  right_player_id TEXT,
  created_match_id TEXT,
  winner_player_id TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  is_final INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (created_match_id) REFERENCES matches(id) ON DELETE SET NULL
);

CREATE TABLE request_dedup (
  action TEXT NOT NULL,
  request_id TEXT NOT NULL,
  target_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (action, request_id)
);
