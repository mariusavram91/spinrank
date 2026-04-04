import { isoNow, parseJsonArray } from "../db";
import { errorResponse, successResponse } from "../responses";
import { getSeasonById, getTournamentById } from "../services/visibility";
import type {
  ApiRequest,
  Env,
  RedeemSegmentShareLinkData,
  RedeemSegmentShareLinkPayload,
  SegmentShareLinkRow,
  UserRow,
} from "../types";

export async function handleRedeemSegmentShareLink(
  request: ApiRequest<"redeemSegmentShareLink", RedeemSegmentShareLinkPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const token = String(request.payload.shareToken || "").trim();
  if (!token) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "shareToken is required.");
  }

  const link = await env.DB.prepare(
    `
      SELECT *
      FROM segment_share_links
      WHERE share_token = ?1
    `,
  )
    .bind(token)
    .first<SegmentShareLinkRow>();

  if (!link) {
    return errorResponse(request.requestId, "NOT_FOUND", "Share link not found.");
  }

  const now = isoNow(env.runtime);
  if (link.consumed_at) {
    return errorResponse(request.requestId, "CONFLICT", "This share link has already been used.");
  }
  if (link.expires_at <= now) {
    return errorResponse(request.requestId, "CONFLICT", "This share link has expired.");
  }

  const actions = [];
  let segmentName = "";
  let joined = false;

  if (link.segment_type === "season") {
    const season = await getSeasonById(env, link.segment_id);
    if (!season || season.status === "deleted") {
      return errorResponse(request.requestId, "NOT_FOUND", "Season not found.");
    }
    segmentName = season.name;
    const participants = parseJsonArray<string>(season.participant_ids_json);
    if (!participants.includes(sessionUser.id)) {
      const nextParticipants = [...participants, sessionUser.id];
      actions.push(
        env.DB.prepare(
          `
            INSERT OR IGNORE INTO season_participants (season_id, user_id)
            VALUES (?1, ?2)
          `,
        ).bind(link.segment_id, sessionUser.id),
      );
      actions.push(
        env.DB.prepare(
          `
            UPDATE seasons
            SET participant_ids_json = ?1
            WHERE id = ?2
          `,
        ).bind(JSON.stringify(nextParticipants), link.segment_id),
      );
      joined = true;
    }
  } else {
    const tournament = await getTournamentById(env, link.segment_id);
    if (!tournament || tournament.status === "deleted") {
      return errorResponse(request.requestId, "NOT_FOUND", "Tournament not found.");
    }
    segmentName = tournament.name;
    const existing = await env.DB.prepare(
      `
        SELECT 1
        FROM tournament_participants
        WHERE tournament_id = ?1
          AND user_id = ?2
      `,
    )
      .bind(link.segment_id, sessionUser.id)
      .first<{ "1": number }>();
    if (!existing) {
      actions.push(
        env.DB.prepare(
          `
            INSERT INTO tournament_participants (tournament_id, user_id)
            VALUES (?1, ?2)
          `,
        ).bind(link.segment_id, sessionUser.id),
      );
      joined = true;
    }
  }

  actions.push(
    env.DB.prepare(
      `
        UPDATE segment_share_links
        SET consumed_at = ?1, consumed_by_user_id = ?2
        WHERE id = ?3
      `,
    ).bind(now, sessionUser.id, link.id),
  );

  if (actions.length > 0) {
    await env.DB.batch(actions);
  }

  return successResponse<RedeemSegmentShareLinkData>(request.requestId, {
    segmentType: link.segment_type,
    segmentId: link.segment_id,
    segmentName,
    joined,
  });
}
