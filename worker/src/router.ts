import { requireSessionUser } from "./auth";
import { handleBootstrapUser } from "./actions/bootstrapUser";
import { handleCreateMatch } from "./actions/createMatch";
import { handleCreateSeason } from "./actions/createSeason";
import { handleCreateTournament } from "./actions/createTournament";
import { handleDeactivateMatch } from "./actions/deactivateMatch";
import { handleDeactivateSeason } from "./actions/deactivateSeason";
import { handleDeactivateTournament } from "./actions/deactivateTournament";
import { handleGetDashboard } from "./actions/getDashboard";
import { handleGetLeaderboard } from "./actions/getLeaderboard";
import { handleGetMatches } from "./actions/getMatches";
import { handleGetSeasons } from "./actions/getSeasons";
import { handleGetSegmentLeaderboard } from "./actions/getSegmentLeaderboard";
import { handleGetTournamentBracket } from "./actions/getTournamentBracket";
import { handleGetTournaments } from "./actions/getTournaments";
import { handleGetUserProgress } from "./actions/getUserProgress";
import { errorResponse } from "./responses";
import type { ApiAction, ApiRequest, Env } from "./types";

export async function parseApiRequest(request: Request): Promise<ApiRequest<ApiAction>> {
  const raw = await request.text();
  if (!raw) {
    throw new Error("Missing request body.");
  }
  if (raw.length > 32 * 1024) {
    throw new Error("Request body exceeds the 32KB limit.");
  }

  const parsed = JSON.parse(raw) as ApiRequest<ApiAction>;
  if (!parsed.action || !parsed.requestId) {
    throw new Error("Request must include action and requestId.");
  }

  return parsed;
}

export async function routeApiRequest(apiRequest: ApiRequest<ApiAction>, env: Env) {
  if (apiRequest.action === "bootstrapUser") {
    return handleBootstrapUser(apiRequest, env);
  }

  const sessionUser = await requireSessionUser(apiRequest.requestId, apiRequest.sessionToken, env);
  if ("ok" in sessionUser && sessionUser.ok === false) {
    return sessionUser;
  }

  switch (apiRequest.action) {
    case "getDashboard":
      return handleGetDashboard(apiRequest, sessionUser, env);
    case "getLeaderboard":
      return handleGetLeaderboard(apiRequest, sessionUser, env);
    case "getMatches":
      return handleGetMatches(apiRequest, sessionUser, env);
    case "getSeasons":
      return handleGetSeasons(apiRequest, sessionUser, env);
    case "getSegmentLeaderboard":
      return handleGetSegmentLeaderboard(apiRequest, sessionUser, env);
    case "getTournamentBracket":
      return handleGetTournamentBracket(apiRequest, sessionUser, env);
    case "getTournaments":
      return handleGetTournaments(apiRequest, sessionUser, env);
    case "getUserProgress":
      return handleGetUserProgress(apiRequest, sessionUser, env);
    case "createMatch":
      return handleCreateMatch(apiRequest, sessionUser, env);
    case "createSeason":
      return handleCreateSeason(apiRequest, sessionUser, env);
    case "createTournament":
      return handleCreateTournament(apiRequest, sessionUser, env);
    case "deactivateMatch":
      return handleDeactivateMatch(apiRequest, sessionUser, env);
    case "deactivateTournament":
      return handleDeactivateTournament(apiRequest, sessionUser, env);
    case "deactivateSeason":
      return handleDeactivateSeason(apiRequest, sessionUser, env);
    default:
      return errorResponse(apiRequest.requestId, "NOT_FOUND", `Unknown action: ${apiRequest.action}`);
  }
}
