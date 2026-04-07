import { requireSessionUser } from "./auth";
import { handleBootstrapUser } from "./actions/bootstrapUser";
import { handleCreateMatch } from "./actions/createMatch";
import { handleCreateSeason } from "./actions/createSeason";
import { handleCreateSegmentShareLink } from "./actions/createSegmentShareLink";
import { handleCreateTournament } from "./actions/createTournament";
import { handleDeactivateMatch } from "./actions/deactivateMatch";
import { handleDeactivateSeason } from "./actions/deactivateSeason";
import { handleDeactivateTournament } from "./actions/deactivateTournament";
import { handleGetDashboard } from "./actions/getDashboard";
import { handleGetLeaderboard } from "./actions/getLeaderboard";
import { handleGetMatches } from "./actions/getMatches";
import { handleSearchParticipants } from "./actions/searchParticipants";
import { handleGetSeasons } from "./actions/getSeasons";
import { handleGetSegmentLeaderboard } from "./actions/getSegmentLeaderboard";
import { handleGetTournamentBracket } from "./actions/getTournamentBracket";
import { handleGetTournaments } from "./actions/getTournaments";
import { handleGetUserProgress } from "./actions/getUserProgress";
import { errorResponse } from "./responses";
import { ApiRequestSchema } from "./schemas/api";
import type {
  ApiAction,
  ApiRequest,
  BootstrapUserPayload,
  CreateMatchPayload,
  CreateSeasonPayload,
  CreateSegmentShareLinkPayload,
  CreateTournamentPayload,
  DeactivateEntityPayload,
  GetMatchesPayload,
  GetLeaderboardPayload,
  SearchParticipantsPayload,
  GetSegmentLeaderboardPayload,
  GetTournamentBracketPayload,
  GetTournamentsPayload,
  MatchFeedFilter,
  RedeemSegmentShareLinkPayload,
  Env,
} from "./types";

type DashboardPayload = {
  matchesLimit?: number;
  matchesFilter?: MatchFeedFilter;
};
import { ZodError } from "zod";
import { handleRedeemSegmentShareLink } from "./actions/redeemSegmentShareLink";

export async function parseApiRequest(request: Request): Promise<ApiRequest<ApiAction>> {
  const raw = await request.text();
  if (!raw) {
    throw new Error("Missing request body.");
  }
  if (raw.length > 32 * 1024) {
    throw new Error("Request body exceeds the 32KB limit.");
  }

  try {
    const parsed = ApiRequestSchema.parse(JSON.parse(raw));
    return parsed as ApiRequest<ApiAction>;
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "payload";
        return `${path}: ${issue.message}`;
      });
      throw new Error(`Malformed request: ${details.join("; ")}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error("Request body contains invalid JSON.");
    }
    throw error;
  }
}

export async function routeApiRequest(apiRequest: ApiRequest<ApiAction>, env: Env) {
  if (apiRequest.action === "bootstrapUser") {
    return handleBootstrapUser(
      apiRequest as ApiRequest<"bootstrapUser", BootstrapUserPayload>,
      env,
    );
  }

  const sessionUser = await requireSessionUser(apiRequest.requestId, apiRequest.sessionToken, env);
  if ("ok" in sessionUser) {
    return sessionUser;
  }

  switch (apiRequest.action) {
    case "getDashboard":
      return handleGetDashboard(
        apiRequest as ApiRequest<"getDashboard", DashboardPayload>,
        sessionUser,
        env,
      );
    case "getLeaderboard":
      return handleGetLeaderboard(
        apiRequest as ApiRequest<"getLeaderboard", GetLeaderboardPayload>,
        sessionUser,
        env,
      );
    case "searchParticipants":
      return handleSearchParticipants(
        apiRequest as ApiRequest<"searchParticipants", SearchParticipantsPayload>,
        sessionUser,
        env,
      );
    case "getMatches":
      return handleGetMatches(apiRequest as ApiRequest<"getMatches", GetMatchesPayload>, sessionUser, env);
    case "getSeasons":
      return handleGetSeasons(apiRequest as ApiRequest<"getSeasons">, sessionUser, env);
    case "getSegmentLeaderboard":
      return handleGetSegmentLeaderboard(
        apiRequest as ApiRequest<"getSegmentLeaderboard", GetSegmentLeaderboardPayload>,
        sessionUser,
        env,
      );
    case "getTournamentBracket":
      return handleGetTournamentBracket(
        apiRequest as ApiRequest<"getTournamentBracket", GetTournamentBracketPayload>,
        sessionUser,
        env,
      );
    case "getTournaments":
      return handleGetTournaments(
        apiRequest as ApiRequest<"getTournaments", GetTournamentsPayload>,
        sessionUser,
        env,
      );
    case "getUserProgress":
      return handleGetUserProgress(apiRequest as ApiRequest<"getUserProgress">, sessionUser, env);
    case "createMatch":
      return handleCreateMatch(apiRequest as ApiRequest<"createMatch", CreateMatchPayload>, sessionUser, env);
    case "createSeason":
      return handleCreateSeason(apiRequest as ApiRequest<"createSeason", CreateSeasonPayload>, sessionUser, env);
    case "createSegmentShareLink":
      return handleCreateSegmentShareLink(
        apiRequest as ApiRequest<"createSegmentShareLink", CreateSegmentShareLinkPayload>,
        sessionUser,
        env,
      );
    case "createTournament":
      return handleCreateTournament(
        apiRequest as ApiRequest<"createTournament", CreateTournamentPayload>,
        sessionUser,
        env,
      );
    case "redeemSegmentShareLink":
      return handleRedeemSegmentShareLink(
        apiRequest as ApiRequest<"redeemSegmentShareLink", RedeemSegmentShareLinkPayload>,
        sessionUser,
        env,
      );
    case "deactivateMatch":
      return handleDeactivateMatch(
        apiRequest as ApiRequest<"deactivateMatch", DeactivateEntityPayload>,
        sessionUser,
        env,
      );
    case "deactivateTournament":
      return handleDeactivateTournament(
        apiRequest as ApiRequest<"deactivateTournament", DeactivateEntityPayload>,
        sessionUser,
        env,
      );
    case "deactivateSeason":
      return handleDeactivateSeason(
        apiRequest as ApiRequest<"deactivateSeason", DeactivateEntityPayload>,
        sessionUser,
        env,
      );
    default:
      return errorResponse(apiRequest.requestId, "NOT_FOUND", `Unknown action: ${apiRequest.action}`);
  }
}
