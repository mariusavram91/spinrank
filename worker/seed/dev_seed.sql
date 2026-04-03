PRAGMA foreign_keys = OFF;

DELETE FROM request_dedup;
DELETE FROM audit_log;
DELETE FROM match_players;
DELETE FROM tournament_bracket_matches;
DELETE FROM tournament_participants;
DELETE FROM season_participants;
DELETE FROM elo_segments;
DELETE FROM matches;
DELETE FROM tournament_plans;
DELETE FROM tournaments;
DELETE FROM seasons;
DELETE FROM users;

INSERT INTO users (
  id, provider, provider_user_id, email, display_name, avatar_url,
  global_elo, wins, losses, streak, created_at, updated_at
) VALUES
  ('user_alex', 'google', 'google-alex', 'alex@example.com', 'Alex Hart', 'https://example.com/alex.png', 1284, 9, 3, 4, '2026-01-10T09:00:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('user_bea', 'google', 'google-bea', 'bea@example.com', 'Bea Imani', 'https://example.com/bea.png', 1256, 8, 4, 2, '2026-01-10T09:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('user_cruz', 'google', 'google-cruz', 'cruz@example.com', 'Cruz Novak', 'https://example.com/cruz.png', 1232, 7, 5, 1, '2026-01-10T09:10:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('user_daya', 'google', 'google-daya', 'daya@example.com', 'Daya Chen', 'https://example.com/daya.png', 1214, 6, 6, -1, '2026-01-10T09:15:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('user_eli', 'google', 'google-eli', 'eli@example.com', 'Eli Stone', 'https://example.com/eli.png', 1198, 4, 8, -3, '2026-01-10T09:20:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('user_finn', 'google', 'google-finn', 'finn@example.com', 'Finn Vale', 'https://example.com/finn.png', 1170, 3, 9, -2, '2026-01-10T09:25:00.000Z', '2026-03-20T20:05:00.000Z');

INSERT INTO seasons (
  id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
  created_by_user_id, created_at, completed_at, is_public
) VALUES (
  'season_spring_2026',
  'Spring 2026 Ladder',
  '2026-03-01',
  '2026-05-31',
  1,
  'active',
  'carry_over',
  '["user_alex","user_bea","user_cruz","user_daya","user_eli","user_finn"]',
  'user_alex',
  '2026-02-25T08:00:00.000Z',
  NULL,
  1
);

INSERT INTO season_participants (season_id, user_id) VALUES
  ('season_spring_2026', 'user_alex'),
  ('season_spring_2026', 'user_bea'),
  ('season_spring_2026', 'user_cruz'),
  ('season_spring_2026', 'user_daya'),
  ('season_spring_2026', 'user_eli'),
  ('season_spring_2026', 'user_finn');

INSERT INTO tournaments (
  id, name, date, status, season_id, created_by_user_id, created_at, completed_at
) VALUES (
  'tournament_berlin_open_2026',
  'Berlin Open 2026',
  '2026-03-15',
  'active',
  'season_spring_2026',
  'user_alex',
  '2026-03-01T10:00:00.000Z',
  ''
);

INSERT INTO tournament_participants (tournament_id, user_id) VALUES
  ('tournament_berlin_open_2026', 'user_alex'),
  ('tournament_berlin_open_2026', 'user_bea'),
  ('tournament_berlin_open_2026', 'user_cruz'),
  ('tournament_berlin_open_2026', 'user_daya'),
  ('tournament_berlin_open_2026', 'user_eli'),
  ('tournament_berlin_open_2026', 'user_finn');

INSERT INTO tournament_plans (
  id, tournament_id, participant_ids_json, bracket_json, created_by_user_id, created_at, updated_at
) VALUES (
  'plan_berlin_open_2026',
  'tournament_berlin_open_2026',
  '["user_bea","user_eli","user_alex","user_finn"]',
  '[{"title":"Semifinals","matches":[{"id":"tbm_berlin_sf_1","leftPlayerId":"user_bea","rightPlayerId":"user_eli","createdMatchId":"match_006","winnerPlayerId":"user_bea","locked":1,"isFinal":false},{"id":"tbm_berlin_sf_2","leftPlayerId":"user_alex","rightPlayerId":"user_finn","createdMatchId":"match_005","winnerPlayerId":"user_alex","locked":1,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_berlin_final","leftPlayerId":"user_bea","rightPlayerId":"user_alex","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":true}]}]',
  'user_alex',
  '2026-03-01T10:00:00.000Z',
  '2026-03-15T17:35:00.000Z'
);

INSERT INTO matches (
  id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
  score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
  tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
  deactivation_reason, created_at
) VALUES
  ('match_011', 'singles', 'best_of_3', 11, '["user_alex"]', '["user_cruz"]', '[{"teamA":11,"teamB":8},{"teamA":9,"teamB":11},{"teamA":11,"teamB":7}]', 'A', '{"user_alex":12,"user_cruz":-12}', '{"season_spring_2026":{"user_alex":10,"user_cruz":-10}}', '2026-03-20T19:30:00.000Z', 'season_spring_2026', NULL, 'user_alex', 'active', NULL, NULL, NULL, '2026-03-20T19:35:00.000Z'),
  ('match_010', 'doubles', 'best_of_3', 11, '["user_bea","user_daya"]', '["user_eli","user_finn"]', '[{"teamA":11,"teamB":6},{"teamA":11,"teamB":9}]', 'A', '{"user_bea":9,"user_daya":9,"user_eli":-9,"user_finn":-9}', '{"season_spring_2026":{"user_bea":8,"user_daya":8,"user_eli":-8,"user_finn":-8}}', '2026-03-19T19:00:00.000Z', 'season_spring_2026', NULL, 'user_bea', 'active', NULL, NULL, NULL, '2026-03-19T19:10:00.000Z'),
  ('match_009', 'singles', 'single_game', 21, '["user_cruz"]', '["user_bea"]', '[{"teamA":19,"teamB":21}]', 'B', '{"user_cruz":-11,"user_bea":11}', '{"season_spring_2026":{"user_cruz":-10,"user_bea":10}}', '2026-03-18T18:30:00.000Z', 'season_spring_2026', NULL, 'user_cruz', 'active', NULL, NULL, NULL, '2026-03-18T18:40:00.000Z'),
  ('match_008', 'doubles', 'best_of_3', 11, '["user_alex","user_eli"]', '["user_cruz","user_finn"]', '[{"teamA":7,"teamB":11},{"teamA":11,"teamB":6},{"teamA":11,"teamB":5}]', 'A', '{"user_alex":10,"user_eli":10,"user_cruz":-10,"user_finn":-10}', '{"season_spring_2026":{"user_alex":8,"user_eli":8,"user_cruz":-8,"user_finn":-8}}', '2026-03-17T20:15:00.000Z', 'season_spring_2026', NULL, 'user_eli', 'active', NULL, NULL, NULL, '2026-03-17T20:20:00.000Z'),
  ('match_007', 'singles', 'best_of_3', 11, '["user_daya"]', '["user_alex"]', '[{"teamA":11,"teamB":9},{"teamA":6,"teamB":11},{"teamA":7,"teamB":11}]', 'B', '{"user_daya":-13,"user_alex":13}', '{"season_spring_2026":{"user_daya":-11,"user_alex":11}}', '2026-03-16T17:45:00.000Z', 'season_spring_2026', NULL, 'user_daya', 'active', NULL, NULL, NULL, '2026-03-16T17:55:00.000Z'),
  ('match_006', 'singles', 'best_of_3', 11, '["user_bea"]', '["user_eli"]', '[{"teamA":11,"teamB":5},{"teamA":11,"teamB":7}]', 'A', '{"user_bea":8,"user_eli":-8}', '{"tournament_berlin_open_2026":{"user_bea":10,"user_eli":-10}}', '2026-03-15T17:30:00.000Z', 'season_spring_2026', 'tournament_berlin_open_2026', 'user_bea', 'active', NULL, NULL, NULL, '2026-03-15T17:35:00.000Z'),
  ('match_005', 'singles', 'single_game', 21, '["user_alex"]', '["user_finn"]', '[{"teamA":21,"teamB":16}]', 'A', '{"user_alex":7,"user_finn":-7}', '{"tournament_berlin_open_2026":{"user_alex":9,"user_finn":-9}}', '2026-03-15T15:00:00.000Z', 'season_spring_2026', 'tournament_berlin_open_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-03-15T15:05:00.000Z'),
  ('match_004', 'doubles', 'best_of_3', 11, '["user_bea","user_cruz"]', '["user_daya","user_finn"]', '[{"teamA":11,"teamB":9},{"teamA":8,"teamB":11},{"teamA":11,"teamB":6}]', 'A', '{"user_bea":9,"user_cruz":9,"user_daya":-9,"user_finn":-9}', '{"tournament_berlin_open_2026":{"user_bea":8,"user_cruz":8,"user_daya":-8,"user_finn":-8}}', '2026-03-15T13:00:00.000Z', 'season_spring_2026', 'tournament_berlin_open_2026', 'user_cruz', 'active', NULL, NULL, NULL, '2026-03-15T13:10:00.000Z'),
  ('match_003', 'singles', 'single_game', 11, '["user_eli"]', '["user_daya"]', '[{"teamA":11,"teamB":9}]', 'A', '{"user_eli":10,"user_daya":-10}', '{"season_spring_2026":{"user_eli":9,"user_daya":-9}}', '2026-03-12T18:20:00.000Z', 'season_spring_2026', NULL, 'user_eli', 'active', NULL, NULL, NULL, '2026-03-12T18:25:00.000Z'),
  ('match_002', 'doubles', 'best_of_3', 11, '["user_alex","user_bea"]', '["user_cruz","user_daya"]', '[{"teamA":9,"teamB":11},{"teamA":11,"teamB":8},{"teamA":11,"teamB":7}]', 'A', '{"user_alex":11,"user_bea":11,"user_cruz":-11,"user_daya":-11}', '{"season_spring_2026":{"user_alex":9,"user_bea":9,"user_cruz":-9,"user_daya":-9}}', '2026-03-08T16:00:00.000Z', 'season_spring_2026', NULL, 'user_bea', 'active', NULL, NULL, NULL, '2026-03-08T16:10:00.000Z'),
  ('match_001', 'singles', 'single_game', 11, '["user_finn"]', '["user_cruz"]', '[{"teamA":7,"teamB":11}]', 'B', '{"user_finn":-8,"user_cruz":8}', '{"season_spring_2026":{"user_finn":-7,"user_cruz":7}}', '2026-03-03T19:40:00.000Z', 'season_spring_2026', NULL, 'user_finn', 'active', NULL, NULL, NULL, '2026-03-03T19:45:00.000Z'),
  ('match_000', 'singles', 'single_game', 11, '["user_eli"]', '["user_finn"]', '[{"teamA":11,"teamB":4}]', 'A', '{"user_eli":9,"user_finn":-9}', '{"season_spring_2026":{"user_eli":8,"user_finn":-8}}', '2026-03-01T18:00:00.000Z', 'season_spring_2026', NULL, 'user_eli', 'deleted', '2026-03-02T09:00:00.000Z', 'user_eli', 'Duplicate paper entry', '2026-03-01T18:05:00.000Z');

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_berlin_sf_1', 'tournament_berlin_open_2026', 0, 'Semifinals', 0, 'user_bea', 'user_eli', 'match_006', 'user_bea', 1, 0),
  ('tbm_berlin_sf_2', 'tournament_berlin_open_2026', 0, 'Semifinals', 1, 'user_alex', 'user_finn', 'match_005', 'user_alex', 1, 0),
  ('tbm_berlin_final', 'tournament_berlin_open_2026', 1, 'Final', 0, 'user_bea', 'user_alex', NULL, NULL, 0, 1);

INSERT INTO match_players (match_id, user_id, team) VALUES
  ('match_011', 'user_alex', 'A'),
  ('match_011', 'user_cruz', 'B'),
  ('match_010', 'user_bea', 'A'),
  ('match_010', 'user_daya', 'A'),
  ('match_010', 'user_eli', 'B'),
  ('match_010', 'user_finn', 'B'),
  ('match_009', 'user_cruz', 'A'),
  ('match_009', 'user_bea', 'B'),
  ('match_008', 'user_alex', 'A'),
  ('match_008', 'user_eli', 'A'),
  ('match_008', 'user_cruz', 'B'),
  ('match_008', 'user_finn', 'B'),
  ('match_007', 'user_daya', 'A'),
  ('match_007', 'user_alex', 'B'),
  ('match_006', 'user_bea', 'A'),
  ('match_006', 'user_eli', 'B'),
  ('match_005', 'user_alex', 'A'),
  ('match_005', 'user_finn', 'B'),
  ('match_004', 'user_bea', 'A'),
  ('match_004', 'user_cruz', 'A'),
  ('match_004', 'user_daya', 'B'),
  ('match_004', 'user_finn', 'B'),
  ('match_003', 'user_eli', 'A'),
  ('match_003', 'user_daya', 'B'),
  ('match_002', 'user_alex', 'A'),
  ('match_002', 'user_bea', 'A'),
  ('match_002', 'user_cruz', 'B'),
  ('match_002', 'user_daya', 'B'),
  ('match_001', 'user_finn', 'A'),
  ('match_001', 'user_cruz', 'B'),
  ('match_000', 'user_eli', 'A'),
  ('match_000', 'user_finn', 'B');

INSERT INTO elo_segments (
  id, segment_type, segment_id, user_id, elo, matches_played, matches_played_equivalent, wins, losses, streak, last_match_at, updated_at
) VALUES
  ('seg_season_alex', 'season', 'season_spring_2026', 'user_alex', 1278, 6, 6, 5, 1, 3, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_season_bea', 'season', 'season_spring_2026', 'user_bea', 1260, 6, 6, 4, 2, 2, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_season_cruz', 'season', 'season_spring_2026', 'user_cruz', 1238, 6, 6, 4, 2, 1, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_season_daya', 'season', 'season_spring_2026', 'user_daya', 1218, 6, 6, 3, 3, -1, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_season_eli', 'season', 'season_spring_2026', 'user_eli', 1196, 6, 6, 1, 5, -2, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_season_finn', 'season', 'season_spring_2026', 'user_finn', 1184, 6, 6, 1, 5, -3, '2026-03-20T20:05:00.000Z', '2026-03-20T20:05:00.000Z'),
  ('seg_tournament_alex', 'tournament', 'tournament_berlin_open_2026', 'user_alex', 1268, 3, 3, 2, 1, 1, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z'),
  ('seg_tournament_bea', 'tournament', 'tournament_berlin_open_2026', 'user_bea', 1272, 3, 3, 3, 0, 3, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z'),
  ('seg_tournament_cruz', 'tournament', 'tournament_berlin_open_2026', 'user_cruz', 1226, 3, 3, 1, 2, -1, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z'),
  ('seg_tournament_daya', 'tournament', 'tournament_berlin_open_2026', 'user_daya', 1210, 3, 3, 1, 2, -2, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z'),
  ('seg_tournament_eli', 'tournament', 'tournament_berlin_open_2026', 'user_eli', 1202, 3, 3, 1, 2, 1, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z'),
  ('seg_tournament_finn', 'tournament', 'tournament_berlin_open_2026', 'user_finn', 1188, 3, 3, 1, 2, -1, '2026-03-15T18:00:00.000Z', '2026-03-15T18:00:00.000Z');

PRAGMA foreign_keys = OFF;
