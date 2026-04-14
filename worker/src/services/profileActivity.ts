import { dateOnly, isoNow } from "../db";
import type { ActivityHeatmapData, ActivityHeatmapDay, Env } from "../types";

const HEATMAP_WEEKS = 53;

type ActivityHeatmapRow = {
  activity_date: string;
  matches: number;
  wins: number;
  losses: number;
};

const buildVisibilityJoins = (): string => `
  LEFT JOIN seasons s
    ON s.id = m.season_id
  LEFT JOIN season_participants sp
    ON sp.season_id = m.season_id AND sp.user_id = ?1
  LEFT JOIN tournaments t
    ON t.id = m.tournament_id
  LEFT JOIN tournament_participants tp
    ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
`;

const buildVisibilityPredicate = (): string => `
  m.status = 'active'
  AND (
    (m.season_id IS NULL AND m.tournament_id IS NULL)
    OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
    OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
      s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
    ))
  )
`;

function toWeekStart(date: Date): string {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - day + 1);
  return normalized.toISOString().slice(0, 10);
}

function getHeatmapRange(endDate: string): { startDate: string; endDate: string } {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  const day = end.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - (HEATMAP_WEEKS - 1) * 7 - day + 1);
  return {
    startDate: toWeekStart(start),
    endDate,
  };
}

export async function getProfileActivityHeatmap(
  env: Env,
  viewerUserId: string,
  targetUserId: string,
): Promise<ActivityHeatmapData> {
  const todayDate = dateOnly(isoNow(env.runtime));
  const latestMatch = await env.DB.prepare(
    `
      SELECT MAX(substr(m.played_at, 1, 10)) AS latest_played_date
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      ${buildVisibilityJoins()}
      WHERE mp.user_id = ?2
        AND ${buildVisibilityPredicate()}
    `,
  )
    .bind(viewerUserId, targetUserId)
    .first<{ latest_played_date: string | null }>();

  const effectiveEndDate =
    latestMatch?.latest_played_date && latestMatch.latest_played_date > todayDate
      ? latestMatch.latest_played_date
      : todayDate;
  const { startDate, endDate } = getHeatmapRange(effectiveEndDate);
  const rows = await env.DB.prepare(
    `
      SELECT
        substr(m.played_at, 1, 10) AS activity_date,
        COUNT(*) AS matches,
        SUM(CASE WHEN mp.team = m.winner_team THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN mp.team != m.winner_team THEN 1 ELSE 0 END) AS losses
      FROM match_players mp
      JOIN matches m
        ON m.id = mp.match_id
      ${buildVisibilityJoins()}
      WHERE mp.user_id = ?2
        AND ${buildVisibilityPredicate()}
        AND substr(m.played_at, 1, 10) >= ?3
        AND substr(m.played_at, 1, 10) <= ?4
      GROUP BY activity_date
      ORDER BY activity_date ASC
    `,
  )
    .bind(viewerUserId, targetUserId, startDate, endDate)
    .all<ActivityHeatmapRow>();

  const days = rows.results.map<ActivityHeatmapDay>((row) => ({
    date: row.activity_date,
    matches: Number(row.matches ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
  }));

  const totals = days.reduce(
    (result, day) => ({
      matches: result.matches + day.matches,
      wins: result.wins + day.wins,
      losses: result.losses + day.losses,
    }),
    { matches: 0, wins: 0, losses: 0 },
  );

  return {
    startDate,
    endDate,
    totalMatches: totals.matches,
    totalWins: totals.wins,
    totalLosses: totals.losses,
    activeDays: days.length,
    days,
  };
}
