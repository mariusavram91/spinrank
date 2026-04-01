import { parseJsonArray } from "../db";
import { successResponse } from "../responses";
import { visibleSeasonsSql } from "../services/visibility";
import type { ApiRequest, Env, SeasonRecord, SeasonRow, UserRow } from "../types";

export async function handleGetSeasons(
  request: ApiRequest<"getSeasons">,
  sessionUser: UserRow,
  env: Env,
) {
  const result = await env.DB.prepare(
    `
      ${visibleSeasonsSql}
      ORDER BY s.is_active DESC, s.start_date DESC, s.id DESC
    `,
  )
    .bind(sessionUser.id)
    .all<SeasonRow>();

  const seasons = result.results.map<SeasonRecord>((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
    status: row.status,
    baseEloMode: row.base_elo_mode,
    participantIds: parseJsonArray<string>(row.participant_ids_json),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    isPublic: Boolean(row.is_public),
  }));

  return successResponse(request.requestId, { seasons });
}
