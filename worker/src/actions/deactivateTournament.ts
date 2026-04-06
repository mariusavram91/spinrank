import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { applyIncrementalGlobalRollbackForDeletedMatches } from "../services/incrementalRankingRollback";
import { recomputeAllRankings } from "../services/elo";
import type { ApiRequest, DeactivateEntityPayload, Env, UserRow } from "../types";

export async function handleDeactivateTournament(
  request: ApiRequest<"deactivateTournament", DeactivateEntityPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const id = request.payload?.id;
  if (!id) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "deactivateTournament requires an id.");
  }

  const tournament = await env.DB.prepare(
    `
      SELECT id, created_by_user_id, status
             , season_id
      FROM tournaments
      WHERE id = ?1
    `,
  )
    .bind(id)
    .first<{ id: string; created_by_user_id: string; status: string; season_id: string | null }>();

  if (!tournament || tournament.status === "deleted") {
    return errorResponse(request.requestId, "NOT_FOUND", "Tournament not found.");
  }
  if (tournament.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can delete this item.");
  }

  const activeMatches = (
    await env.DB.prepare(
      `
        SELECT id, match_type, team_a_player_ids_json, team_b_player_ids_json, winner_team, played_at, created_at
        FROM matches
        WHERE tournament_id = ?1
          AND status != 'deleted'
        ORDER BY played_at ASC, created_at ASC, id ASC
      `,
    )
      .bind(id)
      .all<{
        id: string;
        match_type: "singles" | "doubles";
        team_a_player_ids_json: string;
        team_b_player_ids_json: string;
        winner_team: "A" | "B";
        played_at: string;
        created_at: string;
      }>()
  ).results;

  const nowIso = isoNow(env.runtime);
  await env.DB.batch([
    env.DB.prepare(
      `
        UPDATE tournaments
        SET status = 'deleted',
            completed_at = COALESCE(NULLIF(completed_at, ''), ?2)
        WHERE id = ?1
      `,
    ).bind(id, nowIso),
    env.DB.prepare(
      `
        UPDATE matches
        SET status = 'deleted',
            deactivated_at = ?2,
            deactivated_by_user_id = ?3,
            deactivation_reason = ?4
        WHERE tournament_id = ?1
          AND status != 'deleted'
      `,
    ).bind(id, nowIso, sessionUser.id, request.payload?.reason || "Tournament deleted"),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'deactivateTournament', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, id, JSON.stringify(request.payload), nowIso),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      `
        DELETE FROM elo_segments
        WHERE segment_type = 'tournament'
          AND segment_id = ?1
      `,
    ).bind(id),
  ]);

  if (activeMatches.length > 0) {
    if (!tournament.season_id) {
      const appliedIncrementalDelete = await applyIncrementalGlobalRollbackForDeletedMatches(env, activeMatches, nowIso);
      if (appliedIncrementalDelete) {
        return successResponse(request.requestId, {
          id,
          status: "deleted",
          deletedAt: nowIso,
        });
      }
    }

    await recomputeAllRankings(env);
  }

  return successResponse(request.requestId, {
    id,
    status: "deleted",
    deletedAt: nowIso,
  });
}
