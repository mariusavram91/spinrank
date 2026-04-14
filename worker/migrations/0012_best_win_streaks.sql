ALTER TABLE users ADD COLUMN best_win_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elo_segments ADD COLUMN best_win_streak INTEGER NOT NULL DEFAULT 0;

WITH ordered_matches AS (
  SELECT
    mp.user_id,
    CASE WHEN m.winner_team = mp.team THEN 1 ELSE 0 END AS did_win,
    SUM(CASE WHEN m.winner_team = mp.team THEN 0 ELSE 1 END) OVER (
      PARTITION BY mp.user_id
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS loss_group
  FROM matches m
  INNER JOIN match_players mp
    ON mp.match_id = m.id
  WHERE m.status = 'active'
),
global_best_streaks AS (
  SELECT user_id, MAX(win_streak) AS best_win_streak
  FROM (
    SELECT user_id, loss_group, COUNT(*) AS win_streak
    FROM ordered_matches
    WHERE did_win = 1
    GROUP BY user_id, loss_group
  )
  GROUP BY user_id
)
UPDATE users
SET best_win_streak = COALESCE(
  (
    SELECT global_best_streaks.best_win_streak
    FROM global_best_streaks
    WHERE global_best_streaks.user_id = users.id
  ),
  0
);

WITH segment_matches AS (
  SELECT
    'season' AS segment_type,
    m.season_id AS segment_id,
    mp.user_id,
    CASE WHEN m.winner_team = mp.team THEN 1 ELSE 0 END AS did_win,
    m.played_at,
    m.created_at,
    m.id
  FROM matches m
  INNER JOIN match_players mp
    ON mp.match_id = m.id
  WHERE m.status = 'active'
    AND m.season_id IS NOT NULL

  UNION ALL

  SELECT
    'tournament' AS segment_type,
    m.tournament_id AS segment_id,
    mp.user_id,
    CASE WHEN m.winner_team = mp.team THEN 1 ELSE 0 END AS did_win,
    m.played_at,
    m.created_at,
    m.id
  FROM matches m
  INNER JOIN match_players mp
    ON mp.match_id = m.id
  WHERE m.status = 'active'
    AND m.tournament_id IS NOT NULL
),
ordered_segment_matches AS (
  SELECT
    segment_type,
    segment_id,
    user_id,
    did_win,
    SUM(CASE WHEN did_win = 1 THEN 0 ELSE 1 END) OVER (
      PARTITION BY segment_type, segment_id, user_id
      ORDER BY played_at ASC, created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS loss_group
  FROM segment_matches
),
segment_best_streaks AS (
  SELECT segment_type, segment_id, user_id, MAX(win_streak) AS best_win_streak
  FROM (
    SELECT segment_type, segment_id, user_id, loss_group, COUNT(*) AS win_streak
    FROM ordered_segment_matches
    WHERE did_win = 1
    GROUP BY segment_type, segment_id, user_id, loss_group
  )
  GROUP BY segment_type, segment_id, user_id
)
UPDATE elo_segments
SET best_win_streak = COALESCE(
  (
    SELECT segment_best_streaks.best_win_streak
    FROM segment_best_streaks
    WHERE segment_best_streaks.segment_type = elo_segments.segment_type
      AND segment_best_streaks.segment_id = elo_segments.segment_id
      AND segment_best_streaks.user_id = elo_segments.user_id
  ),
  0
);
