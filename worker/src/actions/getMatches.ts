import { decodeCursor, encodeCursor, parseJsonArray, parseJsonObject } from "../db";
import { successResponse } from "../responses";
import { mapMatchRecordRow } from "../services/matchGuards";
import type { ApiRequest, Env, GetMatchesPayload, LeaderboardEntry, MatchRecord, UserRow } from "../types";

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
  delete_locked_at: string | null;
  has_active_dispute: number;
  dispute_id: string | null;
  dispute_created_by_user_id: string | null;
  dispute_comment: string | null;
  dispute_status: string | null;
  dispute_created_at: string | null;
  dispute_updated_at: string | null;
  round_title: string | null;
  is_final: number | null;
};

type MatchCursor = {
  playedAt: string;
  createdAt: string;
  id: string;
} | null;

function buildSelectColumns(): string {
  return `
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
    m.delete_locked_at,
    m.has_active_dispute,
    viewer_dispute.id AS dispute_id,
    viewer_dispute.created_by_user_id AS dispute_created_by_user_id,
    viewer_dispute.comment AS dispute_comment,
    viewer_dispute.status AS dispute_status,
    viewer_dispute.created_at AS dispute_created_at,
    viewer_dispute.updated_at AS dispute_updated_at,
    tbm.round_title,
    tbm.is_final
  `;
}

function buildVisibilityJoins(userBinding: string): string {
  return `
    LEFT JOIN seasons s
      ON s.id = m.season_id
    LEFT JOIN season_participants sp
      ON sp.season_id = m.season_id AND sp.user_id = ${userBinding}
    LEFT JOIN tournaments t
      ON t.id = m.tournament_id
    LEFT JOIN tournament_participants tp
      ON tp.tournament_id = m.tournament_id AND tp.user_id = ${userBinding}
    LEFT JOIN tournament_bracket_matches tbm
      ON tbm.created_match_id = m.id
    LEFT JOIN match_disputes viewer_dispute
      ON viewer_dispute.match_id = m.id
     AND viewer_dispute.created_by_user_id = ${userBinding}
     AND viewer_dispute.status = 'active'
  `;
}

function buildVisibilityPredicate(userBinding: string): string {
  return `
    m.status = 'active'
    AND (s.id IS NULL OR s.status != 'deleted')
    AND (t.id IS NULL OR t.status != 'deleted')
    AND (
      (m.season_id IS NULL AND m.tournament_id IS NULL)
      OR (m.tournament_id IS NOT NULL AND (t.created_by_user_id = ${userBinding} OR tp.user_id IS NOT NULL))
      OR (m.tournament_id IS NULL AND m.season_id IS NOT NULL AND (
        s.is_public = 1 OR s.created_by_user_id = ${userBinding} OR sp.user_id IS NOT NULL
      ))
    )
  `;
}

function isDashboardPreviewMode(payload: GetMatchesPayload | undefined): boolean {
  return payload?.mode === "dashboard_preview";
}

function buildCursorPredicate(alias: string): string {
  return `
    ?2 IS NULL
    OR ${alias}.played_at < ?2
    OR (${alias}.played_at = ?2 AND ${alias}.created_at < ?3)
    OR (${alias}.played_at = ?2 AND ${alias}.created_at = ?3 AND ${alias}.id < ?4)
  `;
}

function buildInClausePlaceholders(count: number): string {
  return Array.from({ length: count }, (_, index) => `?${index + 1}`).join(", ");
}

async function loadTargetMatches(
  env: Env,
  sessionUserId: string,
  filter: GetMatchesPayload["filter"],
  targetMatchIds: string[],
): Promise<MatchRow[]> {
  if (targetMatchIds.length === 0) {
    return [];
  }

  const viewerJoin =
    filter === "mine" ? "INNER JOIN match_players viewer_mp ON viewer_mp.match_id = m.id AND viewer_mp.user_id = ?1" : "";
  const placeholders = buildInClausePlaceholders(targetMatchIds.length);
  const result = await env.DB.prepare(
    `
      SELECT
        ${buildSelectColumns()}
      FROM matches m
      ${viewerJoin}
      ${buildVisibilityJoins("?1")}
      WHERE ${buildVisibilityPredicate("?1")}
        AND m.id IN (${placeholders})
    `,
  )
    .bind(sessionUserId, ...targetMatchIds)
    .all<MatchRow>();

  const byId = new Map(result.results.map((row) => [row.id, row]));
  return targetMatchIds.map((matchId) => byId.get(matchId)).filter((row): row is MatchRow => Boolean(row));
}

function mapMatchRow(row: MatchRow): MatchRecord {
  const match = mapMatchRecordRow(row);
  return {
    ...match,
    bracketContext: row.round_title
      ? {
          roundTitle: row.round_title,
          isFinal: Boolean(row.is_final),
        }
      : null,
  };
}

