import { isoNow } from "../db";
import { compareLeaderboardRows, MINIMUM_LEADERBOARD_MATCHES } from "../services/elo";
import { successResponse } from "../responses";
import type { ApiRequest, Env, LeaderboardEntry, UserRow } from "../types";

function isDashboardPreviewMode(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && "mode" in payload && payload.mode === "dashboard_preview");
}

export async function handleGetLeaderboard(
  request: ApiRequest<"getLeaderboard", { mode?: "default" | "dashboard_preview" }>,
  sessionUser: UserRow,
  env: Env,
) {
  const rows = await env.DB.prepare(
    isDashboardPreviewMode(request.payload)
      ? `
          WITH ranked AS (
            SELECT
              id,
              display_name,
              avatar_url,
              global_elo,
              wins,
              losses,
              streak,
              updated_at,
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
          SELECT id, display_name, avatar_url, global_elo, wins, losses, streak, updated_at, rank
          FROM ranked
          WHERE rank <= 10 OR id = ?1
          ORDER BY rank ASC
        `
      : `
          SELECT id, display_name, avatar_url, global_elo, wins, losses, streak, updated_at
          FROM users
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
          LIMIT 100
        `,
  )
    .bind(...(isDashboardPreviewMode(request.payload) ? [sessionUser.id] : []))
    .all<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
      wins: number;
      losses: number;
      streak: number;
      updated_at: string;
      rank?: number;
    }>();

  const leaderboard = rows.results.map<LeaderboardEntry>((row, index) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.global_elo),
    wins: Number(row.wins),
    losses: Number(row.losses),
    streak: Number(row.streak),
    matchEquivalentPlayed: Number(row.wins) + Number(row.losses),
    rank: Number(row.rank || index + 1),
  }));

  return successResponse(request.requestId, {
    leaderboard: isDashboardPreviewMode(request.payload)
      ? leaderboard
      : leaderboard.sort(compareLeaderboardRows).map((entry, index) => ({ ...entry, rank: index + 1 })),
    updatedAt: rows.results[0]?.updated_at ?? isoNow(env.runtime),
  });
}
