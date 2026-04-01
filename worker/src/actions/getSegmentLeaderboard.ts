import { errorResponse, successResponse } from "../responses";
import { canAccessSeason, canAccessTournament, getSeasonById, getTournamentById } from "../services/visibility";
import type { ApiRequest, Env, GetSegmentLeaderboardPayload, LeaderboardEntry, UserRow } from "../types";

export async function handleGetSegmentLeaderboard(
  request: ApiRequest<"getSegmentLeaderboard", GetSegmentLeaderboardPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const { segmentType, segmentId } = request.payload;
  if (!segmentId || (segmentType !== "season" && segmentType !== "tournament")) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "getSegmentLeaderboard requires segmentType and segmentId.");
  }

  if (segmentType === "season") {
    const season = await getSeasonById(env, segmentId);
    if (!canAccessSeason(season, sessionUser.id)) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this season.");
    }
  } else {
    const tournament = await getTournamentById(env, segmentId);
    if (!(await canAccessTournament(env, tournament, sessionUser.id))) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this tournament.");
    }
  }

  const rows = await env.DB.prepare(
    `
      SELECT es.user_id, es.elo, es.wins, es.losses, es.streak, es.updated_at, u.display_name, u.avatar_url
      FROM elo_segments es
      JOIN users u ON u.id = es.user_id
      WHERE es.segment_type = ?1 AND es.segment_id = ?2
      ORDER BY es.elo DESC, es.wins DESC, es.losses ASC, u.display_name ASC
      LIMIT 100
    `,
  )
    .bind(segmentType, segmentId)
    .all<{
      user_id: string;
      elo: number;
      wins: number;
      losses: number;
      streak: number;
      updated_at: string;
      display_name: string;
      avatar_url: string | null;
    }>();

  const leaderboard = rows.results.map<LeaderboardEntry>((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.elo),
    wins: Number(row.wins),
    losses: Number(row.losses),
    streak: Number(row.streak),
    rank: index + 1,
  }));

  return successResponse(request.requestId, {
    segmentType,
    segmentId,
    leaderboard,
    updatedAt: rows.results[0]?.updated_at ?? new Date().toISOString(),
  });
}
