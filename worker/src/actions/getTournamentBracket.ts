import { errorResponse, successResponse } from "../responses";
import { getBracketRounds, getPlanParticipantIds } from "../services/brackets";
import { canAccessTournament, getTournamentById } from "../services/visibility";
import type { ApiRequest, Env, GetTournamentBracketPayload, TournamentRecord, UserRow } from "../types";

async function getTournamentDetailForUser(
  env: Env,
  tournamentId: string,
  userId: string,
): Promise<TournamentRecord | null> {
  const row = await env.DB.prepare(
    `
      SELECT
        t.id,
        t.name,
        t.date,
        t.status,
        t.season_id,
        s.name AS season_name,
        t.created_by_user_id,
        t.created_at,
        t.completed_at,
        (
          SELECT COUNT(*)
          FROM tournament_participants tp
          WHERE tp.tournament_id = t.id
        ) AS participant_count,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM tournament_bracket_matches tbm
            WHERE tbm.tournament_id = t.id
              AND tbm.is_final = 1
              AND tbm.winner_player_id IS NOT NULL
          ) THEN 'completed'
          WHEN EXISTS (
            SELECT 1
            FROM tournament_bracket_matches tbm
            WHERE tbm.tournament_id = t.id
              AND (tbm.created_match_id IS NOT NULL OR tbm.winner_player_id IS NOT NULL)
          ) THEN 'in_progress'
          ELSE 'draft'
        END AS bracket_status
      FROM tournaments t
      LEFT JOIN seasons s ON s.id = t.season_id
      LEFT JOIN tournament_participants viewer_tp
        ON viewer_tp.tournament_id = t.id AND viewer_tp.user_id = ?2
      WHERE t.id = ?1
        AND t.status != 'deleted'
        AND (
          t.created_by_user_id = ?2
          OR viewer_tp.user_id IS NOT NULL
        )
    `,
  )
    .bind(tournamentId, userId)
    .first<{
      id: string;
      name: string;
      date: string;
      status: TournamentRecord["status"];
      season_id: string | null;
      season_name: string | null;
      created_by_user_id: string | null;
      created_at: string;
      completed_at: string | null;
      participant_count: number;
      bracket_status: TournamentRecord["bracketStatus"];
    }>();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    date: row.date,
    seasonId: row.season_id,
    seasonName: row.season_name,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    participantCount: Number(row.participant_count || 0),
    bracketStatus: row.bracket_status,
  };
}

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

  const tournamentRecord = await getTournamentDetailForUser(env, tournamentId, sessionUser.id);
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
