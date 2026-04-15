import { isoNow } from "../db";
import { successResponse } from "../responses";
import { getAchievementOverview } from "../services/achievements";
import { handleGetLeaderboard } from "./getLeaderboard";
import { handleGetMatches } from "./getMatches";
import { handleGetSeasons } from "./getSeasons";
import { handleGetTournaments } from "./getTournaments";
import { handleGetUserProgress } from "./getUserProgress";
import type { ApiRequest, DisputedMatchAlert, Env, MatchFeedFilter, UserRow } from "../types";

async function loadDisputedMatchAlerts(env: Env, sessionUserId: string): Promise<DisputedMatchAlert[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        m.id AS match_id,
        m.played_at,
        m.created_by_user_id,
        creator.display_name AS created_by_display_name,
        d.created_by_user_id AS disputed_by_user_id,
        disputer.display_name AS disputed_by_display_name,
        d.comment,
        d.updated_at
      FROM match_disputes d
      INNER JOIN matches m
        ON m.id = d.match_id
      INNER JOIN match_players viewer_mp
        ON viewer_mp.match_id = m.id
       AND viewer_mp.user_id = ?1
      INNER JOIN users creator
        ON creator.id = m.created_by_user_id
      INNER JOIN users disputer
        ON disputer.id = d.created_by_user_id
      WHERE d.status = 'active'
        AND m.status = 'active'
      ORDER BY d.updated_at DESC, m.created_at DESC, m.id DESC
      LIMIT 6
    `,
  )
    .bind(sessionUserId)
    .all<{
      match_id: string;
      played_at: string;
      created_by_user_id: string;
      created_by_display_name: string;
      disputed_by_user_id: string;
      disputed_by_display_name: string;
      comment: string;
      updated_at: string;
    }>();

  return result.results.map((row) => ({
    matchId: row.match_id,
    playedAt: row.played_at,
    createdByUserId: row.created_by_user_id,
    createdByDisplayName: row.created_by_display_name,
    disputedByUserId: row.disputed_by_user_id,
    disputedByDisplayName: row.disputed_by_display_name,
    comment: row.comment,
    updatedAt: row.updated_at,
  }));
}

export async function handleGetDashboard(
  request: ApiRequest<"getDashboard", { matchesLimit?: number; matchesFilter?: MatchFeedFilter }>,
  sessionUser: UserRow,
  env: Env,
) {
  const matchesLimit = request.payload?.matchesLimit;
  const matchesFilter: MatchFeedFilter = request.payload?.matchesFilter ?? "recent";

  const [seasons, tournaments, leaderboard, matches, userProgress, achievements, disputedMatches] = await Promise.all([
    handleGetSeasons({ ...request, action: "getSeasons", payload: {} }, sessionUser, env),
    handleGetTournaments({ ...request, action: "getTournaments", payload: {} }, sessionUser, env),
    handleGetLeaderboard({ ...request, action: "getLeaderboard", payload: { mode: "dashboard_preview" } }, sessionUser, env),
    handleGetMatches(
      {
        ...request,
        action: "getMatches",
        payload: { filter: matchesFilter, limit: matchesLimit ?? 4, mode: "dashboard_preview" },
      },
      sessionUser,
      env,
    ),
    handleGetUserProgress({ ...request, action: "getUserProgress", payload: { mode: "summary" } }, sessionUser, env),
    getAchievementOverview(env, sessionUser.id),
    loadDisputedMatchAlerts(env, sessionUser.id),
  ]);

  if (!seasons.ok || !tournaments.ok || !leaderboard.ok || !matches.ok || !userProgress.ok) {
    throw new Error("Dashboard composition failed.");
  }

  return successResponse(request.requestId, {
    seasons: seasons.data?.seasons ?? [],
    tournaments: tournaments.data?.tournaments ?? [],
    leaderboard: leaderboard.data?.leaderboard ?? [],
    players: [
      ...new Map(
        [...(leaderboard.data?.leaderboard ?? []), ...(matches.data?.players ?? [])].map((player) => [player.userId, player]),
      ).values(),
    ],
    leaderboardUpdatedAt: leaderboard.data?.updatedAt ?? isoNow(env.runtime),
    userProgress: userProgress.data!,
    achievements,
    matches: matches.data?.matches ?? [],
    nextCursor: matches.data?.nextCursor ?? null,
    matchBracketContextByMatchId: Object.fromEntries(
      (matches.data?.matches ?? [])
        .filter((match) => Boolean(match.bracketContext))
        .map((match) => [match.id, match.bracketContext!]),
    ),
    disputedMatches,
  });
}
