import { isoNow, parseJsonArray, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import type { ApiRequest, CreateMatchDisputePayload, Env, UserRow } from "../types";

type MatchAccessRow = {
  id: string;
  status: string;
  created_by_user_id: string;
  created_at: string;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
};

const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function loadMatch(env: Env, matchId: string): Promise<MatchAccessRow | null> {
  return env.DB.prepare(
    `
      SELECT id, status, created_by_user_id, created_at, team_a_player_ids_json, team_b_player_ids_json
      FROM matches
      WHERE id = ?1
    `,
  )
    .bind(matchId)
    .first<MatchAccessRow>();
}

function isParticipant(match: MatchAccessRow, userId: string): boolean {
  return [...parseJsonArray<string>(match.team_a_player_ids_json), ...parseJsonArray<string>(match.team_b_player_ids_json)]
    .includes(userId);
}

export async function handleCreateMatchDispute(
  request: ApiRequest<"createMatchDispute", CreateMatchDisputePayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const matchId = String(request.payload?.matchId || "");
  const comment = String(request.payload?.comment || "").trim();
  if (!matchId) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "createMatchDispute requires a matchId.");
  }
  if (!comment) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "A dispute comment is required.");
  }

  const match = await loadMatch(env, matchId);
  if (!match || match.status !== "active") {
    return errorResponse(request.requestId, "NOT_FOUND", "Match not found.");
  }
  if (!isParticipant(match, sessionUser.id)) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only match participants can dispute this match.");
  }
  if (match.created_by_user_id === sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "You cannot dispute a match you created.");
  }

  const nowIso = isoNow(env.runtime);
  if (new Date(nowIso).getTime() > new Date(match.created_at).getTime() + DISPUTE_WINDOW_MS) {
    return errorResponse(request.requestId, "FORBIDDEN", "Matches can only be disputed within 24 hours of creation.");
  }
  const disputeId = randomId("mdispute", env.runtime);
  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO match_disputes (
          id, match_id, created_by_user_id, comment, status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5)
        ON CONFLICT(match_id, created_by_user_id) DO UPDATE SET
          comment = excluded.comment,
          status = 'active',
          updated_at = excluded.updated_at
      `,
    ).bind(disputeId, matchId, sessionUser.id, comment, nowIso),
    env.DB.prepare(
      `
        UPDATE matches
        SET has_active_dispute = 1
        WHERE id = ?1
      `,
    ).bind(matchId),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'createMatchDispute', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, matchId, JSON.stringify(request.payload), nowIso),
  ]);

  const dispute = await env.DB.prepare(
    `
      SELECT id, match_id, created_by_user_id, comment, status, created_at, updated_at
      FROM match_disputes
      WHERE match_id = ?1
        AND created_by_user_id = ?2
    `,
  )
    .bind(matchId, sessionUser.id)
    .first<{
      id: string;
      match_id: string;
      created_by_user_id: string;
      comment: string;
      status: "active" | "withdrawn";
      created_at: string;
      updated_at: string;
    }>();

  if (!dispute) {
    return errorResponse(request.requestId, "INTERNAL_ERROR", "Failed to create dispute.");
  }

  return successResponse(request.requestId, {
    matchId,
    dispute: {
      id: dispute.id,
      matchId: dispute.match_id,
      createdByUserId: dispute.created_by_user_id,
      comment: dispute.comment,
      status: dispute.status,
      createdAt: dispute.created_at,
      updatedAt: dispute.updated_at,
    },
  });
}
