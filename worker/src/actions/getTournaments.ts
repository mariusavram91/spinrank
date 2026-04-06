import { successResponse } from "../responses";
import { buildVisibleTournamentsSql, getRecentCompletionCutoffDate } from "../services/visibility";
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
        ${buildVisibleTournamentsSql()}
      ),
      participant_summary AS (
        SELECT
          tp.tournament_id,
          json_group_array(tp.user_id) AS participant_ids_json,
          COUNT(*) AS participant_count
        FROM (
          SELECT tournament_id, user_id
          FROM tournament_participants
          ORDER BY tournament_id ASC, user_id ASC
        ) tp
        GROUP BY tp.tournament_id
      ),
      bracket_summary AS (
        SELECT
          tbm.tournament_id,
          MAX(CASE WHEN tbm.is_final = 1 AND tbm.winner_player_id IS NOT NULL THEN 1 ELSE 0 END) AS has_completed_final,
          MAX(CASE WHEN tbm.created_match_id IS NOT NULL OR tbm.winner_player_id IS NOT NULL THEN 1 ELSE 0 END) AS has_progress
        FROM tournament_bracket_matches tbm
        GROUP BY tbm.tournament_id
      )
      SELECT
        v.*,
        s.name AS season_name,
        ps.participant_ids_json,
        COALESCE(ps.participant_count, 0) AS participant_count,
        CASE
          WHEN COALESCE(bs.has_completed_final, 0) = 1 THEN 'completed'
          WHEN COALESCE(bs.has_progress, 0) = 1 THEN 'in_progress'
          ELSE 'draft'
        END AS bracket_status
      FROM visible v
      LEFT JOIN seasons s ON s.id = v.season_id
      LEFT JOIN participant_summary ps ON ps.tournament_id = v.id
      LEFT JOIN bracket_summary bs ON bs.tournament_id = v.id
      WHERE (?3 = '' OR v.season_id = ?3)
      ORDER BY v.date DESC, v.id DESC
    `,
  )
    .bind(sessionUser.id, getRecentCompletionCutoffDate(env.runtime), seasonId)
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
