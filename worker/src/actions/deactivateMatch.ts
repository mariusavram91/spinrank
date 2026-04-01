import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { rebuildTournamentBracket } from "../services/brackets";
import { recomputeAllRankings } from "../services/elo";
import type { ApiRequest, DeactivateEntityPayload, Env, UserRow } from "../types";

export async function handleDeactivateMatch(
  request: ApiRequest<"deactivateMatch", DeactivateEntityPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const id = request.payload?.id;
  if (!id) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "deactivateMatch requires an id.");
  }

  const match = await env.DB.prepare(
    `
      SELECT id, created_by_user_id, status, tournament_id
      FROM matches
      WHERE id = ?1
    `,
  )
    .bind(id)
    .first<{ id: string; created_by_user_id: string; status: string; tournament_id: string | null }>();

  if (!match || match.status === "deleted") {
    return errorResponse(request.requestId, "NOT_FOUND", "Match not found.");
  }
  if (match.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can delete this item.");
  }

  const nowIso = isoNow();
  await env.DB.batch([
    env.DB.prepare(
      `
        UPDATE matches
        SET status = 'deleted',
            deactivated_at = ?2,
            deactivated_by_user_id = ?3,
            deactivation_reason = ?4
        WHERE id = ?1
      `,
    ).bind(id, nowIso, sessionUser.id, request.payload?.reason || ""),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'deactivateMatch', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit"), sessionUser.id, id, JSON.stringify(request.payload), nowIso),
  ]);

  if (match.tournament_id) {
    await rebuildTournamentBracket(env, match.tournament_id);
  }
  await recomputeAllRankings(env);

  return successResponse(request.requestId, {
    id,
    status: "deleted",
    deletedAt: nowIso,
  });
}
