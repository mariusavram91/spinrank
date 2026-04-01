import { errorResponse, successResponse } from "../responses";
import { getBracketRounds, getPlanParticipantIds } from "../services/brackets";
import { canAccessTournament, getTournamentById } from "../services/visibility";
import { handleGetTournaments } from "./getTournaments";
import type { ApiRequest, Env, GetTournamentBracketPayload, UserRow } from "../types";

export async function handleGetTournamentBracket(
  request: ApiRequest<"getTournamentBracket", GetTournamentBracketPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const tournamentId = request.payload?.tournamentId;
  if (!tournamentId) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "getTournamentBracket requires tournamentId.");
  }

  const tournament = await getTournamentById(env, tournamentId);
  if (!(await canAccessTournament(env, tournament, sessionUser.id))) {
    return errorResponse(request.requestId, "NOT_FOUND", "Tournament bracket was not found.");
  }

  const tournamentsResponse = await handleGetTournaments(
    { ...request, action: "getTournaments", payload: {} },
    sessionUser,
    env,
  );

  if (!tournamentsResponse.ok || !tournamentsResponse.data) {
    return errorResponse(request.requestId, "INTERNAL_ERROR", "Could not load tournament details.");
  }

  const tournamentRecord = tournamentsResponse.data.tournaments.find((entry) => entry.id === tournamentId);
  if (!tournamentRecord) {
    return errorResponse(request.requestId, "NOT_FOUND", "Tournament bracket was not found.");
  }

  const participantIds = await getPlanParticipantIds(env, tournamentId);
  const rounds = await getBracketRounds(env, tournamentId);

  return successResponse(request.requestId, {
    tournament: tournamentRecord,
    participantIds,
    rounds,
  });
}
