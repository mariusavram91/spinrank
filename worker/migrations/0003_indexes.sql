CREATE INDEX idx_users_provider_lookup
  ON users(provider, provider_user_id);

CREATE INDEX idx_users_rank
  ON users(global_elo DESC, wins DESC, losses ASC, display_name ASC);

CREATE INDEX idx_seasons_active
  ON seasons(status, is_active DESC, start_date DESC, id DESC);

CREATE INDEX idx_season_participants_user
  ON season_participants(user_id, season_id);

CREATE INDEX idx_tournaments_season_date
  ON tournaments(status, season_id, date DESC, id DESC);

CREATE INDEX idx_tournament_participants_user
  ON tournament_participants(user_id, tournament_id);

CREATE INDEX idx_matches_feed
  ON matches(status, played_at DESC, created_at DESC, id DESC);

CREATE INDEX idx_matches_tournament_feed
  ON matches(tournament_id, status, played_at DESC, created_at DESC, id DESC);

CREATE INDEX idx_matches_season_feed
  ON matches(season_id, status, played_at DESC, created_at DESC, id DESC);

CREATE INDEX idx_match_players_user
  ON match_players(user_id, match_id);

CREATE INDEX idx_elo_segments_lookup
  ON elo_segments(segment_type, segment_id, elo DESC, wins DESC, losses ASC);

CREATE INDEX idx_tournament_bracket_created_match
  ON tournament_bracket_matches(created_match_id);

CREATE INDEX idx_request_dedup_created
  ON request_dedup(created_at DESC);
