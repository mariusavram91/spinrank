import { isoNow, parseJsonArray, parseJsonObject, randomId } from "../db";
import { errorResponse, successResponse } from "../responses";
import { rebuildTournamentBracket } from "../services/brackets";
import { createBlankRatingState, recomputeAllRankings } from "../services/elo";
import type { ApiRequest, DeactivateEntityPayload, Env, UserRow } from "../types";

type DeactivateMatchRow = {
  id: string;
  created_by_user_id: string;
  status: string;
  tournament_id: string | null;
  season_id: string | null;
  match_type: "singles" | "doubles";
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  winner_team: "A" | "B";
  global_elo_delta_json: string;
  segment_elo_delta_json: string;
  played_at: string;
  created_at: string;
};

type PlayerMatchHistoryRow = {
  user_id: string;
  match_type: "singles" | "doubles";
  winner_team: "A" | "B";
  player_team: "A" | "B";
  global_elo_delta_json: string;
  segment_elo_delta_json: string;
  played_at: string;
  created_at: string;
};

function getMatchEquivalent(matchType: "singles" | "doubles"): number {
  return matchType === "singles" ? 1 : 0.7;
}

function buildInClausePlaceholders(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, index) => `?${startIndex + index}`).join(", ");
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

function replayTournamentSegmentState(
  userId: string,
  tournamentId: string,
  rows: PlayerMatchHistoryRow[],
  nowIso: string,
) {
  const nextState = createBlankRatingState(nowIso);

  rows.forEach((row) => {
    const segmentDelta = parseJsonObject<Record<string, Record<string, number>>>(row.segment_elo_delta_json, {});
    const tournamentDelta = segmentDelta[tournamentId] ?? {};
    const didWin = row.winner_team === row.player_team;
    nextState.elo += Number(tournamentDelta[userId] ?? 0);
    nextState.matchesPlayed += 1;
    nextState.matchEquivalentPlayed = Math.round((nextState.matchEquivalentPlayed + getMatchEquivalent(row.match_type)) * 10) / 10;
    nextState.lastMatchAt = row.played_at || nextState.lastMatchAt;
    nextState.updatedAt = row.created_at || row.played_at || nowIso;
    if (didWin) {
      nextState.wins += 1;
      nextState.streak = nextState.streak >= 0 ? nextState.streak + 1 : 1;
    } else {
      nextState.losses += 1;
      nextState.streak = nextState.streak <= 0 ? nextState.streak - 1 : -1;
    }
  });

  return nextState;
}

async function hasLaterActiveMatches(
  env: Env,
  userIds: string[],
  match: Pick<DeactivateMatchRow, "id" | "played_at" | "created_at">,
): Promise<boolean> {
  if (userIds.length === 0) {
    return false;
  }

  const placeholders = buildInClausePlaceholders(userIds.length, 1);
  const laterMatch = await env.DB.prepare(
    `
      SELECT 1
      FROM matches m
      INNER JOIN match_players mp
        ON mp.match_id = m.id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
        AND m.id != ?${userIds.length + 1}
        AND (
          m.played_at > ?${userIds.length + 2}
          OR (m.played_at = ?${userIds.length + 2} AND m.created_at > ?${userIds.length + 3})
          OR (m.played_at = ?${userIds.length + 2} AND m.created_at = ?${userIds.length + 3} AND m.id > ?${userIds.length + 4})
        )
      LIMIT 1
    `,
  )
    .bind(...userIds, match.id, match.played_at, match.created_at, match.id)
    .first<{ 1: number }>();

  return Boolean(laterMatch);
}

async function loadPlayerHistoryRows(
  env: Env,
  userIds: string[],
  deletedMatchId: string,
): Promise<PlayerMatchHistoryRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const placeholders = buildInClausePlaceholders(userIds.length, 1);
  const result = await env.DB.prepare(
    `
      SELECT
        mp.user_id,
        m.match_type,
        m.winner_team,
        mp.team AS player_team,
        m.global_elo_delta_json,
        m.segment_elo_delta_json,
        m.played_at,
        m.created_at
      FROM matches m
      INNER JOIN match_players mp
        ON mp.match_id = m.id
      WHERE mp.user_id IN (${placeholders})
        AND m.status = 'active'
        AND m.id != ?${userIds.length + 1}
      ORDER BY m.played_at ASC, m.created_at ASC, m.id ASC
    `,
  )
    .bind(...userIds, deletedMatchId)
    .all<PlayerMatchHistoryRow>();

  return result.results;
}

