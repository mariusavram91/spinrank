import { parseJsonArray, parseJsonObject } from "../db";
import type {
  CreateMatchPayload,
  DuplicateMatchCandidate,
  Env,
  LeaderboardEntry,
  MatchDisputeRecord,
  MatchRecord,
} from "../types";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DELETE_GRACE_PERIOD_MS = 45 * 60 * 1000;

type DuplicateMatchRow = {
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
  created_by_display_name: string;
  status: MatchRecord["status"];
  created_at: string;
  delete_locked_at: string | null;
  has_active_dispute: number;
};

export function normalizeTeamPlayerIds(playerIds: string[]): string[] {
  return [...playerIds].sort((left, right) => left.localeCompare(right));
}

export function buildMatchupKey(teamAPlayerIds: string[], teamBPlayerIds: string[]): string {
  const left = normalizeTeamPlayerIds(teamAPlayerIds).join(",");
  const right = normalizeTeamPlayerIds(teamBPlayerIds).join(",");
  return [left, right].sort((a, b) => a.localeCompare(b)).join("::");
}

export function computeDeleteLockedAt(createdAt: string): string {
  const date = new Date(createdAt);
  date.setTime(date.getTime() + DELETE_GRACE_PERIOD_MS);
  return date.toISOString();
}

export function isMatchDeletionAllowed(match: Pick<MatchRecord, "createdByUserId" | "deleteLockedAt" | "hasActiveDispute">, sessionUserId: string, nowIso: string): boolean {
  if (match.createdByUserId !== sessionUserId) {
    return false;
  }
  if (match.hasActiveDispute) {
    return true;
  }
  if (!match.deleteLockedAt) {
    return false;
  }
  return new Date(nowIso).getTime() <= new Date(match.deleteLockedAt).getTime();
}

function mapDisputeRow(row: {
  dispute_id: string | null;
  dispute_created_by_user_id: string | null;
  dispute_comment: string | null;
  dispute_status: string | null;
  dispute_created_at: string | null;
  dispute_updated_at: string | null;
}): MatchDisputeRecord | null {
  if (!row.dispute_id || !row.dispute_created_by_user_id || !row.dispute_status || !row.dispute_created_at || !row.dispute_updated_at) {
    return null;
  }

  return {
    id: row.dispute_id,
    matchId: "",
    createdByUserId: row.dispute_created_by_user_id,
    comment: row.dispute_comment || "",
    status: row.dispute_status as MatchDisputeRecord["status"],
    createdAt: row.dispute_created_at,
    updatedAt: row.dispute_updated_at,
  };
}

export function mapMatchRecordRow(
  row: {
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
    delete_locked_at?: string | null;
    has_active_dispute?: number;
    dispute_id?: string | null;
    dispute_created_by_user_id?: string | null;
    dispute_comment?: string | null;
    dispute_status?: string | null;
    dispute_created_at?: string | null;
    dispute_updated_at?: string | null;
  },
): MatchRecord {
  const currentUserDispute = mapDisputeRow({
    dispute_id: row.dispute_id ?? null,
    dispute_created_by_user_id: row.dispute_created_by_user_id ?? null,
    dispute_comment: row.dispute_comment ?? null,
    dispute_status: row.dispute_status ?? null,
    dispute_created_at: row.dispute_created_at ?? null,
    dispute_updated_at: row.dispute_updated_at ?? null,
  });

  return {
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
    deleteLockedAt: row.delete_locked_at ?? null,
    hasActiveDispute: Boolean(row.has_active_dispute),
    currentUserDispute: currentUserDispute
      ? {
          ...currentUserDispute,
          matchId: row.id,
        }
      : null,
  };
}

export async function findDuplicateMatches(
  env: Env,
  payload: Pick<CreateMatchPayload, "teamAPlayerIds" | "teamBPlayerIds" | "playedAt">,
): Promise<DuplicateMatchCandidate[]> {
  const matchupKey = buildMatchupKey(payload.teamAPlayerIds, payload.teamBPlayerIds);
  const playedAtMs = new Date(payload.playedAt).getTime();
  const lowerBound = new Date(playedAtMs - DUPLICATE_WINDOW_MS).toISOString();
  const upperBound = new Date(playedAtMs + DUPLICATE_WINDOW_MS).toISOString();

  const result = await env.DB.prepare(
    `
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
        u.display_name AS created_by_display_name,
        m.status,
        m.created_at,
        m.delete_locked_at,
        m.has_active_dispute
      FROM matches m
      INNER JOIN users u
        ON u.id = m.created_by_user_id
      WHERE m.status = 'active'
        AND m.matchup_key = ?1
        AND m.played_at >= ?2
        AND m.played_at <= ?3
      ORDER BY ABS(unixepoch(m.played_at) - unixepoch(?4)) ASC, m.created_at DESC, m.id DESC
      LIMIT 5
    `,
  )
    .bind(matchupKey, lowerBound, upperBound, payload.playedAt)
    .all<DuplicateMatchRow>();

  return result.results.map((row) => ({
    ...mapMatchRecordRow(row),
    createdByDisplayName: row.created_by_display_name,
  }));
}

export async function loadPlayersForDuplicateMatches(
  env: Env,
  matches: DuplicateMatchCandidate[],
): Promise<LeaderboardEntry[]> {
  const userIds = [...new Set(matches.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds]))];
  if (userIds.length === 0) {
    return [];
  }

  const placeholders = userIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await env.DB.prepare(
    `
      SELECT id, display_name, avatar_url, global_elo, wins, losses, streak
      FROM users
      WHERE id IN (${placeholders})
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
