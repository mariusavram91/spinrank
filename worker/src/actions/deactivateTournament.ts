import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
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
      FROM tournaments
      WHERE id = ?1
    `,
  )
    .bind(id)
    .first<{ id: string; created_by_user_id: string; status: string }>();

  if (!tournament || tournament.status === "deleted") {
    return errorResponse(request.requestId, "NOT_FOUND", "Tournament not found.");
  }
  if (tournament.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can delete this item.");
  }

  const nowIso = isoNow();
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
    ).bind(randomId("audit"), sessionUser.id, id, JSON.stringify(request.payload), nowIso),
  ]);

  await recomputeAllRankings(env);

  return successResponse(request.requestId, {
    id,
    status: "deleted",
    deletedAt: nowIso,
  });
}
