INSERT INTO achievement_definitions (key, category, tier, points, sort_order, active) VALUES
  ('matches_250', 'activity', 'platinum', 350, 58, 1),
  ('matches_500', 'activity', 'platinum', 600, 59, 1),
  ('matches_1000', 'activity', 'platinum', 1200, 60, 1),
  ('win_streak_7', 'performance', 'gold', 120, 70, 1),
  ('iron_wall_10', 'performance', 'gold', 140, 71, 1),
  ('perfect_11_0', 'performance', 'silver', 75, 72, 1),
  ('perfect_21_0', 'performance', 'gold', 130, 73, 1),
  ('blowout_11_4', 'performance', 'silver', 70, 74, 1),
  ('blowout_21_9', 'performance', 'gold', 120, 74, 1),
  ('rank_top_10', 'performance', 'silver', 80, 75, 1),
  ('marathon_match', 'activity', 'silver', 80, 76, 1),
  ('lucky_numbers', 'performance', 'silver', 80, 77, 1),
  ('mirror_match', 'performance', 'silver', 50, 78, 1),
  ('style_points', 'performance', 'silver', 75, 79, 1),
  ('rank_dynasty_10', 'performance', 'platinum', 220, 91, 1),
  ('top_five_defender_5', 'performance', 'gold', 140, 92, 1),
  ('upset_victory', 'performance', 'gold', 120, 93, 1),
  ('positive_record_60', 'performance', 'gold', 150, 94, 1),
  ('dominant_era_70', 'performance', 'platinum', 220, 95, 1),
  ('season_podium', 'community', 'silver', 90, 111, 1),
  ('season_winner', 'community', 'gold', 160, 112, 1),
  ('season_podiums_3', 'community', 'gold', 180, 113, 1),
  ('season_wins_3', 'community', 'platinum', 260, 114, 1),
  ('season_top3', 'community', 'gold', 120, 115, 1),
  ('season_champion', 'community', 'platinum', 220, 116, 1),
  ('tournament_finalist', 'community', 'silver', 95, 131, 1),
  ('tournament_winner', 'community', 'gold', 170, 132, 1),
  ('tournament_finals_3', 'community', 'gold', 190, 133, 1),
  ('tournament_wins_3', 'community', 'platinum', 280, 134, 1),
  ('squad_goals', 'community', 'silver', 90, 135, 1),
  ('rivalry_begins', 'community', 'silver', 60, 136, 1),
  ('arch_rival', 'community', 'gold', 120, 137, 1),
  ('weekly_warrior_4', 'community', 'silver', 80, 138, 1),
  ('all_rounder', 'community', 'gold', 140, 139, 1),
  ('deuce_master', 'performance', 'silver', 80, 144, 1),
  ('ice_cold', 'performance', 'silver', 70, 145, 1),
  ('clutch_player', 'performance', 'silver', 90, 146, 1),
  ('comeback_king', 'performance', 'gold', 110, 147, 1),
  ('completionist_25', 'community', 'gold', 130, 148, 1),
  ('completionist_50', 'community', 'platinum', 260, 149, 1),
  ('completionist_75', 'community', 'platinum', 420, 150, 1)
ON CONFLICT(key) DO UPDATE SET
  category = excluded.category,
  tier = excluded.tier,
  points = excluded.points,
  sort_order = excluded.sort_order,
  active = excluded.active;

INSERT INTO user_achievements (
  user_id,
  achievement_key,
  unlocked_at,
  progress_value,
  progress_target,
  last_evaluated_at,
  context_json
)
SELECT
  user_id,
  'win_streak_7',
  unlocked_at,
  progress_value,
  progress_target,
  last_evaluated_at,
  context_json
FROM user_achievements
WHERE achievement_key = 'win_streak_5'
ON CONFLICT(user_id, achievement_key) DO UPDATE SET
  unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at),
  progress_value = MAX(user_achievements.progress_value, excluded.progress_value),
  progress_target = COALESCE(user_achievements.progress_target, excluded.progress_target),
  last_evaluated_at = MAX(user_achievements.last_evaluated_at, excluded.last_evaluated_at),
  context_json = CASE
    WHEN user_achievements.context_json = '{}' AND excluded.context_json <> '{}' THEN excluded.context_json
    ELSE user_achievements.context_json
  END;

DELETE FROM user_achievements
WHERE achievement_key = 'win_streak_5';

UPDATE achievement_definitions
SET active = 0
WHERE key = 'win_streak_5';
