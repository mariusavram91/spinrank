import { isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import type { ApiRequest, Env, RemoveMatchDisputePayload, UserRow } from "../types";

export async function handleRemoveMatchDispute(
  request: ApiRequest<"removeMatchDispute", RemoveMatchDisputePayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const matchId = String(request.payload?.matchId || "");
  if (!matchId) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "removeMatchDispute requires a matchId.");
  }

  const existing = await env.DB.prepare(
    `
      SELECT id
      FROM match_disputes
      WHERE match_id = ?1
        AND created_by_user_id = ?2
        AND status = 'active'
    `,
  )
    .bind(matchId, sessionUser.id)
    .first<{ id: string }>();

  if (!existing) {
    return successResponse(request.requestId, {
      matchId,
      removed: false,
    });
  }

  const nowIso = isoNow(env.runtime);
  await env.DB.batch([
    env.DB.prepare(
      `
        UPDATE match_disputes
        SET status = 'withdrawn',
            updated_at = ?3
        WHERE match_id = ?1
          AND created_by_user_id = ?2
          AND status = 'active'
      `,
    ).bind(matchId, sessionUser.id, nowIso),
    env.DB.prepare(
      `
        UPDATE matches
        SET has_active_dispute = CASE
          WHEN EXISTS (
            SELECT 1
            FROM match_disputes
            WHERE match_id = ?1
              AND status = 'active'
          ) THEN 1
          ELSE 0
        END
        WHERE id = ?1
      `,
    ).bind(matchId),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'removeMatchDispute', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, matchId, JSON.stringify(request.payload), nowIso),
  ]);

  return successResponse(request.requestId, {
    matchId,
    removed: true,
  });
}
