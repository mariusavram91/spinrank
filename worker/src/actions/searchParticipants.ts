import { successResponse } from "../responses";
import type { ApiRequest, Env, ParticipantSearchEntry, SearchParticipantsPayload, UserRow } from "../types";

const clampLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 12;
  }
  return Math.max(1, Math.min(25, Math.trunc(Number(value))));
};

export async function handleSearchParticipants(
  request: ApiRequest<"searchParticipants", SearchParticipantsPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const query = String(request.payload?.query || "").trim();
  const seasonId = request.payload?.seasonId ? String(request.payload.seasonId).trim() : null;
  const limit = clampLimit(request.payload?.limit);

  const rows = await env.DB.prepare(
    `
      WITH match_related AS (
        SELECT DISTINCT mp_other.user_id
        FROM match_players mp_self
        JOIN match_players mp_other ON mp_self.match_id = mp_other.match_id
        JOIN matches m ON m.id = mp_self.match_id
        WHERE mp_self.user_id = ?1
          AND mp_other.user_id <> ?1
          AND m.status = 'active'
      ),
      season_related AS (
        SELECT DISTINCT sp_other.user_id
        FROM season_participants sp_self
        JOIN season_participants sp_other ON sp_self.season_id = sp_other.season_id
        JOIN seasons s ON s.id = sp_self.season_id
        WHERE sp_self.user_id = ?1
          AND sp_other.user_id <> ?1
          AND s.status <> 'deleted'
      ),
      tournament_related AS (
        SELECT DISTINCT tp_other.user_id
        FROM tournament_participants tp_self
        JOIN tournament_participants tp_other ON tp_self.tournament_id = tp_other.tournament_id
        JOIN tournaments t ON t.id = tp_self.tournament_id
        WHERE tp_self.user_id = ?1
          AND tp_other.user_id <> ?1
          AND t.status <> 'deleted'
      ),
      candidates AS (
        SELECT
          u.id,
          u.display_name,
          u.avatar_url,
          u.global_elo,
          CASE WHEN mr.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_match,
          CASE WHEN sr.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_season,
          CASE WHEN tr.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_tournament
        FROM users u
        LEFT JOIN match_related mr ON mr.user_id = u.id
        LEFT JOIN season_related sr ON sr.user_id = u.id
        LEFT JOIN tournament_related tr ON tr.user_id = u.id
        WHERE u.id <> ?1
          AND (?2 = '' OR LOWER(u.display_name) LIKE '%' || LOWER(?2) || '%')
          AND (
            ?3 IS NULL
            OR EXISTS (
              SELECT 1
              FROM season_participants sp_filter
              WHERE sp_filter.season_id = ?3
                AND sp_filter.user_id = u.id
            )
          )
      )
      SELECT
        id,
        display_name,
        avatar_url,
        global_elo,
        has_match,
        has_season,
        has_tournament
      FROM candidates
      WHERE ?2 <> '' OR has_match = 1 OR has_season = 1 OR has_tournament = 1
      ORDER BY
        CASE
          WHEN ?2 <> '' AND LOWER(display_name) = LOWER(?2) THEN 0
          WHEN ?2 <> '' AND LOWER(display_name) LIKE LOWER(?2) || '%' THEN 1
          WHEN ?2 <> '' THEN 2
          ELSE 3
        END ASC,
        (has_match * 4 + has_season * 2 + has_tournament) DESC,
        global_elo DESC,
        display_name ASC
      LIMIT ?4
    `,
  )
    .bind(sessionUser.id, query, seasonId, limit)
    .all<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
      has_match: number;
      has_season: number;
      has_tournament: number;
    }>();

  const participants = rows.results.map<ParticipantSearchEntry>((row) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.global_elo),
    isSuggested: Boolean(row.has_match || row.has_season || row.has_tournament),
  }));

  return successResponse(request.requestId, { participants });
}