async function loadPlayersForMatches(env: Env, rows: MatchRow[]): Promise<LeaderboardEntry[]> {
  const userIds = [...new Set(rows.flatMap((row) => [
    ...parseJsonArray<string>(row.team_a_player_ids_json),
    ...parseJsonArray<string>(row.team_b_player_ids_json),
  ]))];

  if (userIds.length === 0) {
    return [];
  }

  const result = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo, wins, losses, streak
      FROM users
      WHERE id IN (${buildInClausePlaceholders(userIds.length)})
    `,
  )
    .bind(...userIds)
    .all<{
      id: string;
      display_name: string;
      avatar_url: string | null;
      global_elo: number;
      wins: number;
      losses: number;
      streak: number;
    }>();

  return result.results.map<LeaderboardEntry>((row, index) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    elo: Number(row.global_elo),
    wins: Number(row.wins),
    losses: Number(row.losses),
    streak: Number(row.streak),
    rank: index + 1,
  }));
}

async function buildMatchPageResponse(requestId: string, env: Env, rows: MatchRow[], limit: number) {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const players = await loadPlayersForMatches(env, page);

  return successResponse(requestId, {
    matches: page.map<MatchRecord>(mapMatchRow),
    players,
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

async function loadDashboardPreviewMatches(
  env: Env,
  sessionUserId: string,
  filter: GetMatchesPayload["filter"],
  matchType: MatchRecord["matchType"] | null,
  limit: number,
): Promise<MatchRow[]> {
  const viewerJoin =
    filter === "mine" ? "INNER JOIN match_players viewer_mp ON viewer_mp.match_id = m.id AND viewer_mp.user_id = ?1" : "";

  const result = await env.DB.prepare(
    `
      SELECT
        ${buildSelectColumns()}
      FROM matches m
      ${viewerJoin}
      ${buildVisibilityJoins("?1")}
      WHERE ${buildVisibilityPredicate("?1")}
        AND (?2 IS NULL OR m.match_type = ?2)
      ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
      LIMIT ?3
    `,
  )
    .bind(sessionUserId, matchType, limit + 1)
    .all<MatchRow>();

  return result.results;
}

async function loadRecentOrAllMatches(
  env: Env,
  sessionUserId: string,
  cursor: MatchCursor,
  matchType: MatchRecord["matchType"] | null,
  limit: number,
): Promise<MatchRow[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        ${buildSelectColumns()}
      FROM matches m
      ${buildVisibilityJoins("?1")}
      WHERE ${buildVisibilityPredicate("?1")}
        AND (?5 IS NULL OR m.match_type = ?5)
        AND (${buildCursorPredicate("m")})
      ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
      LIMIT ?6
    `,
  )
    .bind(sessionUserId, cursor?.playedAt ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, matchType, limit + 1)
    .all<MatchRow>();

  return result.results;
}

async function loadMineMatches(
  env: Env,
  sessionUserId: string,
  cursor: MatchCursor,
  matchType: MatchRecord["matchType"] | null,
  limit: number,
): Promise<MatchRow[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        ${buildSelectColumns()}
      FROM matches m
      INNER JOIN match_players viewer_mp
        ON viewer_mp.match_id = m.id AND viewer_mp.user_id = ?1
      ${buildVisibilityJoins("?1")}
      WHERE ${buildVisibilityPredicate("?1")}
        AND (?5 IS NULL OR m.match_type = ?5)
        AND (${buildCursorPredicate("m")})
      ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
      LIMIT ?6
    `,
  )
    .bind(sessionUserId, cursor?.playedAt ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, matchType, limit + 1)
    .all<MatchRow>();

  return result.results;
}

function normalizeMatchFilter(value: unknown): GetMatchesPayload["filter"] {
  if (value === "mine" || value === "all") {
    return value;
  }

  return "recent";
}

function normalizeMatchType(value: unknown): MatchRecord["matchType"] | null {
  if (value === "singles" || value === "doubles") {
    return value;
  }
  return null;
}

export async function handleGetMatches(
  request: ApiRequest<"getMatches", GetMatchesPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const filter = normalizeMatchFilter(request.payload?.filter);
  const limit = Math.min(Math.max(request.payload?.limit ?? (filter === "recent" ? 4 : 20), 1), 50);
  const matchType = normalizeMatchType(request.payload?.matchType);
  const cursor = decodeCursor(request.payload?.cursor);
  const targetMatchIds = [...new Set((request.payload?.targetMatchIds ?? []).filter((value): value is string => Boolean(value)))].slice(0, 10);
  const dashboardPreview = isDashboardPreviewMode(request.payload) && !cursor;

  if (targetMatchIds.length > 0) {
    const rows = await loadTargetMatches(env, sessionUser.id, filter, targetMatchIds);
    return buildMatchPageResponse(request.requestId, env, rows, rows.length);
  }

  if (dashboardPreview) {
    const rows = await loadDashboardPreviewMatches(env, sessionUser.id, filter, matchType, limit);
    return buildMatchPageResponse(request.requestId, env, rows, limit);
  }

  const rows =
    filter === "mine"
    ? await loadMineMatches(env, sessionUser.id, cursor, matchType, limit)
    : await loadRecentOrAllMatches(env, sessionUser.id, cursor, matchType, limit);

  return buildMatchPageResponse(request.requestId, env, rows, limit);
}
