import { MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { isoNow, parseJsonObject } from "../db";
import { successResponse } from "../responses";
import type { ApiRequest, Env, MatchRecord, UserProgressPoint, UserRow } from "../types";

function normalizeProgressMode(value: unknown): "summary" | "full" {
  return value === "summary" ? "summary" : "full";
}

export async function handleGetUserProgress(
  request: ApiRequest<"getUserProgress">,
  sessionUser: UserRow,
  env: Env,
) {
  const mode = normalizeProgressMode((request.payload as { mode?: unknown } | undefined)?.mode);
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
          SELECT *
          FROM (
            SELECT m.played_at, m.global_elo_delta_json, m.winner_team, mp.team AS player_team
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
            ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
            LIMIT 20
          )
          ORDER BY played_at ASC
        `
      : `
          SELECT m.played_at, m.global_elo_delta_json, m.winner_team, mp.team AS player_team
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
  let bestElo = Number(sessionUser.global_elo);
  let bestStreak = Number(sessionUser.best_win_streak ?? 0);
  let streakRunning = 0;
  const progressPoints: UserProgressPoint[] = [];

  const resolvedRank = rankRow?.rank ? Number(rankRow.rank) : null;

  deltas.forEach(({ row, delta }) => {
    elo += delta;
    bestElo = Math.max(bestElo, elo);

    const isWin = row.player_team === row.winner_team;
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

  return successResponse(request.requestId, {
    currentRank: resolvedRank,
    currentElo: Number(sessionUser.global_elo),
    bestRank: resolvedRank,
    bestElo,
    currentStreak: Number(sessionUser.streak || 0),
    bestStreak,
    wins: Number(sessionUser.wins || 0),
    losses: Number(sessionUser.losses || 0),
    points: finalPoints,
  });
}
