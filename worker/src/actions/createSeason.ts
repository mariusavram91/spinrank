import { dateOnly, isoNow, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { getSeasonById } from "../services/visibility";
import type { ApiRequest, CreateSeasonPayload, Env, SeasonRecord, UserRow } from "../types";

function normalizeParticipantIds(ids: string[], userId: string): string[] {
  const deduped = [...new Set(ids.map((value) => String(value || "").trim()).filter(Boolean))];
  if (!deduped.includes(userId)) {
    deduped.unshift(userId);
  }
  return deduped;
}

async function validatePlayers(env: Env, playerIds: string[]): Promise<boolean> {
  const placeholders = playerIds.map((_, index) => `?${index + 1}`).join(",");
  const result = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM users
      WHERE id IN (${placeholders})
    `,
  )
    .bind(...playerIds)
    .first<{ count: number }>();

  return Number(result?.count || 0) === playerIds.length;
}

function toSeasonRecord(row: {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: SeasonRecord["status"];
  baseEloMode: SeasonRecord["baseEloMode"];
  participantIds: string[];
  createdByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
  isPublic: boolean;
}): SeasonRecord {
  return row;
}

export async function handleCreateSeason(
  request: ApiRequest<"createSeason", CreateSeasonPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const payload = request.payload;
  const name = String(payload.name || "").trim();
  const startDate = String(payload.startDate || "").trim();
  const endDate = payload.endDate ? String(payload.endDate).trim() : "";
  const baseEloMode = payload.baseEloMode || "carry_over";
  const participantIds = normalizeParticipantIds(payload.participantIds || [], sessionUser.id);
  const isPublic = Boolean(payload.isPublic);

  if (!name) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Season name is required.");
  }
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Season start date is required.");
  }
  if (endDate && startDate > endDate) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Season end date cannot be earlier than the start date.");
  }
  if (baseEloMode !== "carry_over" && baseEloMode !== "reset_1200") {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Invalid base Elo mode.");
  }
  if (!(await validatePlayers(env, participantIds))) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "Season participants must all exist.");
  }

  const existing = payload.seasonId ? await getSeasonById(env, payload.seasonId) : null;
  if (existing && existing.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can edit this season.");
  }
  if (
    existing &&
    (existing.status === "deleted" ||
      existing.status === "completed" ||
      (existing.end_date && dateOnly(isoNow(env.runtime)) > existing.end_date))
  ) {
    return errorResponse(request.requestId, "CONFLICT", "This season can no longer be edited.");
  }

  const nowIso = isoNow(env.runtime);
  const seasonId = existing?.id ?? payload.seasonId ?? randomId("season", env.runtime);
  const isActive = Boolean(payload.isActive);

  const batch = [];

  batch.push(
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          base_elo_mode = excluded.base_elo_mode,
          participant_ids_json = excluded.participant_ids_json,
          is_public = excluded.is_public
      `,
    ).bind(
      seasonId,
      name,
      startDate,
      endDate,
      isActive ? 1 : 0,
      existing?.status ?? "active",
      baseEloMode,
      JSON.stringify(participantIds),
      existing?.created_by_user_id ?? sessionUser.id,
      existing?.created_at ?? nowIso,
      existing?.completed_at ?? null,
      isPublic ? 1 : 0,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    ...participantIds.map((participantId) =>
      env.DB.prepare(
        `
          INSERT INTO season_participants (season_id, user_id)
          VALUES (?1, ?2)
        `,
      ).bind(seasonId, participantId),
    ),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'createSeason', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, seasonId, JSON.stringify(payload), nowIso),
  );

  await env.DB.batch(batch);

  return successResponse(request.requestId, {
    season: toSeasonRecord({
      id: seasonId,
      name,
      startDate,
      endDate,
      isActive,
      status: existing?.status ?? "active",
      baseEloMode,
      participantIds,
      createdByUserId: existing?.created_by_user_id ?? sessionUser.id,
      createdAt: existing?.created_at ?? nowIso,
      completedAt: existing?.completed_at ?? null,
      isPublic,
    }),
  });
}
