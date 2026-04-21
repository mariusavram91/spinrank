import { dateOnly, isoNow, parseJsonArray, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { canAccessSeason, getSeasonById } from "../services/visibility";
import type { ApiRequest, CreateGuestPlayerPayload, Env, ParticipantSearchEntry, UserRow } from "../types";

const MAX_DISPLAY_NAME_LENGTH = 80;

export async function handleCreateGuestPlayer(
  request: ApiRequest<"createGuestPlayer", CreateGuestPlayerPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const displayName = String(request.payload.displayName || "").trim();
  const requestedSeasonId = request.payload.seasonId ? String(request.payload.seasonId).trim() : "";
  const seasonId = requestedSeasonId || null;

  if (!displayName) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Display name is required.");
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return errorResponse(
      request.requestId,
      "VALIDATION_ERROR",
      `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    );
  }

  let seasonParticipantIds: string[] | null = null;
  if (seasonId) {
    const season = await getSeasonById(env, seasonId);
    if (!season) {
      return errorResponse(request.requestId, "NOT_FOUND", "Season not found.");
    }
    if (!canAccessSeason(season, sessionUser.id)) {
      return errorResponse(request.requestId, "FORBIDDEN", "You do not have access to this season.");
    }
    if (
      season.status === "deleted" ||
      season.status === "completed" ||
      (season.end_date && dateOnly(isoNow(env.runtime)) > season.end_date)
    ) {
      return errorResponse(request.requestId, "CONFLICT", "This season can no longer be edited.");
    }
    seasonParticipantIds = parseJsonArray<string>(season.participant_ids_json);
    const isSeasonMember = season.created_by_user_id === sessionUser.id || seasonParticipantIds.includes(sessionUser.id);
    if (!isSeasonMember) {
      return errorResponse(
        request.requestId,
        "FORBIDDEN",
        "Only the season creator or a season participant can add guest players.",
      );
    }
  }

  const nowIso = isoNow(env.runtime);
  const existingGuest = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo
      FROM users
      WHERE provider = 'guest'
        AND LOWER(display_name) = LOWER(?1)
      ORDER BY created_at ASC
      LIMIT 1
    `,
  )
    .bind(displayName)
    .first<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
    }>();

  const userId = existingGuest?.id ?? randomId("user", env.runtime);
  const nextSeasonParticipantIds = seasonParticipantIds ? [...new Set([...seasonParticipantIds, userId])] : null;

  const statements = [
    ...(
      existingGuest
        ? []
        : [
            env.DB.prepare(
              `
                INSERT INTO users (
                  id, provider, provider_user_id, email, display_name, avatar_url, locale, created_at, updated_at
                )
                VALUES (?1, 'guest', ?2, NULL, ?3, NULL, 'en', ?4, ?4)
              `,
            ).bind(userId, randomId("guest", env.runtime), displayName, nowIso),
          ]
    ),
  ];

  if (seasonId && nextSeasonParticipantIds) {
    statements.push(
      env.DB.prepare(
        `
          UPDATE seasons
          SET participant_ids_json = ?1
          WHERE id = ?2
        `,
      ).bind(JSON.stringify(nextSeasonParticipantIds), seasonId),
      env.DB.prepare(
        `
          INSERT OR IGNORE INTO season_participants (season_id, user_id)
          VALUES (?1, ?2)
        `,
      ).bind(seasonId, userId),
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  const participant: ParticipantSearchEntry = {
    userId,
    displayName: existingGuest?.display_name ?? displayName,
    avatarUrl: existingGuest?.avatar_url ?? null,
    elo: Number(existingGuest?.global_elo ?? 1200),
    isSuggested: false,
  };

  return successResponse(request.requestId, {
    participant,
    seasonId,
    seasonParticipantIds: nextSeasonParticipantIds,
  });
}
