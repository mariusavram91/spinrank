CREATE INDEX idx_season_participants_season_user
  ON season_participants(season_id, user_id);

CREATE INDEX idx_tournament_participants_tournament_user
  ON tournament_participants(tournament_id, user_id);

CREATE INDEX idx_match_players_match_user
  ON match_players(match_id, user_id);
