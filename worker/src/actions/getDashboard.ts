import { isoNow } from "../db";
import { successResponse } from "../responses";
import { getAchievementOverview } from "../services/achievements";
import { handleGetLeaderboard } from "./getLeaderboard";
import { handleGetMatches } from "./getMatches";
import { handleGetSeasons } from "./getSeasons";
import { handleGetTournaments } from "./getTournaments";
import { handleGetUserProgress } from "./getUserProgress";
import type { ApiRequest, Env, MatchFeedFilter, UserRow } from "../types";

export async function handleGetDashboard(
  request: ApiRequest<"getDashboard", { matchesLimit?: number; matchesFilter?: MatchFeedFilter }>,
  sessionUser: UserRow,
  env: Env,
) {
  const matchesLimit = request.payload?.matchesLimit;
  const matchesFilter: MatchFeedFilter = request.payload?.matchesFilter ?? "recent";

  const [seasons, tournaments, leaderboard, matches, userProgress, achievements] = await Promise.all([
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
  ]);

  if (!seasons.ok || !tournaments.ok || !leaderboard.ok || !matches.ok || !userProgress.ok) {
    throw new Error("Dashboard composition failed.");
  }

  return successResponse(request.requestId, {
    seasons: seasons.data?.seasons ?? [],
    tournaments: tournaments.data?.tournaments ?? [],
    leaderboard: leaderboard.data?.leaderboard ?? [],
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
  });
}
