import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { applyIncrementalGlobalRollbackForDeletedMatches } from "../services/incrementalRankingRollback";
import { invalidateUserMatchImpactCache, recomputeAllRankings } from "../services/elo";
import type { ApiRequest, DeactivateEntityPayload, Env, UserRow } from "../types";

export async function handleDeactivateSeason(
  request: ApiRequest<"deactivateSeason", DeactivateEntityPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const id = request.payload?.id;
  if (!id) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "deactivateSeason requires an id.");
  }

  const season = await env.DB.prepare(
    `
      SELECT id, name, created_by_user_id, status
      FROM seasons
      WHERE id = ?1
    `,
  )
    .bind(id)
    .first<{ id: string; name: string; created_by_user_id: string; status: string }>();

  if (!season || season.status === "deleted") {
    return errorResponse(request.requestId, "NOT_FOUND", "Season not found.");
  }
  if (season.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can delete this item.");
  }

  const tournamentIds = (
    await env.DB.prepare(
      `
        SELECT id
        FROM tournaments
        WHERE season_id = ?1
          AND status != 'deleted'
        ORDER BY id ASC
      `,
    )
      .bind(id)
      .all<{ id: string }>()
  ).results.map((row) => row.id);

  const activeMatches = (
    await env.DB.prepare(
      `
        SELECT id, match_type, team_a_player_ids_json, team_b_player_ids_json, winner_team, played_at, created_at
        FROM matches
        WHERE (season_id = ?1 OR tournament_id IN (
          SELECT id
          FROM tournaments
          WHERE season_id = ?1
        ))
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
        UPDATE seasons
        SET status = 'deleted',
            is_active = 0,
            completed_at = COALESCE(completed_at, ?2)
        WHERE id = ?1
      `,
    ).bind(id, nowIso),
    env.DB.prepare(
      `
        UPDATE tournaments
        SET status = 'deleted',
            completed_at = COALESCE(NULLIF(completed_at, ''), ?2)
        WHERE season_id = ?1
          AND status != 'deleted'
      `,
    ).bind(id, nowIso),
    env.DB.prepare(
      `
        UPDATE matches
        SET status = 'deleted',
            deactivated_at = ?2,
            deactivated_by_user_id = ?3,
            deactivation_reason = ?4
        WHERE (season_id = ?1 OR tournament_id IN (
          SELECT id
          FROM tournaments
          WHERE season_id = ?1
        ))
          AND status != 'deleted'
      `,
    ).bind(id, nowIso, sessionUser.id, request.payload?.reason || `Season deleted: ${season.name}`),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'deactivateSeason', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, id, JSON.stringify(request.payload), nowIso),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      `
        DELETE FROM elo_segments
        WHERE segment_type = 'season'
          AND segment_id = ?1
      `,
    ).bind(id),
    ...tournamentIds.map((tournamentId) =>
      env.DB.prepare(
        `
          DELETE FROM elo_segments
          WHERE segment_type = 'tournament'
            AND segment_id = ?1
        `,
      ).bind(tournamentId),
    ),
  ]);

  if (activeMatches.length > 0) {
    const appliedIncrementalDelete = await applyIncrementalGlobalRollbackForDeletedMatches(env, activeMatches, nowIso);
    if (appliedIncrementalDelete) {
      invalidateUserMatchImpactCache();
      return successResponse(request.requestId, {
        id,
        status: "deleted",
        deletedAt: nowIso,
      });
    }

    await recomputeAllRankings(env);
  }
  invalidateUserMatchImpactCache();

  return successResponse(request.requestId, {
    id,
    status: "deleted",
    deletedAt: nowIso,
  });
}
