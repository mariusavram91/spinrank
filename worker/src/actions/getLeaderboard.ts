import { compareLeaderboardRows } from "../services/elo";
import { successResponse } from "../responses";
import type { ApiRequest, Env, LeaderboardEntry, UserRow } from "../types";

export async function handleGetLeaderboard(
  request: ApiRequest<"getLeaderboard">,
  _sessionUser: UserRow,
  env: Env,
) {
  const rows = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo, wins, losses, streak, updated_at
      FROM users
      ORDER BY global_elo DESC, wins DESC, losses ASC, display_name ASC
      LIMIT 100
    `,
  ).all<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    global_elo: number;
    wins: number;
    losses: number;
    streak: number;
    updated_at: string;
  }>();

  const leaderboard = rows.results.map<LeaderboardEntry>((row, index) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.global_elo),
    wins: Number(row.wins),
    losses: Number(row.losses),
    streak: Number(row.streak),
    rank: index + 1,
  }));

  leaderboard.sort(compareLeaderboardRows);

  return successResponse(request.requestId, {
    leaderboard: leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 })),
    updatedAt: rows.results[0]?.updated_at ?? new Date().toISOString(),
  });
}