async function applyIncrementalMatchDeletion(
  env: Env,
  match: DeactivateMatchRow,
  allPlayerIds: string[],
  nowIso: string,
): Promise<boolean> {
  if (match.season_id) {
    return false;
  }

  if (await hasLaterActiveMatches(env, allPlayerIds, match)) {
    return false;
  }

  const historyRows = await loadPlayerHistoryRows(env, allPlayerIds, match.id);
  const historyByUserId = new Map<string, PlayerMatchHistoryRow[]>();
  historyRows.forEach((row) => {
    const bucket = historyByUserId.get(row.user_id) ?? [];
    bucket.push(row);
    historyByUserId.set(row.user_id, bucket);
  });

  const statements = allPlayerIds.map((userId) => {
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
  });

  if (match.tournament_id) {
    allPlayerIds.forEach((userId) => {
      const state = replayTournamentSegmentState(userId, match.tournament_id!, historyByUserId.get(userId) ?? [], nowIso);
      statements.push(
        env.DB.prepare(
          `
            UPDATE elo_segments
            SET elo = ?3,
                matches_played = ?4,
                matches_played_equivalent = ?5,
                wins = ?6,
                losses = ?7,
                streak = ?8,
                last_match_at = ?9,
                updated_at = ?10
            WHERE segment_type = 'tournament'
              AND segment_id = ?1
              AND user_id = ?2
          `,
        ).bind(
          match.tournament_id,
          userId,
          state.elo,
          state.matchesPlayed,
          state.matchEquivalentPlayed,
          state.wins,
          state.losses,
          state.streak,
          state.lastMatchAt,
          state.updatedAt,
        ),
      );
    });
  }

  await env.DB.batch(statements);
  return true;
}

export async function handleDeactivateMatch(
  request: ApiRequest<"deactivateMatch", DeactivateEntityPayload>,
  sessionUser: UserRow,
  env: Env,
) {
  const id = request.payload?.id;
  if (!id) {
    return errorResponse(request.requestId, "VALIDATION_ERROR", "deactivateMatch requires an id.");
  }

  const match = await env.DB.prepare(
    `
      SELECT
        id,
        created_by_user_id,
        status,
        tournament_id,
        season_id,
        match_type,
        team_a_player_ids_json,
        team_b_player_ids_json,
        winner_team,
        global_elo_delta_json,
        segment_elo_delta_json,
        played_at,
        created_at
      FROM matches
      WHERE id = ?1
    `,
  )
    .bind(id)
    .first<DeactivateMatchRow>();

  if (!match || match.status === "deleted") {
    return errorResponse(request.requestId, "NOT_FOUND", "Match not found.");
  }
  if (match.created_by_user_id !== sessionUser.id) {
    return errorResponse(request.requestId, "FORBIDDEN", "Only the creator can delete this item.");
  }

  const nowIso = isoNow(env.runtime);
  await env.DB.batch([
    env.DB.prepare(
      `
        UPDATE matches
        SET status = 'deleted',
            deactivated_at = ?2,
            deactivated_by_user_id = ?3,
            deactivation_reason = ?4
        WHERE id = ?1
      `,
    ).bind(id, nowIso, sessionUser.id, request.payload?.reason || ""),
    env.DB.prepare(
      `
        INSERT INTO audit_log (id, action, actor_user_id, target_id, payload_json, created_at)
        VALUES (?1, 'deactivateMatch', ?2, ?3, ?4, ?5)
      `,
    ).bind(randomId("audit", env.runtime), sessionUser.id, id, JSON.stringify(request.payload), nowIso),
  ]);

  if (match.tournament_id) {
    await rebuildTournamentBracket(env, match.tournament_id);
  }
  const allPlayerIds = [
    ...parseJsonArray<string>(match.team_a_player_ids_json),
    ...parseJsonArray<string>(match.team_b_player_ids_json),
  ];
  const appliedIncrementalDelete = await applyIncrementalMatchDeletion(env, match, allPlayerIds, nowIso);
  if (!appliedIncrementalDelete) {
    await recomputeAllRankings(env);
  }

  return successResponse(request.requestId, {
    id,
    status: "deleted",
    deletedAt: nowIso,
  });
}
