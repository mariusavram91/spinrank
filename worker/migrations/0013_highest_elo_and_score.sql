ALTER TABLE users ADD COLUMN highest_global_elo INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE elo_segments ADD COLUMN highest_score INTEGER NOT NULL DEFAULT 0;

WITH ordered_global_matches AS (
  SELECT
    mp.user_id,
    1200 + SUM(COALESCE(CAST(json_extract(m.global_elo_delta_json, '$.' || mp.user_id) AS INTEGER), 0)) OVER (
      PARTITION BY mp.user_id
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_elo
  FROM matches m
  INNER JOIN match_players mp
    ON mp.match_id = m.id
  WHERE m.status = 'active'
),
global_highest_elo AS (
  SELECT user_id, MAX(running_elo) AS highest_global_elo
  FROM ordered_global_matches
  GROUP BY user_id
)
UPDATE users
SET highest_global_elo = COALESCE(
  (
    SELECT global_highest_elo.highest_global_elo
    FROM global_highest_elo
    WHERE global_highest_elo.user_id = users.id
  ),
  1200
);

UPDATE elo_segments
SET highest_score = COALESCE(season_conservative_rating, elo, 0) - COALESCE(season_attendance_penalty, 0)
WHERE segment_type = 'season';
