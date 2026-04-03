PRAGMA foreign_keys = OFF;

DELETE FROM request_dedup;
DELETE FROM audit_log;
DELETE FROM segment_share_links;
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
  ('user_alex', 'google', 'google-alex', 'alex@example.com', 'Alex Hart', 'https://example.com/alex.png', 1302, 12, 4, 3, '2026-01-10T09:00:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_bea', 'google', 'google-bea', 'bea@example.com', 'Bea Imani', 'https://example.com/bea.png', 1254, 10, 7, -1, '2026-01-10T09:05:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_cruz', 'google', 'google-cruz', 'cruz@example.com', 'Cruz Novak', 'https://example.com/cruz.png', 1226, 8, 8, -1, '2026-01-10T09:10:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_daya', 'google', 'google-daya', 'daya@example.com', 'Daya Chen', 'https://example.com/daya.png', 1208, 7, 9, -2, '2026-01-10T09:15:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_eli', 'google', 'google-eli', 'eli@example.com', 'Eli Stone', 'https://example.com/eli.png', 1209, 7, 8, 1, '2026-01-10T09:20:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_finn', 'google', 'google-finn', 'finn@example.com', 'Finn Vale', 'https://example.com/finn.png', 1174, 6, 10, 1, '2026-01-10T09:25:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_gina', 'google', 'google-gina', 'gina@example.com', 'Gina Park', 'https://example.com/gina.png', 1392, 10, 0, 10, '2026-02-14T10:00:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_hans', 'google', 'google-hans', 'hans@example.com', 'Hans Weber', 'https://example.com/hans.png', 1048, 0, 10, -10, '2026-02-18T10:15:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_ivy', 'google', 'google-ivy', 'ivy@example.com', 'Ivy Chen', 'https://example.com/ivy.png', 1238, 5, 2, 2, '2026-03-20T11:00:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_jules', 'google', 'google-jules', 'jules@example.com', 'Jules Martin', 'https://example.com/jules.png', 1204, 4, 5, -1, '2026-03-28T09:30:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_kai', 'google', 'google-kai', 'kai@example.com', 'Kai Schmidt', 'https://example.com/kai.png', 1280, 7, 3, 1, '2026-04-01T08:00:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_lina', 'google', 'google-lina', 'lina@example.com', 'Lina Vogel', 'https://example.com/lina.png', 1268, 6, 2, 4, '2026-04-03T08:30:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_milo', 'google', 'google-milo', 'milo@example.com', 'Milo Hart', 'https://example.com/milo.png', 1156, 2, 7, -4, '2026-04-04T08:45:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_nora', 'google', 'google-nora', 'nora@example.com', 'Nora Klein', 'https://example.com/nora.png', 1310, 8, 1, 5, '2026-04-05T07:30:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_oliver', 'google', 'google-oliver', 'oliver@example.com', 'Oliver Brandt', 'https://example.com/oliver.png', 1189, 4, 4, 0, '2026-01-22T10:00:00.000Z', '2026-04-05T19:00:00.000Z'),
  ('user_pia', 'google', 'google-pia', 'pia@example.com', 'Pia Kruger', 'https://example.com/pia.png', 1216, 5, 3, 2, '2026-01-22T10:15:00.000Z', '2026-04-05T19:00:00.000Z');

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
  '["user_alex","user_bea","user_cruz","user_daya","user_eli","user_finn","user_gina","user_hans","user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
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

INSERT INTO seasons (
  id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
  created_by_user_id, created_at, completed_at, is_public
) VALUES (
  'season_winter_2026',
  'Winter 2026 Championship',
  '2026-01-01',
  '2026-02-28',
  0,
  'completed',
  'carry_over',
  '["user_alex","user_bea","user_cruz","user_daya","user_eli","user_finn","user_gina","user_hans","user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
  'user_alex',
  '2025-12-28T09:00:00.000Z',
  '2026-03-01T10:00:00.000Z',
  1
);

INSERT INTO season_participants (season_id, user_id) VALUES
  ('season_winter_2026', 'user_alex'),
  ('season_winter_2026', 'user_bea'),
  ('season_winter_2026', 'user_cruz'),
  ('season_winter_2026', 'user_daya'),
  ('season_winter_2026', 'user_eli'),
  ('season_winter_2026', 'user_finn'),
  ('season_winter_2026', 'user_gina'),
  ('season_winter_2026', 'user_hans'),
  ('season_winter_2026', 'user_ivy'),
  ('season_winter_2026', 'user_jules'),
  ('season_winter_2026', 'user_kai'),
  ('season_winter_2026', 'user_lina'),
  ('season_winter_2026', 'user_milo'),
  ('season_winter_2026', 'user_nora'),
  ('season_winter_2026', 'user_oliver'),
  ('season_winter_2026', 'user_pia');

INSERT INTO season_participants (season_id, user_id) VALUES
  ('season_spring_2026', 'user_gina'),
  ('season_spring_2026', 'user_hans'),
  ('season_spring_2026', 'user_ivy'),
  ('season_spring_2026', 'user_jules'),
  ('season_spring_2026', 'user_kai'),
  ('season_spring_2026', 'user_lina'),
  ('season_spring_2026', 'user_milo'),
  ('season_spring_2026', 'user_nora'),
  ('season_spring_2026', 'user_oliver'),
  ('season_spring_2026', 'user_pia');

INSERT INTO seasons (
  id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
  created_by_user_id, created_at, completed_at, is_public
) VALUES (
  'season_summer_2026',
  'Summer 2026 Cup',
  '2026-04-01',
  '2026-06-30',
  0,
  'completed',
  'reset_1200',
  '["user_alex","user_bea","user_gina","user_hans","user_ivy","user_jules","user_kai","user_lina"]',
  'user_gina',
  '2026-03-28T10:00:00.000Z',
  '2026-04-28T20:00:00.000Z',
  1
);

INSERT INTO season_participants (season_id, user_id) VALUES
  ('season_summer_2026', 'user_alex'),
  ('season_summer_2026', 'user_bea'),
  ('season_summer_2026', 'user_gina'),
  ('season_summer_2026', 'user_hans'),
  ('season_summer_2026', 'user_ivy'),
  ('season_summer_2026', 'user_jules'),
  ('season_summer_2026', 'user_kai'),
  ('season_summer_2026', 'user_lina');

INSERT INTO seasons (
  id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
  created_by_user_id, created_at, completed_at, is_public
) VALUES (
  'season_autumn_2026',
  'Autumn 2026 Preview',
  '2026-09-01',
  '2026-11-30',
  0,
  'active',
  'reset_1200',
  '["user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
  'user_nora',
  '2026-08-01T09:00:00.000Z',
  NULL,
  1
);

INSERT INTO season_participants (season_id, user_id) VALUES
  ('season_autumn_2026', 'user_ivy'),
  ('season_autumn_2026', 'user_jules'),
  ('season_autumn_2026', 'user_kai'),
  ('season_autumn_2026', 'user_lina'),
  ('season_autumn_2026', 'user_milo'),
  ('season_autumn_2026', 'user_nora'),
  ('season_autumn_2026', 'user_oliver'),
  ('season_autumn_2026', 'user_pia');

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

