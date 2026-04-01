import { decodeCursor, encodeCursor, parseJsonArray, parseJsonObject } from "../db";
import { successResponse } from "../responses";
import type { ApiRequest, Env, GetMatchesPayload, MatchRecord, UserRow } from "../types";

type MatchRow = {
  id: string;
  match_type: MatchRecord["matchType"];
  format_type: MatchRecord["formatType"];
  points_to_win: number;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  score_json: string;
  winner_team: MatchRecord["winnerTeam"];
  played_at: string;
  season_id: string | null;
  tournament_id: string | null;
  created_by_user_id: string;
  status: MatchRecord["status"];
  created_at: string;
  round_title: string | null;
  is_final: number | null;
};

function normalizeMatchFilter(value: unknown): GetMatchesPayload["filter"] {
  if (value === "mine" || value === "all") {
    return value;
  }

  return "recent";
}

export async function handleGetMatches(
  request: ApiRequest<"getMatches", GetMatchesPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const filter = normalizeMatchFilter(request.payload?.filter);
  const limit = Math.min(Math.max(request.payload?.limit ?? (filter === "recent" ? 4 : 20), 1), 50);
  const cursor = decodeCursor(request.payload?.cursor);

  const result = await env.DB.prepare(
    `
      WITH visible_matches AS (
        SELECT
          m.id,
          m.match_type,
          m.format_type,
          m.points_to_win,
          m.team_a_player_ids_json,
          m.team_b_player_ids_json,
          m.score_json,
          m.winner_team,
          m.played_at,
          m.season_id,
          m.tournament_id,
          m.created_by_user_id,
          m.status,
          m.created_at,
          tbm.round_title,
          tbm.is_final
        FROM matches m
        LEFT JOIN seasons s
          ON s.id = m.season_id
        LEFT JOIN season_participants sp
          ON sp.season_id = m.season_id AND sp.user_id = ?1
        LEFT JOIN tournaments t
          ON t.id = m.tournament_id
        LEFT JOIN tournament_participants tp
          ON tp.tournament_id = m.tournament_id AND tp.user_id = ?1
        LEFT JOIN tournament_bracket_matches tbm
          ON tbm.created_match_id = m.id
        WHERE m.status = 'active'
          AND (s.id IS NULL OR s.status != 'deleted')
          AND (t.id IS NULL OR t.status != 'deleted')
          AND (
            (m.season_id IS NULL AND m.tournament_id IS NULL)
            OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ?1 OR tp.user_id IS NOT NULL))
            OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
              s.is_public = 1 OR s.created_by_user_id = ?1 OR sp.user_id IS NOT NULL
            ))
          )
      )
      SELECT *
      FROM visible_matches
      WHERE (
        ?2 = 'recent'
        OR ?2 = 'all'
        OR (
          ?2 = 'mine'
          AND EXISTS (
            SELECT 1
            FROM match_players mp
            WHERE mp.match_id = visible_matches.id
              AND mp.user_id = ?1
          )
        )
      )
        AND (
          ?3 IS NULL
          OR visible_matches.played_at < ?3
          OR (visible_matches.played_at = ?3 AND visible_matches.created_at < ?4)
          OR (visible_matches.played_at = ?3 AND visible_matches.created_at = ?4 AND visible_matches.id < ?5)
        )
      ORDER BY visible_matches.played_at DESC, visible_matches.created_at DESC, visible_matches.id DESC
      LIMIT ?6
    `,
  )
    .bind(
      sessionUser.id,
      filter,
      cursor?.playedAt ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    )
    .all<MatchRow>();

  const rows = result.results;
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return successResponse(request.requestId, {
    matches: page.map<MatchRecord>((row) => ({
      id: row.id,
      matchType: row.match_type,
      formatType: row.format_type,
      pointsToWin: row.points_to_win as 11 | 21,
      teamAPlayerIds: parseJsonArray<string>(row.team_a_player_ids_json),
      teamBPlayerIds: parseJsonArray<string>(row.team_b_player_ids_json),
      score: parseJsonObject(row.score_json, []),
      winnerTeam: row.winner_team,
      playedAt: row.played_at,
      seasonId: row.season_id,
      tournamentId: row.tournament_id,
      createdByUserId: row.created_by_user_id,
      status: row.status,
      createdAt: row.created_at,
      bracketContext: row.round_title
        ? {
            roundTitle: row.round_title,
            isFinal: Boolean(row.is_final),
          }
        : null,
    })),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({
            playedAt: last.played_at,
            createdAt: last.created_at,
            id: last.id,
          })
        : null,
  });
}
