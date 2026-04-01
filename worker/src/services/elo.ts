import { isoNow, parseJsonArray, parseJsonObject, randomId } from "../db";
import type { Env, UserRow, WinnerTeam } from "../types";

interface RatingState {
  elo: number;
  wins: number;
  losses: number;
  streak: number;
  matchesPlayed: number;
  updatedAt: string;
}

interface MatchDeltaRow {
  id: string;
  team_a_player_ids_json: string;
  team_b_player_ids_json: string;
  winner_team: WinnerTeam;
  global_elo_delta_json: string;
  segment_elo_delta_json: string;
  season_id: string | null;
  tournament_id: string | null;
  played_at: string;
  created_at: string;
}

export function compareLeaderboardRows(
  left: { elo: number; wins: number; losses: number; displayName: string },
  right: { elo: number; wins: number; losses: number; displayName: string },
): number {
  if (right.elo !== left.elo) {
    return right.elo - left.elo;
  }

  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }

  if (left.losses !== right.losses) {
    return left.losses - right.losses;
  }

  return left.displayName.localeCompare(right.displayName);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeAverageRating(playerIds: string[], ratingMap: Record<string, RatingState | UserRow>): number {
  return average(
    playerIds.map((playerId) => {
      const state = ratingMap[playerId];
      if ("global_elo" in state) {
        return Number(state.global_elo || 1200);
      }

      return Number(state.elo || 1200);
    }),
  );
}

function computeTeamKFactor(playerIds: string[], ratingMap: Record<string, RatingState | UserRow>): number {
  return average(
    playerIds.map((playerId) => {
      const state = ratingMap[playerId];
      const matchesPlayed =
        "matchesPlayed" in state ? state.matchesPlayed : Number(state.wins || 0) + Number(state.losses || 0);
      return matchesPlayed < 30 ? 40 : 24;
    }),
  );
}

function distributeDeltaAcrossPlayers(playerIds: string[], totalDelta: number, result: Record<string, number>): void {
  const baseDelta = totalDelta >= 0 ? Math.floor(totalDelta / playerIds.length) : Math.ceil(totalDelta / playerIds.length);
  const remainder = totalDelta - baseDelta * playerIds.length;

  playerIds.forEach((playerId, index) => {
    let adjustment = 0;
    if (remainder > 0 && index < remainder) {
      adjustment = 1;
    }
    if (remainder < 0 && index < Math.abs(remainder)) {
      adjustment = -1;
    }

    result[playerId] = baseDelta + adjustment;
  });
}

function distributeTeamDelta(teamAPlayerIds: string[], teamBPlayerIds: string[], teamDeltaA: number, teamDeltaB: number) {
  const result: Record<string, number> = {};
  distributeDeltaAcrossPlayers(teamAPlayerIds, teamDeltaA, result);
  distributeDeltaAcrossPlayers(teamBPlayerIds, teamDeltaB, result);
  return result;
}

export function computeEloDeltaForTeams(
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  ratingMap: Record<string, RatingState | UserRow>,
  winnerTeam: WinnerTeam,
): Record<string, number> {
  const teamARating = computeAverageRating(teamAPlayerIds, ratingMap);
  const teamBRating = computeAverageRating(teamBPlayerIds, ratingMap);
  const expectedA = 1 / (1 + 10 ** ((teamBRating - teamARating) / 400));
  const teamAK = computeTeamKFactor(teamAPlayerIds, ratingMap);
  const teamBK = computeTeamKFactor(teamBPlayerIds, ratingMap);
  const actualA = winnerTeam === "A" ? 1 : 0;
  const rawTeamDeltaA = ((teamAK + teamBK) / 2) * (actualA - expectedA);
  const teamDeltaA = Math.round(rawTeamDeltaA);
  const teamDeltaB = -teamDeltaA;
  return distributeTeamDelta(teamAPlayerIds, teamBPlayerIds, teamDeltaA, teamDeltaB);
}

