PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  global_elo INTEGER NOT NULL DEFAULT 1200,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  base_elo_mode TEXT NOT NULL DEFAULT 'carry_over',
  participant_ids_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  season_id TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE tournament_plans (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL UNIQUE,
  participant_ids_json TEXT NOT NULL,
  bracket_json TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  match_type TEXT NOT NULL,
  format_type TEXT NOT NULL,
  points_to_win INTEGER NOT NULL,
  team_a_player_ids_json TEXT NOT NULL,
  team_b_player_ids_json TEXT NOT NULL,
  score_json TEXT NOT NULL,
  winner_team TEXT NOT NULL,
  global_elo_delta_json TEXT NOT NULL DEFAULT '{}',
  segment_elo_delta_json TEXT NOT NULL DEFAULT '{}',
  played_at TEXT NOT NULL,
  season_id TEXT,
  tournament_id TEXT,
  created_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  deactivated_at TEXT,
  deactivated_by_user_id TEXT,
  deactivation_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (deactivated_by_user_id) REFERENCES users(id)
);

CREATE TABLE elo_segments (
  id TEXT PRIMARY KEY,
  segment_type TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1200,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(segment_type, segment_id, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  target_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