INSERT INTO tournaments (
  id, name, date, status, season_id, created_by_user_id, created_at, completed_at
) VALUES
  ('tournament_summer_cup_2026', 'Summer Cup 2026', '2026-04-18', 'completed', 'season_summer_2026', 'user_gina', '2026-04-01T10:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('tournament_open_clash_2026', 'Open Clash April 2026', '2026-04-22', 'active', NULL, 'user_nora', '2026-04-10T09:00:00.000Z', ''),
  ('tournament_deleted_trial_2026', 'Deleted Trial 2026', '2026-03-09', 'deleted', NULL, 'user_bea', '2026-03-05T09:00:00.000Z', '2026-03-10T09:00:00.000Z');

INSERT INTO tournaments (
  id, name, date, status, season_id, created_by_user_id, created_at, completed_at
) VALUES
  ('tournament_winter_cup_2026', 'Winter Cup 2026', '2026-01-18', 'completed', 'season_winter_2026', 'user_alex', '2026-01-05T10:00:00.000Z', '2026-01-18T20:00:00.000Z'),
  ('tournament_spring_masters_2026', 'Spring Masters 2026', '2026-03-12', 'completed', 'season_spring_2026', 'user_gina', '2026-03-01T09:00:00.000Z', '2026-03-12T20:00:00.000Z'),
  ('tournament_autumn_preview_2026', 'Autumn Preview 2026', '2026-09-20', 'active', 'season_autumn_2026', 'user_nora', '2026-08-01T09:30:00.000Z', '');

INSERT INTO tournament_participants (tournament_id, user_id) VALUES
  ('tournament_winter_cup_2026', 'user_alex'),
  ('tournament_winter_cup_2026', 'user_bea'),
  ('tournament_winter_cup_2026', 'user_cruz'),
  ('tournament_winter_cup_2026', 'user_daya'),
  ('tournament_winter_cup_2026', 'user_eli'),
  ('tournament_winter_cup_2026', 'user_finn'),
  ('tournament_winter_cup_2026', 'user_gina'),
  ('tournament_winter_cup_2026', 'user_hans'),
  ('tournament_winter_cup_2026', 'user_ivy'),
  ('tournament_winter_cup_2026', 'user_jules'),
  ('tournament_winter_cup_2026', 'user_kai'),
  ('tournament_winter_cup_2026', 'user_lina'),
  ('tournament_winter_cup_2026', 'user_milo'),
  ('tournament_winter_cup_2026', 'user_nora'),
  ('tournament_winter_cup_2026', 'user_oliver'),
  ('tournament_winter_cup_2026', 'user_pia'),
  ('tournament_spring_masters_2026', 'user_alex'),
  ('tournament_spring_masters_2026', 'user_bea'),
  ('tournament_spring_masters_2026', 'user_cruz'),
  ('tournament_spring_masters_2026', 'user_daya'),
  ('tournament_spring_masters_2026', 'user_eli'),
  ('tournament_spring_masters_2026', 'user_finn'),
  ('tournament_spring_masters_2026', 'user_gina'),
  ('tournament_spring_masters_2026', 'user_hans'),
  ('tournament_spring_masters_2026', 'user_ivy'),
  ('tournament_spring_masters_2026', 'user_jules'),
  ('tournament_spring_masters_2026', 'user_kai'),
  ('tournament_spring_masters_2026', 'user_lina'),
  ('tournament_spring_masters_2026', 'user_milo'),
  ('tournament_spring_masters_2026', 'user_nora'),
  ('tournament_spring_masters_2026', 'user_oliver'),
  ('tournament_spring_masters_2026', 'user_pia'),
  ('tournament_autumn_preview_2026', 'user_ivy'),
  ('tournament_autumn_preview_2026', 'user_jules'),
  ('tournament_autumn_preview_2026', 'user_kai'),
  ('tournament_autumn_preview_2026', 'user_lina'),
  ('tournament_autumn_preview_2026', 'user_milo'),
  ('tournament_autumn_preview_2026', 'user_nora'),
  ('tournament_autumn_preview_2026', 'user_oliver'),
  ('tournament_autumn_preview_2026', 'user_pia');

INSERT INTO tournament_participants (tournament_id, user_id) VALUES
  ('tournament_summer_cup_2026', 'user_alex'),
  ('tournament_summer_cup_2026', 'user_bea'),
  ('tournament_summer_cup_2026', 'user_gina'),
  ('tournament_summer_cup_2026', 'user_hans'),
  ('tournament_summer_cup_2026', 'user_ivy'),
  ('tournament_summer_cup_2026', 'user_jules'),
  ('tournament_summer_cup_2026', 'user_kai'),
  ('tournament_summer_cup_2026', 'user_lina'),
  ('tournament_open_clash_2026', 'user_ivy'),
  ('tournament_open_clash_2026', 'user_jules'),
  ('tournament_open_clash_2026', 'user_milo'),
  ('tournament_open_clash_2026', 'user_nora'),
  ('tournament_deleted_trial_2026', 'user_bea'),
  ('tournament_deleted_trial_2026', 'user_cruz'),
  ('tournament_deleted_trial_2026', 'user_daya'),
  ('tournament_deleted_trial_2026', 'user_finn');

INSERT INTO tournament_plans (
  id, tournament_id, participant_ids_json, bracket_json, created_by_user_id, created_at, updated_at
) VALUES
  (
    'plan_summer_cup_2026',
    'tournament_summer_cup_2026',
    '["user_gina","user_hans","user_ivy","user_jules","user_alex","user_bea","user_kai","user_lina"]',
    '[{"title":"Quarterfinals","matches":[{"id":"tbm_summer_qf_1","leftPlayerId":"user_gina","rightPlayerId":"user_hans","createdMatchId":"match_031","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_summer_qf_2","leftPlayerId":"user_ivy","rightPlayerId":"user_jules","createdMatchId":"match_032","winnerPlayerId":"user_ivy","locked":1,"isFinal":false},{"id":"tbm_summer_qf_3","leftPlayerId":"user_alex","rightPlayerId":"user_bea","createdMatchId":"match_033","winnerPlayerId":"user_alex","locked":1,"isFinal":false},{"id":"tbm_summer_qf_4","leftPlayerId":"user_kai","rightPlayerId":"user_lina","createdMatchId":"match_034","winnerPlayerId":"user_kai","locked":1,"isFinal":false}]},{"title":"Semifinals","matches":[{"id":"tbm_summer_sf_1","leftPlayerId":"user_gina","rightPlayerId":"user_ivy","createdMatchId":"match_035","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_summer_sf_2","leftPlayerId":"user_alex","rightPlayerId":"user_kai","createdMatchId":"match_036","winnerPlayerId":"user_kai","locked":1,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_summer_final","leftPlayerId":"user_gina","rightPlayerId":"user_kai","createdMatchId":"match_037","winnerPlayerId":"user_gina","locked":1,"isFinal":true}]}]',
    'user_gina',
    '2026-04-01T10:00:00.000Z',
    '2026-04-28T20:00:00.000Z'
  ),
  (
    'plan_open_clash_2026',
    'tournament_open_clash_2026',
    '["user_ivy","user_jules","user_milo","user_nora"]',
    '[{"title":"Semifinals","matches":[{"id":"tbm_open_sf_1","leftPlayerId":"user_ivy","rightPlayerId":"user_jules","createdMatchId":"match_042","winnerPlayerId":"user_ivy","locked":1,"isFinal":false},{"id":"tbm_open_sf_2","leftPlayerId":"user_milo","rightPlayerId":"user_nora","createdMatchId":"match_043","winnerPlayerId":"user_nora","locked":1,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_open_final","leftPlayerId":"user_ivy","rightPlayerId":"user_nora","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":true}]}]',
    'user_nora',
    '2026-04-10T09:00:00.000Z',
    '2026-04-10T09:00:00.000Z'
  ),
  (
    'plan_deleted_trial_2026',
    'tournament_deleted_trial_2026',
    '["user_bea","user_cruz","user_daya","user_finn"]',
    '[{"title":"Semifinals","matches":[{"id":"tbm_deleted_sf_1","leftPlayerId":"user_bea","rightPlayerId":"user_cruz","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false},{"id":"tbm_deleted_sf_2","leftPlayerId":"user_daya","rightPlayerId":"user_finn","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_deleted_final","leftPlayerId":null,"rightPlayerId":null,"createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":true}]}]',
    'user_bea',
    '2026-03-05T09:00:00.000Z',
    '2026-03-10T09:00:00.000Z'
  );

INSERT INTO tournament_plans (
  id, tournament_id, participant_ids_json, bracket_json, created_by_user_id, created_at, updated_at
) VALUES
  (
    'plan_winter_cup_2026',
    'tournament_winter_cup_2026',
    '["user_alex","user_bea","user_cruz","user_daya","user_eli","user_finn","user_gina","user_hans","user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
    '[{"title":"Round of 16","matches":[{"id":"tbm_winter_r16_1","leftPlayerId":"user_alex","rightPlayerId":"user_pia","createdMatchId":"match_060","winnerPlayerId":"user_alex","locked":1,"isFinal":false},{"id":"tbm_winter_r16_2","leftPlayerId":"user_bea","rightPlayerId":"user_oliver","createdMatchId":"match_061","winnerPlayerId":"user_bea","locked":1,"isFinal":false},{"id":"tbm_winter_r16_3","leftPlayerId":"user_cruz","rightPlayerId":"user_nora","createdMatchId":"match_062","winnerPlayerId":"user_nora","locked":1,"isFinal":false},{"id":"tbm_winter_r16_4","leftPlayerId":"user_daya","rightPlayerId":"user_milo","createdMatchId":"match_063","winnerPlayerId":"user_milo","locked":1,"isFinal":false},{"id":"tbm_winter_r16_5","leftPlayerId":"user_eli","rightPlayerId":"user_lina","createdMatchId":"match_064","winnerPlayerId":"user_eli","locked":1,"isFinal":false},{"id":"tbm_winter_r16_6","leftPlayerId":"user_finn","rightPlayerId":"user_kai","createdMatchId":"match_065","winnerPlayerId":"user_kai","locked":1,"isFinal":false},{"id":"tbm_winter_r16_7","leftPlayerId":"user_gina","rightPlayerId":"user_jules","createdMatchId":"match_066","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_winter_r16_8","leftPlayerId":"user_hans","rightPlayerId":"user_ivy","createdMatchId":"match_067","winnerPlayerId":"user_ivy","locked":1,"isFinal":false}]},{"title":"Quarterfinals","matches":[{"id":"tbm_winter_qf_1","leftPlayerId":"user_alex","rightPlayerId":"user_bea","createdMatchId":"match_068","winnerPlayerId":"user_alex","locked":1,"isFinal":false},{"id":"tbm_winter_qf_2","leftPlayerId":"user_nora","rightPlayerId":"user_milo","createdMatchId":"match_069","winnerPlayerId":"user_milo","locked":1,"isFinal":false},{"id":"tbm_winter_qf_3","leftPlayerId":"user_eli","rightPlayerId":"user_kai","createdMatchId":"match_070","winnerPlayerId":"user_kai","locked":1,"isFinal":false},{"id":"tbm_winter_qf_4","leftPlayerId":"user_gina","rightPlayerId":"user_ivy","createdMatchId":"match_071","winnerPlayerId":"user_gina","locked":1,"isFinal":false}]},{"title":"Semifinals","matches":[{"id":"tbm_winter_sf_1","leftPlayerId":"user_alex","rightPlayerId":"user_milo","createdMatchId":"match_072","winnerPlayerId":"user_alex","locked":1,"isFinal":false},{"id":"tbm_winter_sf_2","leftPlayerId":"user_kai","rightPlayerId":"user_gina","createdMatchId":"match_073","winnerPlayerId":"user_gina","locked":1,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_winter_final","leftPlayerId":"user_alex","rightPlayerId":"user_gina","createdMatchId":"match_074","winnerPlayerId":"user_alex","locked":1,"isFinal":true}]}]',
    'user_alex',
    '2026-01-05T10:00:00.000Z',
    '2026-01-18T20:00:00.000Z'
  ),
  (
    'plan_spring_masters_2026',
    'tournament_spring_masters_2026',
    '["user_alex","user_bea","user_cruz","user_daya","user_eli","user_finn","user_gina","user_hans","user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
    '[{"title":"Round of 16","matches":[{"id":"tbm_spring_r16_1","leftPlayerId":"user_gina","rightPlayerId":"user_hans","createdMatchId":"match_080","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_spring_r16_2","leftPlayerId":"user_ivy","rightPlayerId":"user_jules","createdMatchId":"match_081","winnerPlayerId":"user_ivy","locked":1,"isFinal":false},{"id":"tbm_spring_r16_3","leftPlayerId":"user_alex","rightPlayerId":"user_bea","createdMatchId":"match_082","winnerPlayerId":"user_alex","locked":1,"isFinal":false},{"id":"tbm_spring_r16_4","leftPlayerId":"user_kai","rightPlayerId":"user_lina","createdMatchId":"match_083","winnerPlayerId":"user_kai","locked":1,"isFinal":false},{"id":"tbm_spring_r16_5","leftPlayerId":"user_cruz","rightPlayerId":"user_oliver","createdMatchId":"match_084","winnerPlayerId":"user_oliver","locked":1,"isFinal":false},{"id":"tbm_spring_r16_6","leftPlayerId":"user_daya","rightPlayerId":"user_pia","createdMatchId":"match_085","winnerPlayerId":"user_daya","locked":1,"isFinal":false},{"id":"tbm_spring_r16_7","leftPlayerId":"user_eli","rightPlayerId":"user_milo","createdMatchId":"match_086","winnerPlayerId":"user_eli","locked":1,"isFinal":false},{"id":"tbm_spring_r16_8","leftPlayerId":"user_finn","rightPlayerId":"user_nora","createdMatchId":"match_087","winnerPlayerId":"user_nora","locked":1,"isFinal":false}]},{"title":"Quarterfinals","matches":[{"id":"tbm_spring_qf_1","leftPlayerId":"user_gina","rightPlayerId":"user_ivy","createdMatchId":"match_088","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_spring_qf_2","leftPlayerId":"user_alex","rightPlayerId":"user_kai","createdMatchId":"match_089","winnerPlayerId":"user_kai","locked":1,"isFinal":false},{"id":"tbm_spring_qf_3","leftPlayerId":"user_cruz","rightPlayerId":"user_daya","createdMatchId":"match_090","winnerPlayerId":"user_cruz","locked":1,"isFinal":false},{"id":"tbm_spring_qf_4","leftPlayerId":"user_eli","rightPlayerId":"user_nora","createdMatchId":"match_091","winnerPlayerId":"user_eli","locked":1,"isFinal":false}]},{"title":"Semifinals","matches":[{"id":"tbm_spring_sf_1","leftPlayerId":"user_gina","rightPlayerId":"user_kai","createdMatchId":"match_092","winnerPlayerId":"user_gina","locked":1,"isFinal":false},{"id":"tbm_spring_sf_2","leftPlayerId":"user_cruz","rightPlayerId":"user_eli","createdMatchId":"match_093","winnerPlayerId":"user_eli","locked":1,"isFinal":false}]},{"title":"Final","matches":[{"id":"tbm_spring_final","leftPlayerId":"user_gina","rightPlayerId":"user_eli","createdMatchId":"match_094","winnerPlayerId":"user_gina","locked":1,"isFinal":true}]}]',
    'user_gina',
    '2026-03-01T09:00:00.000Z',
    '2026-03-12T20:00:00.000Z'
  ),
  (
    'plan_autumn_preview_2026',
    'tournament_autumn_preview_2026',
    '["user_ivy","user_jules","user_kai","user_lina","user_milo","user_nora","user_oliver","user_pia"]',
    '[{"title":"Quarterfinals","matches":[{"id":"tbm_autumn_qf_1","leftPlayerId":"user_ivy","rightPlayerId":"user_jules","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false},{"id":"tbm_autumn_qf_2","leftPlayerId":"user_kai","rightPlayerId":"user_lina","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false},{"id":"tbm_autumn_qf_3","leftPlayerId":"user_milo","rightPlayerId":"user_nora","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false},{"id":"tbm_autumn_qf_4","leftPlayerId":"user_oliver","rightPlayerId":"user_pia","createdMatchId":null,"winnerPlayerId":null,"locked":0,"isFinal":false}]}]',
    'user_nora',
    '2026-08-01T09:30:00.000Z',
    '2026-08-01T09:30:00.000Z'
  );

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
  ('match_019', 'singles', 'single_game', 11, '["user_alex"]', '["user_bea"]', '[{"teamA":11,"teamB":8}]', 'A', '{"user_alex":10,"user_bea":-10}', '{}', '2026-04-05T18:00:00.000Z', NULL, NULL, 'user_alex', 'active', NULL, NULL, NULL, '2026-04-05T18:05:00.000Z'),
  ('match_018', 'doubles', 'single_game', 11, '["user_cruz","user_daya"]', '["user_eli","user_finn"]', '[{"teamA":11,"teamB":9}]', 'B', '{"user_cruz":-8,"user_daya":-8,"user_eli":8,"user_finn":8}', '{}', '2026-04-02T19:15:00.000Z', NULL, NULL, 'user_cruz', 'active', NULL, NULL, NULL, '2026-04-02T19:20:00.000Z'),
  ('match_017', 'singles', 'best_of_3', 21, '["user_bea"]', '["user_daya"]', '[{"teamA":21,"teamB":18},{"teamA":17,"teamB":21},{"teamA":21,"teamB":16}]', 'A', '{"user_bea":11,"user_daya":-11}', '{}', '2026-03-27T18:30:00.000Z', NULL, NULL, 'user_bea', 'active', NULL, NULL, NULL, '2026-03-27T18:40:00.000Z'),
  ('match_016', 'doubles', 'best_of_3', 21, '["user_alex","user_eli"]', '["user_bea","user_cruz"]', '[{"teamA":21,"teamB":19},{"teamA":18,"teamB":21},{"teamA":21,"teamB":17}]', 'A', '{"user_alex":9,"user_eli":9,"user_bea":-9,"user_cruz":-9}', '{}', '2026-03-22T19:00:00.000Z', NULL, NULL, 'user_eli', 'active', NULL, NULL, NULL, '2026-03-22T19:10:00.000Z'),
  ('match_015', 'singles', 'best_of_3', 21, '["user_finn"]', '["user_cruz"]', '[{"teamA":21,"teamB":19},{"teamA":16,"teamB":21},{"teamA":21,"teamB":18}]', 'A', '{"user_finn":12,"user_cruz":-12}', '{}', '2026-03-18T18:10:00.000Z', NULL, NULL, 'user_finn', 'active', NULL, NULL, NULL, '2026-03-18T18:20:00.000Z'),
  ('match_014', 'doubles', 'single_game', 21, '["user_alex","user_daya"]', '["user_bea","user_finn"]', '[{"teamA":21,"teamB":18}]', 'A', '{"user_alex":7,"user_daya":7,"user_bea":-7,"user_finn":-7}', '{}', '2026-03-12T19:00:00.000Z', NULL, NULL, 'user_daya', 'active', NULL, NULL, NULL, '2026-03-12T19:05:00.000Z'),
  ('match_013', 'doubles', 'single_game', 11, '["user_bea","user_cruz"]', '["user_alex","user_finn"]', '[{"teamA":11,"teamB":7}]', 'A', '{"user_bea":8,"user_cruz":8,"user_alex":-8,"user_finn":-8}', '{}', '2026-02-28T18:30:00.000Z', NULL, NULL, 'user_bea', 'active', NULL, NULL, NULL, '2026-02-28T18:35:00.000Z'),
  ('match_012', 'singles', 'single_game', 21, '["user_eli"]', '["user_daya"]', '[{"teamA":19,"teamB":21}]', 'B', '{"user_eli":-9,"user_daya":9}', '{}', '2026-02-18T19:00:00.000Z', NULL, NULL, 'user_eli', 'active', NULL, NULL, NULL, '2026-02-18T19:05:00.000Z'),
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

INSERT INTO matches (
  id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
  score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
  tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
  deactivation_reason, created_at
) VALUES
  ('match_043', 'singles', 'best_of_3', 11, '["user_milo"]', '["user_nora"]', '[{"teamA":9,"teamB":11},{"teamA":11,"teamB":8},{"teamA":8,"teamB":11}]', 'B', '{"user_milo":-10,"user_nora":10}', '{"tournament_open_clash_2026":{"user_milo":-8,"user_nora":8}}', '2026-04-20T20:00:00.000Z', NULL, 'tournament_open_clash_2026', 'user_nora', 'active', NULL, NULL, NULL, '2026-04-20T20:05:00.000Z'),
  ('match_042', 'singles', 'single_game', 11, '["user_ivy"]', '["user_jules"]', '[{"teamA":11,"teamB":7}]', 'A', '{"user_ivy":8,"user_jules":-8}', '{"tournament_open_clash_2026":{"user_ivy":7,"user_jules":-7}}', '2026-04-20T19:00:00.000Z', NULL, 'tournament_open_clash_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-04-20T19:05:00.000Z'),
  ('match_041', 'doubles', 'best_of_3', 21, '["user_kai","user_lina"]', '["user_bea","user_hans"]', '[{"teamA":21,"teamB":19},{"teamA":18,"teamB":21},{"teamA":21,"teamB":16}]', 'A', '{"user_kai":12,"user_lina":12,"user_bea":-12,"user_hans":-12}', '{"season_summer_2026":{"user_kai":10,"user_lina":10,"user_bea":-10,"user_hans":-10}}', '2026-04-27T18:30:00.000Z', 'season_summer_2026', NULL, 'user_kai', 'active', NULL, NULL, NULL, '2026-04-27T18:40:00.000Z'),
  ('match_040', 'doubles', 'single_game', 11, '["user_gina","user_jules"]', '["user_alex","user_lina"]', '[{"teamA":11,"teamB":9}]', 'A', '{"user_gina":7,"user_jules":7,"user_alex":-7,"user_lina":-7}', '{"season_summer_2026":{"user_gina":6,"user_jules":6,"user_alex":-6,"user_lina":-6}}', '2026-04-25T19:00:00.000Z', 'season_summer_2026', NULL, 'user_gina', 'active', NULL, NULL, NULL, '2026-04-25T19:05:00.000Z'),
  ('match_039', 'singles', 'best_of_3', 11, '["user_hans"]', '["user_jules"]', '[{"teamA":11,"teamB":9},{"teamA":10,"teamB":12},{"teamA":11,"teamB":8}]', 'A', '{"user_hans":11,"user_jules":-11}', '{"season_summer_2026":{"user_hans":10,"user_jules":-10}}', '2026-04-23T18:20:00.000Z', 'season_summer_2026', NULL, 'user_hans', 'deleted', '2026-04-24T08:00:00.000Z', 'user_hans', 'Score entry corrected', '2026-04-23T18:25:00.000Z'),
  ('match_038', 'singles', 'single_game', 11, '["user_ivy"]', '["user_jules"]', '[{"teamA":11,"teamB":8}]', 'A', '{"user_ivy":8,"user_jules":-8}', '{"tournament_open_clash_2026":{"user_ivy":7,"user_jules":-7}}', '2026-04-20T19:00:00.000Z', NULL, 'tournament_open_clash_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-04-20T19:05:00.000Z'),
  ('match_037', 'singles', 'best_of_3', 11, '["user_gina"]', '["user_kai"]', '[{"teamA":11,"teamB":9},{"teamA":11,"teamB":7}]', 'A', '{"user_gina":13,"user_kai":-13}', '{"season_summer_2026":{"user_gina":11,"user_kai":-11},"tournament_summer_cup_2026":{"user_gina":11,"user_kai":-11}}', '2026-04-28T19:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-04-28T19:05:00.000Z'),
  ('match_036', 'singles', 'single_game', 21, '["user_alex"]', '["user_kai"]', '[{"teamA":21,"teamB":18}]', 'A', '{"user_alex":9,"user_kai":-9}', '{"season_summer_2026":{"user_alex":8,"user_kai":-8},"tournament_summer_cup_2026":{"user_alex":8,"user_kai":-8}}', '2026-04-28T18:20:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-04-28T18:25:00.000Z'),
  ('match_035', 'doubles', 'best_of_3', 11, '["user_gina","user_ivy"]', '["user_bea","user_kai"]', '[{"teamA":11,"teamB":9},{"teamA":11,"teamB":6}]', 'A', '{"user_gina":10,"user_ivy":10,"user_bea":-10,"user_kai":-10}', '{"season_summer_2026":{"user_gina":9,"user_ivy":9,"user_bea":-9,"user_kai":-9},"tournament_summer_cup_2026":{"user_gina":9,"user_ivy":9,"user_bea":-9,"user_kai":-9}}', '2026-04-28T17:30:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-04-28T17:40:00.000Z'),
  ('match_034', 'singles', 'single_game', 21, '["user_kai"]', '["user_lina"]', '[{"teamA":21,"teamB":17}]', 'A', '{"user_kai":8,"user_lina":-8}', '{"season_summer_2026":{"user_kai":7,"user_lina":-7},"tournament_summer_cup_2026":{"user_kai":7,"user_lina":-7}}', '2026-04-18T16:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-04-18T16:05:00.000Z'),
  ('match_033', 'doubles', 'single_game', 11, '["user_alex","user_ivy"]', '["user_bea","user_kai"]', '[{"teamA":11,"teamB":13}]', 'B', '{"user_alex":-7,"user_ivy":-7,"user_bea":7,"user_kai":7}', '{"season_summer_2026":{"user_alex":-6,"user_ivy":-6,"user_bea":6,"user_kai":6},"tournament_summer_cup_2026":{"user_alex":-6,"user_ivy":-6,"user_bea":6,"user_kai":6}}', '2026-04-18T15:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_bea', 'active', NULL, NULL, NULL, '2026-04-18T15:05:00.000Z'),
  ('match_032', 'singles', 'best_of_3', 11, '["user_gina"]', '["user_hans"]', '[{"teamA":11,"teamB":6},{"teamA":11,"teamB":8}]', 'A', '{"user_gina":12,"user_hans":-12}', '{"season_summer_2026":{"user_gina":10,"user_hans":-10},"tournament_summer_cup_2026":{"user_gina":10,"user_hans":-10}}', '2026-04-18T14:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-04-18T14:10:00.000Z'),
  ('match_031', 'singles', 'best_of_3', 11, '["user_gina"]', '["user_kai"]', '[{"teamA":11,"teamB":8},{"teamA":9,"teamB":11},{"teamA":11,"teamB":7}]', 'A', '{"user_gina":14,"user_kai":-14}', '{"season_summer_2026":{"user_gina":12,"user_kai":-12},"tournament_summer_cup_2026":{"user_gina":12,"user_kai":-12}}', '2026-04-28T19:30:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-04-28T19:40:00.000Z'),
  ('match_030', 'singles', 'best_of_3', 11, '["user_alex"]', '["user_kai"]', '[{"teamA":11,"teamB":9},{"teamA":7,"teamB":11},{"teamA":11,"teamB":8}]', 'A', '{"user_alex":11,"user_kai":-11}', '{"season_summer_2026":{"user_alex":10,"user_kai":-10},"tournament_summer_cup_2026":{"user_alex":10,"user_kai":-10}}', '2026-04-28T18:50:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-04-28T19:00:00.000Z'),
  ('match_029', 'singles', 'single_game', 21, '["user_gina"]', '["user_ivy"]', '[{"teamA":21,"teamB":17}]', 'A', '{"user_gina":9,"user_ivy":-9}', '{"season_summer_2026":{"user_gina":8,"user_ivy":-8},"tournament_summer_cup_2026":{"user_gina":8,"user_ivy":-8}}', '2026-04-28T18:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-04-28T18:05:00.000Z'),
  ('match_028', 'singles', 'best_of_3', 21, '["user_kai"]', '["user_lina"]', '[{"teamA":21,"teamB":18},{"teamA":18,"teamB":21},{"teamA":21,"teamB":16}]', 'A', '{"user_kai":10,"user_lina":-10}', '{"season_summer_2026":{"user_kai":9,"user_lina":-9},"tournament_summer_cup_2026":{"user_kai":9,"user_lina":-9}}', '2026-04-18T13:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-04-18T13:10:00.000Z'),
  ('match_027', 'doubles', 'best_of_3', 11, '["user_alex","user_bea"]', '["user_kai","user_lina"]', '[{"teamA":11,"teamB":9},{"teamA":8,"teamB":11},{"teamA":11,"teamB":6}]', 'A', '{"user_alex":9,"user_bea":9,"user_kai":-9,"user_lina":-9}', '{"season_summer_2026":{"user_alex":8,"user_bea":8,"user_kai":-8,"user_lina":-8},"tournament_summer_cup_2026":{"user_alex":8,"user_bea":8,"user_kai":-8,"user_lina":-8}}', '2026-04-18T12:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_bea', 'active', NULL, NULL, NULL, '2026-04-18T12:10:00.000Z'),
  ('match_026', 'singles', 'single_game', 21, '["user_ivy"]', '["user_jules"]', '[{"teamA":21,"teamB":19}]', 'A', '{"user_ivy":8,"user_jules":-8}', '{"season_summer_2026":{"user_ivy":7,"user_jules":-7},"tournament_summer_cup_2026":{"user_ivy":7,"user_jules":-7}}', '2026-04-18T11:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-04-18T11:05:00.000Z'),
  ('match_025', 'singles', 'best_of_3', 11, '["user_gina"]', '["user_hans"]', '[{"teamA":11,"teamB":7},{"teamA":11,"teamB":9}]', 'A', '{"user_gina":10,"user_hans":-10}', '{"season_summer_2026":{"user_gina":9,"user_hans":-9},"tournament_summer_cup_2026":{"user_gina":9,"user_hans":-9}}', '2026-04-18T10:00:00.000Z', 'season_summer_2026', 'tournament_summer_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-04-18T10:05:00.000Z'),
  ('match_024', 'singles', 'single_game', 11, '["user_jules"]', '["user_hans"]', '[{"teamA":11,"teamB":8}]', 'A', '{"user_jules":8,"user_hans":-8}', '{}', '2026-04-14T18:00:00.000Z', NULL, NULL, 'user_jules', 'deleted', '2026-04-14T19:00:00.000Z', 'user_jules', 'Duplicate match entry', '2026-04-14T18:05:00.000Z'),
  ('match_023', 'doubles', 'single_game', 11, '["user_gina","user_kai"]', '["user_bea","user_milo"]', '[{"teamA":11,"teamB":6}]', 'A', '{"user_gina":7,"user_kai":7,"user_bea":-7,"user_milo":-7}', '{}', '2026-04-12T18:00:00.000Z', NULL, NULL, 'user_gina', 'active', NULL, NULL, NULL, '2026-04-12T18:05:00.000Z'),
  ('match_022', 'singles', 'single_game', 21, '["user_hans"]', '["user_ivy"]', '[{"teamA":18,"teamB":21}]', 'B', '{"user_hans":-9,"user_ivy":9}', '{}', '2026-04-11T18:00:00.000Z', NULL, NULL, 'user_ivy', 'active', NULL, NULL, NULL, '2026-04-11T18:05:00.000Z'),
  ('match_021', 'doubles', 'best_of_3', 11, '["user_nora","user_lina"]', '["user_milo","user_jules"]', '[{"teamA":11,"teamB":9},{"teamA":9,"teamB":11},{"teamA":11,"teamB":7}]', 'A', '{"user_nora":9,"user_lina":9,"user_milo":-9,"user_jules":-9}', '{}', '2026-04-09T18:00:00.000Z', NULL, NULL, 'user_nora', 'active', NULL, NULL, NULL, '2026-04-09T18:10:00.000Z'),
  ('match_020', 'singles', 'best_of_3', 11, '["user_alex"]', '["user_gina"]', '[{"teamA":8,"teamB":11},{"teamA":11,"teamB":9},{"teamA":11,"teamB":6}]', 'A', '{"user_alex":12,"user_gina":-12}', '{}', '2026-04-06T18:00:00.000Z', NULL, NULL, 'user_alex', 'active', NULL, NULL, NULL, '2026-04-06T18:05:00.000Z');

INSERT INTO matches (
  id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
  score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
  tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
  deactivation_reason, created_at
) VALUES
  ('match_060', 'singles', 'single_game', 11, '["user_alex"]', '["user_pia"]', '[{"teamA":11,"teamB":8}]', 'A', '{"user_alex":8,"user_pia":-8}', '{"season_winter_2026":{"user_alex":7,"user_pia":-7},"tournament_winter_cup_2026":{"user_alex":7,"user_pia":-7}}', '2026-01-10T18:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-01-10T18:00:00.000Z'),
  ('match_061', 'singles', 'best_of_3', 11, '["user_bea"]', '["user_oliver"]', '[{"teamA":11,"teamB":9},{"teamA":9,"teamB":11},{"teamA":11,"teamB":7}]', 'A', '{"user_bea":11,"user_oliver":-11}', '{"season_winter_2026":{"user_bea":10,"user_oliver":-10},"tournament_winter_cup_2026":{"user_bea":10,"user_oliver":-10}}', '2026-01-10T18:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_bea', 'active', NULL, NULL, NULL, '2026-01-10T18:30:00.000Z'),
  ('match_062', 'singles', 'single_game', 21, '["user_cruz"]', '["user_nora"]', '[{"teamA":18,"teamB":21}]', 'B', '{"user_cruz":-8,"user_nora":8}', '{"season_winter_2026":{"user_cruz":-7,"user_nora":7},"tournament_winter_cup_2026":{"user_cruz":-7,"user_nora":7}}', '2026-01-10T19:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_nora', 'active', NULL, NULL, NULL, '2026-01-10T19:00:00.000Z'),
  ('match_063', 'singles', 'best_of_3', 21, '["user_daya"]', '["user_milo"]', '[{"teamA":19,"teamB":21},{"teamA":21,"teamB":17},{"teamA":18,"teamB":21}]', 'B', '{"user_daya":-10,"user_milo":10}', '{"season_winter_2026":{"user_daya":-9,"user_milo":9},"tournament_winter_cup_2026":{"user_daya":-9,"user_milo":9}}', '2026-01-10T19:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_milo', 'active', NULL, NULL, NULL, '2026-01-10T19:30:00.000Z'),
  ('match_064', 'singles', 'single_game', 11, '["user_eli"]', '["user_lina"]', '[{"teamA":11,"teamB":9}]', 'A', '{"user_eli":7,"user_lina":-7}', '{"season_winter_2026":{"user_eli":6,"user_lina":-6},"tournament_winter_cup_2026":{"user_eli":6,"user_lina":-6}}', '2026-01-10T20:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_eli', 'active', NULL, NULL, NULL, '2026-01-10T20:00:00.000Z'),
  ('match_065', 'singles', 'best_of_3', 11, '["user_finn"]', '["user_kai"]', '[{"teamA":8,"teamB":11},{"teamA":11,"teamB":9}]', 'B', '{"user_finn":-9,"user_kai":9}', '{"season_winter_2026":{"user_finn":-8,"user_kai":8},"tournament_winter_cup_2026":{"user_finn":-8,"user_kai":8}}', '2026-01-10T20:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-01-10T20:30:00.000Z'),
  ('match_066', 'singles', 'single_game', 21, '["user_gina"]', '["user_jules"]', '[{"teamA":21,"teamB":12}]', 'A', '{"user_gina":9,"user_jules":-9}', '{"season_winter_2026":{"user_gina":8,"user_jules":-8},"tournament_winter_cup_2026":{"user_gina":8,"user_jules":-8}}', '2026-01-10T21:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-01-10T21:00:00.000Z'),
  ('match_067', 'singles', 'single_game', 11, '["user_hans"]', '["user_ivy"]', '[{"teamA":10,"teamB":11}]', 'B', '{"user_hans":-7,"user_ivy":7}', '{"season_winter_2026":{"user_hans":-6,"user_ivy":6},"tournament_winter_cup_2026":{"user_hans":-6,"user_ivy":6}}', '2026-01-10T21:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-01-10T21:30:00.000Z'),
  ('match_068', 'singles', 'best_of_3', 11, '["user_alex"]', '["user_bea"]', '[{"teamA":11,"teamB":9},{"teamA":11,"teamB":8}]', 'A', '{"user_alex":10,"user_bea":-10}', '{"season_winter_2026":{"user_alex":9,"user_bea":-9},"tournament_winter_cup_2026":{"user_alex":9,"user_bea":-9}}', '2026-01-12T18:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-01-12T18:00:00.000Z'),
  ('match_069', 'singles', 'single_game', 21, '["user_cruz"]', '["user_milo"]', '[{"teamA":19,"teamB":21}]', 'B', '{"user_cruz":-8,"user_milo":8}', '{"season_winter_2026":{"user_cruz":-7,"user_milo":7},"tournament_winter_cup_2026":{"user_cruz":-7,"user_milo":7}}', '2026-01-12T18:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_milo', 'active', NULL, NULL, NULL, '2026-01-12T18:30:00.000Z'),
  ('match_070', 'singles', 'best_of_3', 21, '["user_eli"]', '["user_kai"]', '[{"teamA":21,"teamB":18},{"teamA":18,"teamB":21},{"teamA":17,"teamB":21}]', 'B', '{"user_eli":-11,"user_kai":11}', '{"season_winter_2026":{"user_eli":-10,"user_kai":10},"tournament_winter_cup_2026":{"user_eli":-10,"user_kai":10}}', '2026-01-12T19:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-01-12T19:00:00.000Z'),
  ('match_071', 'singles', 'single_game', 11, '["user_gina"]', '["user_ivy"]', '[{"teamA":11,"teamB":6}]', 'A', '{"user_gina":8,"user_ivy":-8}', '{"season_winter_2026":{"user_gina":7,"user_ivy":-7},"tournament_winter_cup_2026":{"user_gina":7,"user_ivy":-7}}', '2026-01-12T19:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-01-12T19:30:00.000Z'),
  ('match_072', 'singles', 'best_of_3', 11, '["user_alex"]', '["user_milo"]', '[{"teamA":11,"teamB":7},{"teamA":11,"teamB":9}]', 'A', '{"user_alex":11,"user_milo":-11}', '{"season_winter_2026":{"user_alex":10,"user_milo":-10},"tournament_winter_cup_2026":{"user_alex":10,"user_milo":-10}}', '2026-01-15T18:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-01-15T18:00:00.000Z'),
  ('match_073', 'singles', 'best_of_3', 21, '["user_kai"]', '["user_gina"]', '[{"teamA":19,"teamB":21},{"teamA":21,"teamB":17},{"teamA":18,"teamB":21}]', 'B', '{"user_kai":-12,"user_gina":12}', '{"season_winter_2026":{"user_kai":-11,"user_gina":11},"tournament_winter_cup_2026":{"user_kai":-11,"user_gina":11}}', '2026-01-15T18:30:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-01-15T18:30:00.000Z'),
  ('match_074', 'singles', 'best_of_3', 21, '["user_alex"]', '["user_gina"]', '[{"teamA":21,"teamB":19},{"teamA":21,"teamB":17}]', 'A', '{"user_alex":13,"user_gina":-13}', '{"season_winter_2026":{"user_alex":12,"user_gina":-12},"tournament_winter_cup_2026":{"user_alex":12,"user_gina":-12}}', '2026-01-18T19:00:00.000Z', 'season_winter_2026', 'tournament_winter_cup_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-01-18T19:00:00.000Z'),
  ('match_080', 'singles', 'single_game', 11, '["user_gina"]', '["user_hans"]', '[{"teamA":11,"teamB":5}]', 'A', '{"user_gina":7,"user_hans":-7}', '{"season_spring_2026":{"user_gina":6,"user_hans":-6},"tournament_spring_masters_2026":{"user_gina":6,"user_hans":-6}}', '2026-03-02T18:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-03-02T18:00:00.000Z'),
  ('match_081', 'singles', 'best_of_3', 11, '["user_ivy"]', '["user_jules"]', '[{"teamA":11,"teamB":8},{"teamA":11,"teamB":6}]', 'A', '{"user_ivy":8,"user_jules":-8}', '{"season_spring_2026":{"user_ivy":7,"user_jules":-7},"tournament_spring_masters_2026":{"user_ivy":7,"user_jules":-7}}', '2026-03-02T18:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_ivy', 'active', NULL, NULL, NULL, '2026-03-02T18:30:00.000Z'),
  ('match_082', 'singles', 'single_game', 21, '["user_alex"]', '["user_bea"]', '[{"teamA":21,"teamB":18}]', 'A', '{"user_alex":8,"user_bea":-8}', '{"season_spring_2026":{"user_alex":7,"user_bea":-7},"tournament_spring_masters_2026":{"user_alex":7,"user_bea":-7}}', '2026-03-02T19:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_alex', 'active', NULL, NULL, NULL, '2026-03-02T19:00:00.000Z'),
  ('match_083', 'singles', 'best_of_3', 21, '["user_kai"]', '["user_lina"]', '[{"teamA":21,"teamB":18},{"teamA":17,"teamB":21},{"teamA":21,"teamB":15}]', 'A', '{"user_kai":10,"user_lina":-10}', '{"season_spring_2026":{"user_kai":9,"user_lina":-9},"tournament_spring_masters_2026":{"user_kai":9,"user_lina":-9}}', '2026-03-02T19:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-03-02T19:30:00.000Z'),
  ('match_084', 'singles', 'single_game', 11, '["user_cruz"]', '["user_oliver"]', '[{"teamA":10,"teamB":11}]', 'B', '{"user_cruz":-7,"user_oliver":7}', '{"season_spring_2026":{"user_cruz":-6,"user_oliver":6},"tournament_spring_masters_2026":{"user_cruz":-6,"user_oliver":6}}', '2026-03-02T20:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_oliver', 'active', NULL, NULL, NULL, '2026-03-02T20:00:00.000Z'),
  ('match_085', 'singles', 'best_of_3', 11, '["user_daya"]', '["user_pia"]', '[{"teamA":11,"teamB":9},{"teamA":8,"teamB":11},{"teamA":11,"teamB":7}]', 'A', '{"user_daya":11,"user_pia":-11}', '{"season_spring_2026":{"user_daya":10,"user_pia":-10},"tournament_spring_masters_2026":{"user_daya":10,"user_pia":-10}}', '2026-03-02T20:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_daya', 'active', NULL, NULL, NULL, '2026-03-02T20:30:00.000Z'),
  ('match_086', 'singles', 'single_game', 21, '["user_eli"]', '["user_milo"]', '[{"teamA":21,"teamB":17}]', 'A', '{"user_eli":9,"user_milo":-9}', '{"season_spring_2026":{"user_eli":8,"user_milo":-8},"tournament_spring_masters_2026":{"user_eli":8,"user_milo":-8}}', '2026-03-02T21:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_eli', 'active', NULL, NULL, NULL, '2026-03-02T21:00:00.000Z'),
  ('match_087', 'singles', 'best_of_3', 11, '["user_finn"]', '["user_nora"]', '[{"teamA":9,"teamB":11},{"teamA":11,"teamB":8},{"teamA":10,"teamB":12}]', 'B', '{"user_finn":-10,"user_nora":10}', '{"season_spring_2026":{"user_finn":-9,"user_nora":9},"tournament_spring_masters_2026":{"user_finn":-9,"user_nora":9}}', '2026-03-02T21:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_nora', 'active', NULL, NULL, NULL, '2026-03-02T21:30:00.000Z'),
  ('match_088', 'singles', 'single_game', 11, '["user_gina"]', '["user_ivy"]', '[{"teamA":11,"teamB":7}]', 'A', '{"user_gina":8,"user_ivy":-8}', '{"season_spring_2026":{"user_gina":7,"user_ivy":-7},"tournament_spring_masters_2026":{"user_gina":7,"user_ivy":-7}}', '2026-03-05T18:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-03-05T18:00:00.000Z'),
  ('match_089', 'singles', 'best_of_3', 21, '["user_alex"]', '["user_kai"]', '[{"teamA":19,"teamB":21},{"teamA":21,"teamB":17},{"teamA":18,"teamB":21}]', 'B', '{"user_alex":-11,"user_kai":11}', '{"season_spring_2026":{"user_alex":-10,"user_kai":10},"tournament_spring_masters_2026":{"user_alex":-10,"user_kai":10}}', '2026-03-05T18:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_kai', 'active', NULL, NULL, NULL, '2026-03-05T18:30:00.000Z'),
  ('match_090', 'singles', 'single_game', 11, '["user_cruz"]', '["user_daya"]', '[{"teamA":11,"teamB":9}]', 'A', '{"user_cruz":8,"user_daya":-8}', '{"season_spring_2026":{"user_cruz":7,"user_daya":-7},"tournament_spring_masters_2026":{"user_cruz":7,"user_daya":-7}}', '2026-03-05T19:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_cruz', 'active', NULL, NULL, NULL, '2026-03-05T19:00:00.000Z'),
  ('match_091', 'singles', 'best_of_3', 11, '["user_eli"]', '["user_nora"]', '[{"teamA":11,"teamB":6},{"teamA":9,"teamB":11},{"teamA":11,"teamB":8}]', 'A', '{"user_eli":10,"user_nora":-10}', '{"season_spring_2026":{"user_eli":9,"user_nora":-9},"tournament_spring_masters_2026":{"user_eli":9,"user_nora":-9}}', '2026-03-05T19:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_eli', 'active', NULL, NULL, NULL, '2026-03-05T19:30:00.000Z'),
  ('match_092', 'singles', 'single_game', 21, '["user_gina"]', '["user_kai"]', '[{"teamA":21,"teamB":16}]', 'A', '{"user_gina":9,"user_kai":-9}', '{"season_spring_2026":{"user_gina":8,"user_kai":-8},"tournament_spring_masters_2026":{"user_gina":8,"user_kai":-8}}', '2026-03-08T18:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-03-08T18:00:00.000Z'),
  ('match_093', 'singles', 'best_of_3', 21, '["user_daya"]', '["user_eli"]', '[{"teamA":18,"teamB":21},{"teamA":21,"teamB":19},{"teamA":20,"teamB":21}]', 'B', '{"user_daya":-12,"user_eli":12}', '{"season_spring_2026":{"user_daya":-11,"user_eli":11},"tournament_spring_masters_2026":{"user_daya":-11,"user_eli":11}}', '2026-03-08T18:30:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_eli', 'active', NULL, NULL, NULL, '2026-03-08T18:30:00.000Z'),
  ('match_094', 'singles', 'best_of_3', 21, '["user_gina"]', '["user_eli"]', '[{"teamA":21,"teamB":18},{"teamA":21,"teamB":17}]', 'A', '{"user_gina":13,"user_eli":-13}', '{"season_spring_2026":{"user_gina":12,"user_eli":-12},"tournament_spring_masters_2026":{"user_gina":12,"user_eli":-12}}', '2026-03-12T19:00:00.000Z', 'season_spring_2026', 'tournament_spring_masters_2026', 'user_gina', 'active', NULL, NULL, NULL, '2026-03-12T19:00:00.000Z'),
  ('match_095', 'singles', 'best_of_3', 11, '["user_oliver"]', '["user_pia"]', '[{"teamA":9,"teamB":11},{"teamA":11,"teamB":8},{"teamA":10,"teamB":12}]', 'B', '{"user_oliver":-9,"user_pia":9}', '{}', '2026-01-20T18:00:00.000Z', 'season_winter_2026', NULL, 'user_oliver', 'deleted', '2026-01-20T20:00:00.000Z', 'user_oliver', 'Duplicate import', '2026-01-20T18:00:00.000Z'),
  ('match_096', 'singles', 'best_of_3', 11, '["user_oliver"]', '["user_pia"]', '[{"teamA":9,"teamB":11},{"teamA":11,"teamB":8},{"teamA":10,"teamB":12}]', 'B', '{"user_oliver":-9,"user_pia":9}', '{"season_winter_2026":{"user_oliver":-8,"user_pia":8}}', '2026-01-21T18:00:00.000Z', 'season_winter_2026', NULL, 'user_pia', 'active', NULL, NULL, NULL, '2026-01-21T18:00:00.000Z');

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_berlin_sf_1', 'tournament_berlin_open_2026', 0, 'Semifinals', 0, 'user_bea', 'user_eli', 'match_006', 'user_bea', 1, 0),
  ('tbm_berlin_sf_2', 'tournament_berlin_open_2026', 0, 'Semifinals', 1, 'user_alex', 'user_finn', 'match_005', 'user_alex', 1, 0),
  ('tbm_berlin_final', 'tournament_berlin_open_2026', 1, 'Final', 0, 'user_bea', 'user_alex', NULL, NULL, 0, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_summer_qf_1', 'tournament_summer_cup_2026', 0, 'Quarterfinals', 0, 'user_gina', 'user_hans', 'match_031', 'user_gina', 1, 0),
  ('tbm_summer_qf_2', 'tournament_summer_cup_2026', 0, 'Quarterfinals', 1, 'user_ivy', 'user_jules', 'match_032', 'user_ivy', 1, 0),
  ('tbm_summer_qf_3', 'tournament_summer_cup_2026', 0, 'Quarterfinals', 2, 'user_alex', 'user_bea', 'match_033', 'user_alex', 1, 0),
  ('tbm_summer_qf_4', 'tournament_summer_cup_2026', 0, 'Quarterfinals', 3, 'user_kai', 'user_lina', 'match_034', 'user_kai', 1, 0),
  ('tbm_summer_sf_1', 'tournament_summer_cup_2026', 1, 'Semifinals', 0, 'user_gina', 'user_ivy', 'match_035', 'user_gina', 1, 0),
  ('tbm_summer_sf_2', 'tournament_summer_cup_2026', 1, 'Semifinals', 1, 'user_alex', 'user_kai', 'match_036', 'user_kai', 1, 0),
  ('tbm_summer_final', 'tournament_summer_cup_2026', 2, 'Final', 0, 'user_gina', 'user_kai', 'match_037', 'user_gina', 1, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_open_sf_1', 'tournament_open_clash_2026', 0, 'Semifinals', 0, 'user_ivy', 'user_jules', 'match_042', 'user_ivy', 1, 0),
  ('tbm_open_sf_2', 'tournament_open_clash_2026', 0, 'Semifinals', 1, 'user_milo', 'user_nora', 'match_043', 'user_nora', 1, 0),
  ('tbm_open_final', 'tournament_open_clash_2026', 1, 'Final', 0, 'user_ivy', 'user_nora', NULL, NULL, 0, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_deleted_sf_1', 'tournament_deleted_trial_2026', 0, 'Semifinals', 0, 'user_bea', 'user_cruz', NULL, NULL, 0, 0),
  ('tbm_deleted_sf_2', 'tournament_deleted_trial_2026', 0, 'Semifinals', 1, 'user_daya', 'user_finn', NULL, NULL, 0, 0),
  ('tbm_deleted_final', 'tournament_deleted_trial_2026', 1, 'Final', 0, 'user_bea', 'user_daya', NULL, NULL, 0, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_winter_r16_1', 'tournament_winter_cup_2026', 0, 'Round of 16', 0, 'user_alex', 'user_pia', 'match_060', 'user_alex', 1, 0),
  ('tbm_winter_r16_2', 'tournament_winter_cup_2026', 0, 'Round of 16', 1, 'user_bea', 'user_oliver', 'match_061', 'user_bea', 1, 0),
  ('tbm_winter_r16_3', 'tournament_winter_cup_2026', 0, 'Round of 16', 2, 'user_cruz', 'user_nora', 'match_062', 'user_nora', 1, 0),
  ('tbm_winter_r16_4', 'tournament_winter_cup_2026', 0, 'Round of 16', 3, 'user_daya', 'user_milo', 'match_063', 'user_milo', 1, 0),
  ('tbm_winter_r16_5', 'tournament_winter_cup_2026', 0, 'Round of 16', 4, 'user_eli', 'user_lina', 'match_064', 'user_eli', 1, 0),
  ('tbm_winter_r16_6', 'tournament_winter_cup_2026', 0, 'Round of 16', 5, 'user_finn', 'user_kai', 'match_065', 'user_kai', 1, 0),
  ('tbm_winter_r16_7', 'tournament_winter_cup_2026', 0, 'Round of 16', 6, 'user_gina', 'user_jules', 'match_066', 'user_gina', 1, 0),
  ('tbm_winter_r16_8', 'tournament_winter_cup_2026', 0, 'Round of 16', 7, 'user_hans', 'user_ivy', 'match_067', 'user_ivy', 1, 0),
  ('tbm_winter_qf_1', 'tournament_winter_cup_2026', 1, 'Quarterfinals', 0, 'user_alex', 'user_bea', 'match_068', 'user_alex', 1, 0),
  ('tbm_winter_qf_2', 'tournament_winter_cup_2026', 1, 'Quarterfinals', 1, 'user_nora', 'user_milo', 'match_069', 'user_milo', 1, 0),
  ('tbm_winter_qf_3', 'tournament_winter_cup_2026', 1, 'Quarterfinals', 2, 'user_eli', 'user_kai', 'match_070', 'user_kai', 1, 0),
  ('tbm_winter_qf_4', 'tournament_winter_cup_2026', 1, 'Quarterfinals', 3, 'user_gina', 'user_ivy', 'match_071', 'user_gina', 1, 0),
  ('tbm_winter_sf_1', 'tournament_winter_cup_2026', 2, 'Semifinals', 0, 'user_alex', 'user_milo', 'match_072', 'user_alex', 1, 0),
  ('tbm_winter_sf_2', 'tournament_winter_cup_2026', 2, 'Semifinals', 1, 'user_kai', 'user_gina', 'match_073', 'user_gina', 1, 0),
  ('tbm_winter_final', 'tournament_winter_cup_2026', 3, 'Final', 0, 'user_alex', 'user_gina', 'match_074', 'user_alex', 1, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_spring_r16_1', 'tournament_spring_masters_2026', 0, 'Round of 16', 0, 'user_gina', 'user_hans', 'match_080', 'user_gina', 1, 0),
  ('tbm_spring_r16_2', 'tournament_spring_masters_2026', 0, 'Round of 16', 1, 'user_ivy', 'user_jules', 'match_081', 'user_ivy', 1, 0),
  ('tbm_spring_r16_3', 'tournament_spring_masters_2026', 0, 'Round of 16', 2, 'user_alex', 'user_bea', 'match_082', 'user_alex', 1, 0),
  ('tbm_spring_r16_4', 'tournament_spring_masters_2026', 0, 'Round of 16', 3, 'user_kai', 'user_lina', 'match_083', 'user_kai', 1, 0),
  ('tbm_spring_r16_5', 'tournament_spring_masters_2026', 0, 'Round of 16', 4, 'user_cruz', 'user_oliver', 'match_084', 'user_oliver', 1, 0),
  ('tbm_spring_r16_6', 'tournament_spring_masters_2026', 0, 'Round of 16', 5, 'user_daya', 'user_pia', 'match_085', 'user_daya', 1, 0),
  ('tbm_spring_r16_7', 'tournament_spring_masters_2026', 0, 'Round of 16', 6, 'user_eli', 'user_milo', 'match_086', 'user_eli', 1, 0),
  ('tbm_spring_r16_8', 'tournament_spring_masters_2026', 0, 'Round of 16', 7, 'user_finn', 'user_nora', 'match_087', 'user_nora', 1, 0),
  ('tbm_spring_qf_1', 'tournament_spring_masters_2026', 1, 'Quarterfinals', 0, 'user_gina', 'user_ivy', 'match_088', 'user_gina', 1, 0),
  ('tbm_spring_qf_2', 'tournament_spring_masters_2026', 1, 'Quarterfinals', 1, 'user_alex', 'user_kai', 'match_089', 'user_kai', 1, 0),
  ('tbm_spring_qf_3', 'tournament_spring_masters_2026', 1, 'Quarterfinals', 2, 'user_cruz', 'user_daya', 'match_090', 'user_cruz', 1, 0),
  ('tbm_spring_qf_4', 'tournament_spring_masters_2026', 1, 'Quarterfinals', 3, 'user_eli', 'user_nora', 'match_091', 'user_eli', 1, 0),
  ('tbm_spring_sf_1', 'tournament_spring_masters_2026', 2, 'Semifinals', 0, 'user_gina', 'user_kai', 'match_092', 'user_gina', 1, 0),
  ('tbm_spring_sf_2', 'tournament_spring_masters_2026', 2, 'Semifinals', 1, 'user_cruz', 'user_eli', 'match_093', 'user_eli', 1, 0),
  ('tbm_spring_final', 'tournament_spring_masters_2026', 3, 'Final', 0, 'user_gina', 'user_eli', 'match_094', 'user_gina', 1, 1);

INSERT INTO tournament_bracket_matches (
  id, tournament_id, round_index, round_title, match_index, left_player_id, right_player_id,
  created_match_id, winner_player_id, locked, is_final
) VALUES
  ('tbm_autumn_qf_1', 'tournament_autumn_preview_2026', 0, 'Quarterfinals', 0, 'user_ivy', 'user_jules', NULL, NULL, 0, 0),
  ('tbm_autumn_qf_2', 'tournament_autumn_preview_2026', 0, 'Quarterfinals', 1, 'user_kai', 'user_lina', NULL, NULL, 0, 0),
  ('tbm_autumn_qf_3', 'tournament_autumn_preview_2026', 0, 'Quarterfinals', 2, 'user_milo', 'user_nora', NULL, NULL, 0, 0),
  ('tbm_autumn_qf_4', 'tournament_autumn_preview_2026', 0, 'Quarterfinals', 3, 'user_oliver', 'user_pia', NULL, NULL, 0, 0);

INSERT INTO match_players (match_id, user_id, team) VALUES
  ('match_019', 'user_alex', 'A'),
  ('match_019', 'user_bea', 'B'),
  ('match_018', 'user_cruz', 'A'),
  ('match_018', 'user_daya', 'A'),
  ('match_018', 'user_eli', 'B'),
  ('match_018', 'user_finn', 'B'),
  ('match_017', 'user_bea', 'A'),
  ('match_017', 'user_daya', 'B'),
  ('match_016', 'user_alex', 'A'),
  ('match_016', 'user_eli', 'A'),
  ('match_016', 'user_bea', 'B'),
  ('match_016', 'user_cruz', 'B'),
  ('match_015', 'user_finn', 'A'),
  ('match_015', 'user_cruz', 'B'),
  ('match_014', 'user_alex', 'A'),
  ('match_014', 'user_daya', 'A'),
  ('match_014', 'user_bea', 'B'),
  ('match_014', 'user_finn', 'B'),
  ('match_013', 'user_bea', 'A'),
  ('match_013', 'user_cruz', 'A'),
  ('match_013', 'user_alex', 'B'),
  ('match_013', 'user_finn', 'B'),
  ('match_012', 'user_eli', 'A'),
  ('match_012', 'user_daya', 'B'),
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

INSERT INTO match_players (match_id, user_id, team) VALUES
  ('match_043', 'user_milo', 'A'),
  ('match_043', 'user_nora', 'B'),
  ('match_042', 'user_ivy', 'A'),
  ('match_042', 'user_jules', 'B'),
  ('match_041', 'user_kai', 'A'),
  ('match_041', 'user_lina', 'A'),
  ('match_041', 'user_bea', 'B'),
  ('match_041', 'user_hans', 'B'),
  ('match_040', 'user_gina', 'A'),
  ('match_040', 'user_jules', 'A'),
  ('match_040', 'user_alex', 'B'),
  ('match_040', 'user_lina', 'B'),
  ('match_039', 'user_hans', 'A'),
  ('match_039', 'user_jules', 'B'),
  ('match_038', 'user_ivy', 'A'),
  ('match_038', 'user_jules', 'B'),
  ('match_037', 'user_gina', 'A'),
  ('match_037', 'user_kai', 'B'),
  ('match_036', 'user_alex', 'A'),
  ('match_036', 'user_kai', 'B'),
  ('match_035', 'user_gina', 'A'),
  ('match_035', 'user_ivy', 'A'),
  ('match_035', 'user_bea', 'B'),
  ('match_035', 'user_kai', 'B'),
  ('match_034', 'user_kai', 'A'),
  ('match_034', 'user_lina', 'B'),
  ('match_033', 'user_alex', 'A'),
  ('match_033', 'user_ivy', 'A'),
  ('match_033', 'user_bea', 'B'),
  ('match_033', 'user_kai', 'B'),
  ('match_032', 'user_gina', 'A'),
  ('match_032', 'user_hans', 'B'),
  ('match_031', 'user_gina', 'A'),
  ('match_031', 'user_hans', 'B'),
  ('match_030', 'user_alex', 'A'),
  ('match_030', 'user_kai', 'B'),
  ('match_029', 'user_gina', 'A'),
  ('match_029', 'user_ivy', 'B'),
  ('match_028', 'user_kai', 'A'),
  ('match_028', 'user_lina', 'B'),
  ('match_027', 'user_alex', 'A'),
  ('match_027', 'user_bea', 'A'),
  ('match_027', 'user_kai', 'B'),
  ('match_027', 'user_lina', 'B'),
  ('match_026', 'user_ivy', 'A'),
  ('match_026', 'user_jules', 'B'),
  ('match_025', 'user_gina', 'A'),
  ('match_025', 'user_hans', 'B'),
  ('match_024', 'user_jules', 'A'),
  ('match_024', 'user_hans', 'B'),
  ('match_023', 'user_gina', 'A'),
  ('match_023', 'user_kai', 'A'),
  ('match_023', 'user_bea', 'B'),
  ('match_023', 'user_milo', 'B'),
  ('match_022', 'user_hans', 'A'),
  ('match_022', 'user_ivy', 'B'),
  ('match_021', 'user_nora', 'A'),
  ('match_021', 'user_lina', 'A'),
  ('match_021', 'user_milo', 'B'),
  ('match_021', 'user_jules', 'B'),
  ('match_020', 'user_alex', 'A'),
  ('match_020', 'user_gina', 'B');

INSERT INTO match_players (match_id, user_id, team) VALUES
  ('match_096', 'user_oliver', 'A'),
  ('match_096', 'user_pia', 'B'),
  ('match_095', 'user_oliver', 'A'),
  ('match_095', 'user_pia', 'B'),
  ('match_094', 'user_gina', 'A'),
  ('match_094', 'user_eli', 'B'),
  ('match_093', 'user_daya', 'A'),
  ('match_093', 'user_eli', 'B'),
  ('match_092', 'user_gina', 'A'),
  ('match_092', 'user_kai', 'B'),
  ('match_091', 'user_eli', 'A'),
  ('match_091', 'user_nora', 'B'),
  ('match_090', 'user_cruz', 'A'),
  ('match_090', 'user_daya', 'B'),
  ('match_089', 'user_alex', 'A'),
  ('match_089', 'user_kai', 'B'),
  ('match_088', 'user_gina', 'A'),
  ('match_088', 'user_ivy', 'B'),
  ('match_087', 'user_finn', 'A'),
  ('match_087', 'user_nora', 'B'),
  ('match_086', 'user_eli', 'A'),
  ('match_086', 'user_milo', 'B'),
  ('match_085', 'user_daya', 'A'),
  ('match_085', 'user_pia', 'B'),
  ('match_084', 'user_cruz', 'A'),
  ('match_084', 'user_oliver', 'B'),
  ('match_083', 'user_kai', 'A'),
  ('match_083', 'user_lina', 'B'),
  ('match_082', 'user_alex', 'A'),
  ('match_082', 'user_bea', 'B'),
  ('match_081', 'user_ivy', 'A'),
  ('match_081', 'user_jules', 'B'),
  ('match_080', 'user_gina', 'A'),
  ('match_080', 'user_hans', 'B'),
  ('match_074', 'user_alex', 'A'),
  ('match_074', 'user_gina', 'B'),
  ('match_073', 'user_kai', 'A'),
  ('match_073', 'user_gina', 'B'),
  ('match_072', 'user_alex', 'A'),
  ('match_072', 'user_milo', 'B'),
  ('match_071', 'user_gina', 'A'),
  ('match_071', 'user_ivy', 'B'),
  ('match_070', 'user_eli', 'A'),
  ('match_070', 'user_kai', 'B'),
  ('match_069', 'user_cruz', 'A'),
  ('match_069', 'user_milo', 'B'),
  ('match_068', 'user_alex', 'A'),
  ('match_068', 'user_bea', 'B'),
  ('match_067', 'user_hans', 'A'),
  ('match_067', 'user_ivy', 'B'),
  ('match_066', 'user_gina', 'A'),
  ('match_066', 'user_jules', 'B'),
  ('match_065', 'user_finn', 'A'),
  ('match_065', 'user_kai', 'B'),
  ('match_064', 'user_eli', 'A'),
  ('match_064', 'user_lina', 'B'),
  ('match_063', 'user_daya', 'A'),
  ('match_063', 'user_milo', 'B'),
  ('match_062', 'user_cruz', 'A'),
  ('match_062', 'user_nora', 'B'),
  ('match_061', 'user_bea', 'A'),
  ('match_061', 'user_oliver', 'B'),
  ('match_060', 'user_alex', 'A'),
  ('match_060', 'user_pia', 'B');

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

INSERT INTO elo_segments (
  id, segment_type, segment_id, user_id, elo, matches_played, matches_played_equivalent, wins, losses, streak, last_match_at, updated_at
) VALUES
  ('seg_season_summer_alex', 'season', 'season_summer_2026', 'user_alex', 1294, 6, 6, 5, 1, 2, '2026-04-25T19:00:00.000Z', '2026-04-28T19:00:00.000Z'),
  ('seg_season_summer_bea', 'season', 'season_summer_2026', 'user_bea', 1236, 3, 3, 1, 2, -2, '2026-04-27T18:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_gina', 'season', 'season_summer_2026', 'user_gina', 1418, 5, 5, 5, 0, 5, '2026-04-28T19:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_hans', 'season', 'season_summer_2026', 'user_hans', 1022, 4, 4, 0, 4, -4, '2026-04-27T18:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_ivy', 'season', 'season_summer_2026', 'user_ivy', 1248, 2, 2, 1, 1, 1, '2026-04-28T19:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_jules', 'season', 'season_summer_2026', 'user_jules', 1186, 2, 2, 0, 2, -2, '2026-04-25T19:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_kai', 'season', 'season_summer_2026', 'user_kai', 1298, 5, 5, 4, 1, 3, '2026-04-27T18:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_season_summer_lina', 'season', 'season_summer_2026', 'user_lina', 1240, 3, 3, 1, 2, 1, '2026-04-27T18:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_alex', 'tournament', 'tournament_summer_cup_2026', 'user_alex', 1274, 3, 3, 2, 1, 1, '2026-04-28T18:20:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_bea', 'tournament', 'tournament_summer_cup_2026', 'user_bea', 1224, 1, 1, 0, 1, -1, '2026-04-18T15:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_gina', 'tournament', 'tournament_summer_cup_2026', 'user_gina', 1432, 3, 3, 3, 0, 3, '2026-04-28T19:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_hans', 'tournament', 'tournament_summer_cup_2026', 'user_hans', 1014, 3, 3, 0, 3, -3, '2026-04-28T10:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_ivy', 'tournament', 'tournament_summer_cup_2026', 'user_ivy', 1266, 2, 2, 1, 1, -1, '2026-04-28T17:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_jules', 'tournament', 'tournament_summer_cup_2026', 'user_jules', 1190, 1, 1, 0, 1, -1, '2026-04-18T11:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_kai', 'tournament', 'tournament_summer_cup_2026', 'user_kai', 1310, 3, 3, 2, 1, -1, '2026-04-28T19:30:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_summer_lina', 'tournament', 'tournament_summer_cup_2026', 'user_lina', 1252, 1, 1, 0, 1, -1, '2026-04-18T16:00:00.000Z', '2026-04-28T20:00:00.000Z'),
  ('seg_tournament_open_ivy', 'tournament', 'tournament_open_clash_2026', 'user_ivy', 1258, 1, 1, 1, 0, 1, '2026-04-20T19:00:00.000Z', '2026-04-20T20:00:00.000Z'),
  ('seg_tournament_open_jules', 'tournament', 'tournament_open_clash_2026', 'user_jules', 1184, 1, 1, 0, 1, -1, '2026-04-20T19:00:00.000Z', '2026-04-20T20:00:00.000Z'),
  ('seg_tournament_open_milo', 'tournament', 'tournament_open_clash_2026', 'user_milo', 1150, 1, 1, 0, 1, -1, '2026-04-20T20:00:00.000Z', '2026-04-20T20:00:00.000Z'),
  ('seg_tournament_open_nora', 'tournament', 'tournament_open_clash_2026', 'user_nora', 1318, 1, 1, 1, 0, 1, '2026-04-20T20:00:00.000Z', '2026-04-20T20:00:00.000Z');

PRAGMA foreign_keys = OFF;
