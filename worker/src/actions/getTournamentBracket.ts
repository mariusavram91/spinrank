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
  const participantRows = await env.DB.prepare(
    `
      SELECT
        u.id,
        u.display_name,
        u.avatar_url,
        u.global_elo
      FROM tournament_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.tournament_id = ?1
      ORDER BY u.display_name ASC
    `,
  )
    .bind(tournamentId)
    .all<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
    }>();
  const rounds = await getBracketRounds(env, tournamentId);

  return successResponse(request.requestId, {
    tournament: tournamentRecord,
    participantIds,
    participants: participantRows.results.map((row) => ({
      userId: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      elo: Number(row.global_elo),
      isSuggested: true,
    })),
    rounds,
  });
}
