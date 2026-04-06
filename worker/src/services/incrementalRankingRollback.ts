import { parseJsonArray, parseJsonObject } from "../db";
import type { Env } from "../types";

type DeletedMatchRow = {
  id: string;
  match_type: "singles" | "doubles";
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  winner_team: "A" | "B";
  played_at: string;
  created_at: string;
};

type PlayerMatchHistoryRow = {
  user_id: string;
  winner_team: "A" | "B";
  player_team: "A" | "B";
  global_elo_delta_json: string;
  played_at: string;
  created_at: string;
};

type DeletedMatchCursor = {
  id: string;
  playedAt: string;
  createdAt: string;
};

function buildInClausePlaceholders(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, index) => `?${startIndex + index}`).join(", ");
}

function getAffectedUserIds(matches: DeletedMatchRow[]): string[] {
  return [...new Set(matches.flatMap((match) => [
    ...parseJsonArray<string>(match.team_a_player_ids_json),
    ...parseJsonArray<string>(match.team_b_player_ids_json),
  ]))];
}

function isLater(left: DeletedMatchCursor, right: DeletedMatchCursor): boolean {
  if (left.playedAt !== right.playedAt) {
    return left.playedAt > right.playedAt;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt > right.createdAt;
  }
  return left.id > right.id;
}

function buildLatestDeletedMatchByUser(matches: DeletedMatchRow[]): Map<string, DeletedMatchCursor> {
  const latestByUser = new Map<string, DeletedMatchCursor>();

  matches.forEach((match) => {
    const cursor = {
      id: match.id,
      playedAt: match.played_at,
      createdAt: match.created_at,
    };
    [...parseJsonArray<string>(match.team_a_player_ids_json), ...parseJsonArray<string>(match.team_b_player_ids_json)].forEach(
      (userId) => {
        const current = latestByUser.get(userId);
        if (!current || isLater(cursor, current)) {
          latestByUser.set(userId, cursor);
        }
      },
    );
  });

  return latestByUser;
}

async function hasLaterActiveMatches(env: Env, userId: string, cursor: DeletedMatchCursor): Promise<boolean> {
  const laterMatch = await env.DB.prepare(
    `
      SELECT 1
      FROM matches m
      INNER JOIN match_players mp
        ON mp.match_id = m.id
      WHERE mp.user_id = ?1
        AND m.status = 'active'
        AND (
          m.played_at > ?2
          OR (m.played_at = ?2 AND m.created_at > ?3)
          OR (m.played_at = ?2 AND m.created_at = ?3 AND m.id > ?4)
        )
      LIMIT 1
    `,
  )
    .bind(userId, cursor.playedAt, cursor.createdAt, cursor.id)
    .first<{ 1: number }>();

  return Boolean(laterMatch);
}

async function loadPlayerHistoryRows(env: Env, userIds: string[]): Promise<PlayerMatchHistoryRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const placeholders = buildInClausePlaceholders(userIds.length, 1);
  const result = await env.DB.prepare(
    `
      SELECT
        mp.user_id,
        m.winner_team,
        mp.team AS player_team,
        m.global_elo_delta_json,
        m.played_at,
        m.created_at
      FROM matches m
      INNER JOIN match_players mp
        ON mp.match_id = m.id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
    `,
  )
    .bind(...userIds)
    .all<PlayerMatchHistoryRow>();

  return result.results;
}

function replayGlobalUserState(userId: string, rows: PlayerMatchHistoryRow[], nowIso: string) {
  const nextState = {
    elo: 1200,
    wins: 0,
    losses: 0,
    streak: 0,
    updatedAt: nowIso,
  };

  rows.forEach((row) => {
    const deltaMap = parseJsonObject<Record<string, number>>(row.global_elo_delta_json, {});
    const didWin = row.winner_team === row.player_team;
    nextState.elo += Number(deltaMap[userId] ?? 0);
    if (didWin) {
      nextState.wins += 1;
      nextState.streak = nextState.streak >= 0 ? nextState.streak + 1 : 1;
    } else {
      nextState.losses += 1;
      nextState.streak = nextState.streak <= 0 ? nextState.streak - 1 : -1;
    }
    nextState.updatedAt = row.created_at || row.played_at || nowIso;
  });

  return nextState;
}

export async function applyIncrementalGlobalRollbackForDeletedMatches(
  env: Env,
  deletedMatches: DeletedMatchRow[],
  nowIso: string,
): Promise<boolean> {
  const affectedUserIds = getAffectedUserIds(deletedMatches);
  if (affectedUserIds.length === 0) {
    return true;
  }

  const latestByUser = buildLatestDeletedMatchByUser(deletedMatches);
  for (const [userId, cursor] of latestByUser.entries()) {
    if (await hasLaterActiveMatches(env, userId, cursor)) {
      return false;
    }
  }

  const historyRows = await loadPlayerHistoryRows(env, affectedUserIds);
  const historyByUserId = new Map<string, PlayerMatchHistoryRow[]>();
  historyRows.forEach((row) => {
    const bucket = historyByUserId.get(row.user_id) ?? [];
    bucket.push(row);
    historyByUserId.set(row.user_id, bucket);
  });

  await env.DB.batch(
    affectedUserIds.map((userId) => {
      const state = replayGlobalUserState(userId, historyByUserId.get(userId) ?? [], nowIso);
      return env.DB.prepare(
        `
          UPDATE users
          SET global_elo = ?2,
              wins = ?3,
              losses = ?4,
              streak = ?5,
              updated_at = ?6
          WHERE id = ?1
        `,
      ).bind(userId, state.elo, state.wins, state.losses, state.streak, state.updatedAt);
    }),
  );

  return true;
}