function updateTeamState(
  teamPlayerIds: string[],
  stateMap: Record<string, RatingState>,
  deltaMap: Record<string, number>,
  nowIso: string,
  isWinner: boolean,
): void {
  teamPlayerIds.forEach((playerId) => {
    const state = stateMap[playerId];
    state.elo += Number(deltaMap[playerId] || 0);
    state.matchesPlayed += 1;
    state.updatedAt = nowIso;
    if (isWinner) {
      state.wins += 1;
      state.streak = state.streak >= 0 ? state.streak + 1 : 1;
    } else {
      state.losses += 1;
      state.streak = state.streak <= 0 ? state.streak - 1 : -1;
    }
  });
}

export function createBlankRatingState(nowIso: string): RatingState {
  return {
    elo: 1200,
    wins: 0,
    losses: 0,
    streak: 0,
    matchesPlayed: 0,
    updatedAt: nowIso,
  };
}

export async function recomputeAllRankings(env: Env): Promise<void> {
  const nowIso = isoNow();
  const users = await env.DB.prepare(
    `
      SELECT *
      FROM users
    `,
  ).all<UserRow>();

  const globalState = Object.fromEntries(
    users.results.map((user) => [user.id, createBlankRatingState(nowIso)]),
  ) as Record<string, RatingState>;

  const segments = new Map<string, Record<string, RatingState>>();

  const matches = await env.DB.prepare(
    `
      SELECT id, team_a_player_ids_json, team_b_player_ids_json, winner_team, global_elo_delta_json,
             segment_elo_delta_json, season_id, tournament_id, played_at, created_at
      FROM matches
      WHERE status = 'active'
      ORDER BY played_at ASC, created_at ASC, id ASC
    `,
  ).all<MatchDeltaRow>();

  matches.results.forEach((match) => {
    const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
    const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
    const globalDelta = parseJsonObject<Record<string, number>>(match.global_elo_delta_json, {});
    updateTeamState(teamA, globalState, globalDelta, match.created_at || match.played_at, match.winner_team === "A");
    updateTeamState(teamB, globalState, globalDelta, match.created_at || match.played_at, match.winner_team === "B");

    const segmentDelta = parseJsonObject<Record<string, Record<string, number>>>(match.segment_elo_delta_json, {});
    Object.entries(segmentDelta).forEach(([segmentId, deltaMap]) => {
      const segmentType =
        segmentId === match.season_id ? "season" : segmentId === match.tournament_id ? "tournament" : null;
      if (!segmentType) {
        return;
      }
      const segmentKey = `${segmentType}:${segmentId}`;
      const segmentState = segments.get(segmentKey) ?? {};
      [...teamA, ...teamB].forEach((playerId) => {
        segmentState[playerId] ??= createBlankRatingState(match.created_at || match.played_at);
      });
      updateTeamState(teamA, segmentState, deltaMap, match.created_at || match.played_at, match.winner_team === "A");
      updateTeamState(teamB, segmentState, deltaMap, match.created_at || match.played_at, match.winner_team === "B");
      segments.set(segmentKey, segmentState);
    });
  });

  await env.DB.batch([
    ...users.results.map((user) =>
      env.DB.prepare(
        `
          UPDATE users
          SET global_elo = ?2,
              wins = ?3,
              losses = ?4,
              streak = ?5,
              updated_at = ?6
          WHERE id = ?1
        `,
      ).bind(
        user.id,
        globalState[user.id]?.elo ?? 1200,
        globalState[user.id]?.wins ?? 0,
        globalState[user.id]?.losses ?? 0,
        globalState[user.id]?.streak ?? 0,
        globalState[user.id]?.updatedAt ?? nowIso,
      ),
    ),
    env.DB.prepare(`DELETE FROM elo_segments`),
    ...[...segments.entries()].flatMap(([segmentKey, state]) => {
      const [segmentType, segmentId] = segmentKey.split(":");
      return Object.entries(state).map(([userId, value]) =>
        env.DB.prepare(
          `
            INSERT INTO elo_segments (
              id, segment_type, segment_id, user_id, elo, matches_played, wins, losses, streak, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
          `,
        ).bind(
          randomId("seg"),
          segmentType,
          segmentId,
          userId,
          value.elo,
          value.matchesPlayed,
          value.wins,
          value.losses,
          value.streak,
          value.updatedAt,
        ),
      );
    }),
  ]);
}
