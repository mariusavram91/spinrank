import { isoNow, parseJsonArray, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { getSeasonById, getTournamentById, getTournamentParticipantIds } from "../services/visibility";
import type {
  ApiRequest,
  CreateSegmentShareLinkPayload,
  Env,
  SegmentType,
  SegmentShareLinkData,
  UserRow,
} from "../types";

const SHARE_LINK_TTL_MS = 5 * 24 * 60 * 60 * 1000;

const normalizeOrigin = (origin?: string | null): string => {
  if (!origin) {
    return "";
  }
  return origin.replace(/\/+$/, "");
};

const buildShareUrl = (env: Env, token: string): string => {
  const origin = normalizeOrigin(env.APP_ORIGIN);
  if (!origin) {
    return `?shareToken=${encodeURIComponent(token)}`;
  }
  return `${origin}?shareToken=${encodeURIComponent(token)}`;
};

const validateSegmentOwnership = async (
  env: Env,
  user: UserRow,
  segmentType: SegmentType,
  segmentId: string,
): Promise<{ name: string } | null> => {
  if (segmentType === "season") {
    const season = await getSeasonById(env, segmentId);
    if (!season || season.status === "deleted") {
      return null;
    }
    if (season.created_by_user_id === user.id) {
      return { name: season.name };
    }
    const participants = parseJsonArray<string>(season.participant_ids_json);
    if (participants.includes(user.id)) {
      return { name: season.name };
    }
    return null;
  }
  const tournament = await getTournamentById(env, segmentId);
  if (!tournament || tournament.status === "deleted") {
    return null;
  }
  if (tournament.created_by_user_id === user.id) {
    return { name: tournament.name };
  }
  const participants = await getTournamentParticipantIds(env, tournament.id);
  if (participants.includes(user.id)) {
    return { name: tournament.name };
  }
  return null;
};

export async function handleCreateSegmentShareLink(
  request: ApiRequest<"createSegmentShareLink", CreateSegmentShareLinkPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const payload = request.payload;
  const segmentType = payload.segmentType;
  if (segmentType !== "season" && segmentType !== "tournament") {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Invalid segment type.");
  }
  const segmentId = String(payload.segmentId || "").trim();
  if (!segmentId) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Segment ID is required.");
  }

  const ownership = await validateSegmentOwnership(env, sessionUser, segmentType, segmentId);
  if (!ownership) {
    return errorResponse(
      request.requestId,
      "FORBIDDEN",
      "You must be the creator or a participant of this segment to create a share link.",
    );
  }

  const now = isoNow();
  const dedupStatement = env.DB.prepare(
    `
      INSERT INTO request_dedup (action, request_id, target_id, created_at)
      VALUES ('createSegmentShareLink', ?1, ?2, ?3)
      ON CONFLICT(action, request_id) DO NOTHING
    `,
  ).bind(request.requestId, `${segmentType}:${segmentId}`, now);

  await env.DB.prepare(
    `
      UPDATE segment_share_links
      SET consumed_at = ?1,
          consumed_by_user_id = ?2
      WHERE segment_type = ?3
        AND segment_id = ?4
        AND created_by_user_id = ?5
        AND consumed_at IS NULL
        AND expires_at > ?6
    `,
  )
    .bind(now, sessionUser.id, segmentType, segmentId, sessionUser.id, now)
    .run();

  const shareToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS).toISOString();
  const linkId = randomId("share");
  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO segment_share_links (
          id, segment_type, segment_id, created_by_user_id,
          share_token, expires_at, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    ).bind(linkId, segmentType, segmentId, sessionUser.id, shareToken, expiresAt, now),
    dedupStatement,
  ]);

  return successResponse<SegmentShareLinkData>(request.requestId, {
    shareToken,
    expiresAt,
    url: buildShareUrl(env, shareToken),
  });
}
