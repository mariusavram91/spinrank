import { isoNow } from "../db";
import { successResponse } from "../responses";
import { MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { getProfileActivityHeatmap } from "../services/profileActivity";
import { buildUserProgressPoints, loadVisibleUserProgressRows } from "../services/userProgress";
import type { ApiRequest, Env, UserProgressPoint, UserRow } from "../types";

function normalizeProgressMode(value: unknown): "summary" | "full" {
  return value === "summary" ? "summary" : "full";
}

export async function handleGetUserProgress(
  request: ApiRequest<"getUserProgress">,
  sessionUser: UserRow,
  env: Env,
) {
  const mode = normalizeProgressMode((request.payload as { mode?: unknown } | undefined)?.mode);
  const includeActivityHeatmap =
    (request.payload as { includeActivityHeatmap?: unknown } | undefined)?.includeActivityHeatmap === true;
  const rankRow = await env.DB.prepare(
    `
      SELECT rank
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN 0 ELSE 1 END ASC,
              CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN global_elo END DESC,
              CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN wins END DESC,
              CASE WHEN wins + losses >= ${MINIMUM_LEADERBOARD_MATCHES} THEN losses END ASC,
              CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN wins + losses END DESC,
              CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN global_elo END DESC,
              CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN wins END DESC,
              CASE WHEN wins + losses < ${MINIMUM_LEADERBOARD_MATCHES} THEN losses END ASC,
              display_name ASC
          ) AS rank
        FROM users
      )
      WHERE id = ?1
    `,
  )
    .bind(sessionUser.id)
    .first<{ rank: number }>();
  const progressRows = await loadVisibleUserProgressRows(env, sessionUser.id, sessionUser.id);

  let elo =
    mode === "summary"
      ? Number(sessionUser.global_elo) - progressRows.reduce((sum, entry) => sum + entry.delta, 0)
      : 1200;
  let bestElo = Math.max(Number(sessionUser.highest_global_elo ?? 0), Number(sessionUser.global_elo));
  let bestStreak = Number(sessionUser.best_win_streak ?? 0);
  let streakRunning = 0;
  const matchTypeTotals = {
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
  };
  const progressPoints: UserProgressPoint[] = [];

  const resolvedRank = rankRow?.rank ? Number(rankRow.rank) : null;

  progressRows.forEach((row) => {
    elo += row.delta;
    bestElo = Math.max(bestElo, elo);

    const isWin = row.playerTeam === row.winnerTeam;
    const totals = row.matchType === "singles" ? matchTypeTotals.singles : matchTypeTotals.doubles;
    totals.matches += 1;
    if (isWin) {
      totals.wins += 1;
    } else {
      totals.losses += 1;
    }
    if (isWin) {
      streakRunning = Math.max(streakRunning, 0) + 1;
      bestStreak = Math.max(bestStreak, streakRunning);
    } else {
      streakRunning = Math.min(streakRunning, 0) - 1;
    }

    progressPoints.push({
      playedAt: row.playedAt,
      elo,
      delta: row.delta,
      label: row.playedAt,
      rank: null,
    });
  });
  const nowIso = isoNow(env.runtime);
  const activityHeatmap = includeActivityHeatmap
    ? await getProfileActivityHeatmap(env, sessionUser.id, sessionUser.id)
    : null;
  const responsePoints = buildUserProgressPoints({
    rows: progressRows,
    currentElo: Number(sessionUser.global_elo),
    mode,
    env,
    resolvedRank,
    emptyLabel: nowIso,
  });

  return successResponse(request.requestId, {
    currentRank: resolvedRank,
    currentElo: Number(sessionUser.global_elo),
    bestRank: resolvedRank,
    bestElo,
    currentStreak: Number(sessionUser.streak || 0),
    bestStreak,
    wins: Number(sessionUser.wins || 0),
    losses: Number(sessionUser.losses || 0),
    singles: {
      matches: matchTypeTotals.singles.matches,
      wins: matchTypeTotals.singles.wins,
      losses: matchTypeTotals.singles.losses,
    },
    doubles: {
      matches: matchTypeTotals.doubles.matches,
      wins: matchTypeTotals.doubles.wins,
      losses: matchTypeTotals.doubles.losses,
    },
    points: responsePoints,
    activityHeatmap,
  });
}
