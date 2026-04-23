import { MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { getProfileActivityHeatmap } from "../services/profileActivity";
import { isoNow, parseJsonObject } from "../db";
import { successResponse } from "../responses";
import type { ApiRequest, Env, MatchRecord, UserProgressPoint, UserRow } from "../types";

const MAX_SUMMARY_PROGRESS_POINTS = 120;

function normalizeProgressMode(value: unknown): "summary" | "full" {
  return value === "summary" ? "summary" : "full";
}

function sampleProgressPointsByExtrema(points: UserProgressPoint[], maxPoints: number): UserProgressPoint[] {
  if (points.length <= maxPoints || maxPoints <= 0) {
    return [...points];
  }
  if (maxPoints === 1) {
    return [points[points.length - 1]];
  }
  if (maxPoints === 2) {
    return [points[0], points[points.length - 1]];
  }

  const first = points[0];
  const last = points[points.length - 1];
  const interior = points.slice(1, -1);
  const interiorBudget = maxPoints - 2;
  if (interior.length <= interiorBudget) {
    return [first, ...interior, last];
  }

  const pickByBaseline = (pool: Array<{ point: UserProgressPoint; index: number }>, limit: number): number[] => {
    const slope = (last.elo - first.elo) / Math.max(points.length - 1, 1);
    return [...pool]
      .sort((left, right) => {
        const leftExpected = first.elo + slope * (left.index + 1);
        const rightExpected = first.elo + slope * (right.index + 1);
        const leftScore = Math.abs(left.point.elo - leftExpected);
        const rightScore = Math.abs(right.point.elo - rightExpected);
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return left.index - right.index;
      })
      .slice(0, limit)
      .map((entry) => entry.index);
  };

  if (interiorBudget === 1) {
    const [index] = pickByBaseline(interior.map((point, index) => ({ point, index })), 1);
    return [first, interior[index], last];
  }

  const selectedInterior = new Set<number>();
  const bucketCount = Math.max(1, Math.floor(interiorBudget / 2));
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket * interior.length) / bucketCount);
    const end = Math.floor(((bucket + 1) * interior.length) / bucketCount);
    if (end <= start) {
      continue;
    }

    let minIndex = start;
    let maxIndex = start;
    for (let cursor = start + 1; cursor < end; cursor += 1) {
      if (interior[cursor].elo < interior[minIndex].elo) {
        minIndex = cursor;
      }
      if (interior[cursor].elo > interior[maxIndex].elo) {
        maxIndex = cursor;
      }
    }

    selectedInterior.add(minIndex);
    selectedInterior.add(maxIndex);
  }

  if (selectedInterior.size > interiorBudget) {
    const narrowed = pickByBaseline(
      [...selectedInterior].map((index) => ({ point: interior[index], index })),
      interiorBudget,
    );
    selectedInterior.clear();
    narrowed.forEach((index) => selectedInterior.add(index));
  }

  if (selectedInterior.size < interiorBudget) {
    const remaining = interior
      .map((point, index) => ({ point, index }))
      .filter((entry) => !selectedInterior.has(entry.index));
    const fill = pickByBaseline(remaining, interiorBudget - selectedInterior.size);
    fill.forEach((index) => selectedInterior.add(index));
  }

  const orderedInterior = [...selectedInterior].sort((left, right) => left - right).map((index) => interior[index]);
  return [first, ...orderedInterior, last];
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
  const progressRows = await env.DB.prepare(
    mode === "summary"
      ? `
          SELECT m.played_at, m.global_elo_delta_json, m.winner_team, mp.team AS player_team, m.match_type
          FROM match_players mp
          JOIN matches m
            ON m.id = mp.match_id
          LEFT JOIN seasons s
            ON s.id = m.season_id
          LEFT JOIN season_participants sp
            ON sp.season_id = m.season_id AND sp.user_id = ?1
          LEFT JOIN tournaments t
            ON t.id = m.tournament_id
          LEFT JOIN tournament_participants tp
            ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
          WHERE mp.user_id = ?1
            AND m.status = 'active'
            AND (
              (m.season_id IS NULL AND m.tournament_id IS NULL)
              OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
              OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
                s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
              ))
            )
          ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
        `
      : `
          SELECT m.played_at, m.global_elo_delta_json, m.winner_team, mp.team AS player_team, m.match_type
          FROM match_players mp
          JOIN matches m
            ON m.id = mp.match_id
          LEFT JOIN seasons s
            ON s.id = m.season_id
          LEFT JOIN season_participants sp
            ON sp.season_id = m.season_id AND sp.user_id = ?1
          LEFT JOIN tournaments t
            ON t.id = m.tournament_id
          LEFT JOIN tournament_participants tp
            ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
          WHERE mp.user_id = ?1
            AND m.status = 'active'
            AND (
              (m.season_id IS NULL AND m.tournament_id IS NULL)
              OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
              OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
                s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
              ))
            )
          ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
        `,
  )
    .bind(sessionUser.id)
    .all<{
      played_at: string;
      global_elo_delta_json: string;
      winner_team: MatchRecord["winnerTeam"];
      player_team: MatchRecord["winnerTeam"];
      match_type: MatchRecord["matchType"];
    }>();

  const deltas = progressRows.results.map((row) => {
    const deltaMap = parseJsonObject<Record<string, number>>(row.global_elo_delta_json, {});
    return {
      row,
      delta: Number(deltaMap[sessionUser.id] || 0),
    };
  });

  let elo =
    mode === "summary"
      ? Number(sessionUser.global_elo) - deltas.reduce((sum, entry) => sum + entry.delta, 0)
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

  deltas.forEach(({ row, delta }) => {
    elo += delta;
    bestElo = Math.max(bestElo, elo);

    const isWin = row.player_team === row.winner_team;
    const totals = row.match_type === "singles" ? matchTypeTotals.singles : matchTypeTotals.doubles;
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
      playedAt: row.played_at,
      elo,
      delta,
      label: row.played_at,
      rank: null,
    });
  });
  const nowIso = isoNow(env.runtime);
  const activityHeatmap = includeActivityHeatmap
    ? await getProfileActivityHeatmap(env, sessionUser.id, sessionUser.id)
    : null;
  const finalPoints =
    progressPoints.length > 0
      ? progressPoints
      : [
          {
            playedAt: nowIso,
            elo: Number(sessionUser.global_elo),
            delta: 0,
            label: nowIso,
            rank: resolvedRank,
          },
        ];
  const responsePoints =
    mode === "summary" ? sampleProgressPointsByExtrema(finalPoints, MAX_SUMMARY_PROGRESS_POINTS) : finalPoints;

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
