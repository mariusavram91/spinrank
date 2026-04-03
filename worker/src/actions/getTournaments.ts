import { successResponse } from "../responses";
import { visibleTournamentsSql } from "../services/visibility";
import type { ApiRequest, Env, GetTournamentsPayload, TournamentRecord, UserRow } from "../types";

export async function handleGetTournaments(
  request: ApiRequest<"getTournaments", GetTournamentsPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const seasonId = request.payload?.seasonId || "";
  const result = await env.DB.prepare(
    `
      WITH visible AS (
        ${visibleTournamentsSql}
      )
      SELECT
        v.*,
        s.name AS season_name,
        (
          SELECT json_group_array(tp.user_id)
          FROM tournament_participants tp
          WHERE tp.tournament_id = v.id
          ORDER BY tp.user_id ASC
        ) AS participant_ids_json,
        (
          SELECT COUNT(*)
          FROM tournament_participants tp
          WHERE tp.tournament_id = v.id
        ) AS participant_count,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM tournament_bracket_matches tbm
            WHERE tbm.tournament_id = v.id
              AND tbm.is_final = 1
              AND tbm.winner_player_id IS NOT NULL
          ) THEN 'completed'
          WHEN EXISTS (
            SELECT 1
            FROM tournament_bracket_matches tbm
            WHERE tbm.tournament_id = v.id
              AND (tbm.created_match_id IS NOT NULL OR tbm.winner_player_id IS NOT NULL)
          ) THEN 'in_progress'
          ELSE 'draft'
        END AS bracket_status
      FROM visible v
      LEFT JOIN seasons s ON s.id = v.season_id
      WHERE (?2 = '' OR v.season_id = ?2)
      ORDER BY v.date DESC, v.id DESC
    `,
  )
    .bind(sessionUser.id, seasonId)
    .all<{
      id: string;
      name: string;
      date: string;
      status: TournamentRecord["status"];
      season_id: string | null;
      season_name: string | null;
      created_by_user_id: string | null;
      created_at: string;
      completed_at: string | null;
      participant_ids_json: string | null;
      participant_count: number;
      bracket_status: TournamentRecord["bracketStatus"];
    }>();

  const tournaments = result.results.map<TournamentRecord>((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    seasonId: row.season_id,
    seasonName: row.season_name,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    participantCount: Number(row.participant_count || 0),
    participantIds: row.participant_ids_json ? JSON.parse(row.participant_ids_json) : [],
    bracketStatus: row.bracket_status,
  }));

  return successResponse(request.requestId, { tournaments });
}
