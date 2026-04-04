import { dateOnly, isoNow, parseJsonArray, parseJsonObject, randomId } from "../db";
import type { Env, MatchType, SeasonRow, UserRow, WinnerTeam } from "../types";

const STARTING_ELO = 1200;
const SINGLES_WEIGHT = 1;
const DOUBLES_WEIGHT = 0.7;
const WEEKLY_INACTIVITY_PENALTY = 5;
export const MINIMUM_MATCHES_TO_QUALIFY = 10;
const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

interface RatingState {
  elo: number;
  wins: number;
  losses: number;
  streak: number;
  matchesPlayed: number;
  matchEquivalentPlayed: number;
  lastMatchAt: string;
  updatedAt: string;
}

interface MatchDeltaRow {
  id: string;
  match_type: MatchType;
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

interface SegmentParticipantRow {
  segment_type: "season" | "tournament";
  segment_id: string;
  user_id: string;
}

interface SeasonSeedState {
  id: string;
  startDate: string;
  baseEloMode: SeasonRow["base_elo_mode"];
  participantIds: string[];
  initialized: boolean;
}

type SeasonSeedRow = Pick<SeasonRow, "id" | "start_date" | "base_elo_mode" | "participant_ids_json">;

export interface RatingSnapshot {
  globalState: Record<string, RatingState>;
  segmentStates: Map<string, Record<string, RatingState>>;
}

function getSegmentKey(segmentType: "season" | "tournament", segmentId: string): string {
  return `${segmentType}:${segmentId}`;
}

function getMatchEquivalent(matchType: MatchType): number {
  return matchType === "singles" ? SINGLES_WEIGHT : DOUBLES_WEIGHT;
}

function getKFactor(matchEquivalentPlayed: number): number {
  if (matchEquivalentPlayed < 10) return 40;
  if (matchEquivalentPlayed < 30) return 24;
  return 16;
}

export function calculateSeasonScore(args: {
  elo: number;
  lastMatchAt: string | null;
  matchEquivalentPlayed: number;
  nowIso: string;
}): number {
  const lastMatchAtMs = args.lastMatchAt ? Date.parse(args.lastMatchAt) : NaN;
  const nowMs = Date.parse(args.nowIso);
  const inactiveWeeks =
    Number.isFinite(lastMatchAtMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.floor((nowMs - lastMatchAtMs) / WEEK_IN_MS))
      : 0;
  const inactivityPenalty = inactiveWeeks * WEEKLY_INACTIVITY_PENALTY;
  const activityBonus = Math.min(Math.floor(args.matchEquivalentPlayed / 3), 20);
  return args.elo - inactivityPenalty + activityBonus;
}

function getPlayerElo(state: RatingState | UserRow | undefined): number {
  if (!state) {
    return STARTING_ELO;
  }

  if ("global_elo" in state) {
    return Number(state.global_elo || STARTING_ELO);
  }

  return Number(state.elo || STARTING_ELO);
}

function getPlayerMatchEquivalentPlayed(state: RatingState | UserRow | undefined): number {
  if (!state) {
    return 0;
  }

  if ("matchEquivalentPlayed" in state) {
    return Number(state.matchEquivalentPlayed || 0);
  }

  if ("matchesPlayed" in state) {
    return Number(state.matchesPlayed || 0);
  }

  return Number(state.wins || 0) + Number(state.losses || 0);
}

function getPlayerMatchesPlayed(state: RatingState | UserRow | undefined): number {
  if (!state) {
    return 0;
  }

  if ("matchesPlayed" in state) {
    return Number(state.matchesPlayed || 0);
  }

  return Number(state.wins || 0) + Number(state.losses || 0);
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
      return getPlayerElo(state);
    }),
  );
}

function computeTeamKFactor(playerIds: string[], ratingMap: Record<string, RatingState | UserRow>): number {
  return average(
    playerIds.map((playerId) => {
      const state = ratingMap[playerId];
      return getKFactor(getPlayerMatchEquivalentPlayed(state));
    }),
  );
}

function addMatchEquivalent(current: number, equivalent: number): number {
  return Math.round((current + equivalent) * 10) / 10;
}

function ensureRatingState(
  stateMap: Record<string, RatingState>,
  playerId: string,
  nowIso: string,
): RatingState {
  const state = stateMap[playerId];
  if (state) {
    return state;
  }

  const blank = createBlankRatingState(nowIso);
  stateMap[playerId] = blank;
  return blank;
}

function seedRatingStates(
  stateMap: Record<string, RatingState>,
  playerIds: string[],
  nowIso: string,
): void {
  playerIds.forEach((playerId) => {
    ensureRatingState(stateMap, playerId, nowIso);
  });
}

function initializeSeasonRatingState(
  season: SeasonSeedState,
  globalState: Record<string, RatingState>,
  segmentStates: Map<string, Record<string, RatingState>>,
  nowIso: string,
): void {
  if (season.initialized) {
    return;
  }

  const state: Record<string, RatingState> = {};
  season.participantIds.forEach((playerId) => {
    const blank = createBlankRatingState(nowIso);
    if (season.baseEloMode === "carry_over") {
      blank.elo = globalState[playerId]?.elo ?? STARTING_ELO;
    }
    state[playerId] = blank;
  });

  segmentStates.set(getSegmentKey("season", season.id), state);
  season.initialized = true;
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

function updateTeamState(
  teamPlayerIds: string[],
  stateMap: Record<string, RatingState>,
  deltaMap: Record<string, number>,
  nowIso: string,
  playedAt: string,
  matchEquivalentPlayed: number,
  isWinner: boolean,
): void {
  teamPlayerIds.forEach((playerId) => {
    const state = ensureRatingState(stateMap, playerId, nowIso);
    state.elo += Number(deltaMap[playerId] || 0);
    state.matchesPlayed += 1;
    state.matchEquivalentPlayed = addMatchEquivalent(state.matchEquivalentPlayed, matchEquivalentPlayed);
    state.lastMatchAt = playedAt;
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

export function computeEloDeltaForTeams(
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  ratingMap: Record<string, RatingState | UserRow>,
  winnerTeam: WinnerTeam,
  matchType: MatchType,
): Record<string, number> {
  const teamARating = computeAverageRating(teamAPlayerIds, ratingMap);
  const teamBRating = computeAverageRating(teamBPlayerIds, ratingMap);
  const expectedA = 1 / (1 + 10 ** ((teamBRating - teamARating) / 400));
  const teamAK = computeTeamKFactor(teamAPlayerIds, ratingMap);
  const teamBK = computeTeamKFactor(teamBPlayerIds, ratingMap);
  const actualA = winnerTeam === "A" ? 1 : 0;
  const rawTeamDeltaA = ((teamAK + teamBK) / 2) * (actualA - expectedA);
  const matchWeight = getMatchEquivalent(matchType);
  const teamDeltaA = Math.round(rawTeamDeltaA * matchWeight);
  const teamDeltaB = -teamDeltaA;
  return distributeTeamDelta(teamAPlayerIds, teamBPlayerIds, teamDeltaA, teamDeltaB);
}

function buildRatingSnapshots(
  users: UserRow[],
  seasons: SeasonSeedRow[],
  participantRows: SegmentParticipantRow[],
  matches: MatchDeltaRow[],
): RatingSnapshot {
  const nowIso = isoNow();
  const globalState = Object.fromEntries(
    users.map((user) => [user.id, createBlankRatingState(nowIso)]),
  ) as Record<string, RatingState>;

  const segmentStates = new Map<string, Record<string, RatingState>>();
  const seasonStateById = new Map<string, SeasonSeedState>(
    seasons.map((season) => [
      season.id,
      {
        id: season.id,
        startDate: season.start_date,
        baseEloMode: season.base_elo_mode,
        participantIds: parseJsonArray<string>(season.participant_ids_json),
        initialized: false,
      },
    ]),
  );
  const orderedSeasons = [...seasonStateById.values()].sort((left, right) =>
    left.startDate === right.startDate ? left.id.localeCompare(right.id) : left.startDate.localeCompare(right.startDate),
  );

  participantRows.forEach((row) => {
    if (row.segment_type === "season") {
      return;
    }
    const segmentKey = getSegmentKey(row.segment_type, row.segment_id);
    const segmentState = segmentStates.get(segmentKey) ?? {};
    ensureRatingState(segmentState, row.user_id, nowIso);
    segmentStates.set(segmentKey, segmentState);
  });

  const initializeSeasonsUpTo = (cutoffDate: string): void => {
    orderedSeasons.forEach((season) => {
      if (!season.initialized && season.startDate <= cutoffDate) {
        initializeSeasonRatingState(season, globalState, segmentStates, nowIso);
      }
    });
  };

  matches.forEach((match) => {
    initializeSeasonsUpTo(dateOnly(match.played_at || match.created_at || nowIso));

    const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
    const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
    const globalDelta = parseJsonObject<Record<string, number>>(match.global_elo_delta_json, {});
    const playedAt = match.played_at || match.created_at || nowIso;
    const updatedAt = match.created_at || match.played_at || nowIso;
    const matchEquivalentPlayed = getMatchEquivalent(match.match_type);

    seedRatingStates(globalState, [...teamA, ...teamB], nowIso);
    updateTeamState(teamA, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "A");
    updateTeamState(teamB, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "B");

    const segmentDelta = parseJsonObject<Record<string, Record<string, number>>>(match.segment_elo_delta_json, {});
    Object.entries(segmentDelta).forEach(([segmentId, deltaMap]) => {
      const segmentType =
        segmentId === match.season_id ? "season" : segmentId === match.tournament_id ? "tournament" : null;
      if (!segmentType) {
        return;
      }

      const segmentKey = getSegmentKey(segmentType, segmentId);
      if (segmentType === "season") {
        const season = seasonStateById.get(segmentId);
        if (season) {
          initializeSeasonRatingState(season, globalState, segmentStates, nowIso);
        }
      }
      const segmentState = segmentStates.get(segmentKey) ?? {};
      seedRatingStates(segmentState, [...teamA, ...teamB], nowIso);
      updateTeamState(teamA, segmentState, deltaMap, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "A");
      updateTeamState(teamB, segmentState, deltaMap, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "B");
      segmentStates.set(segmentKey, segmentState);
    });
  });

  initializeSeasonsUpTo("9999-12-31");

  return {
    globalState,
    segmentStates,
  };
}

export function createBlankRatingState(nowIso: string): RatingState {
  return {
    elo: STARTING_ELO,
    wins: 0,
    losses: 0,
    streak: 0,
    matchesPlayed: 0,
    matchEquivalentPlayed: 0,
    lastMatchAt: "",
    updatedAt: nowIso,
  };
}

export async function recomputeAllRankings(env: Env): Promise<RatingSnapshot> {
  const seasons = await env.DB.prepare(
    `
      SELECT id, start_date, base_elo_mode, participant_ids_json
      FROM seasons
      WHERE status != 'deleted'
      ORDER BY start_date ASC, id ASC
    `,
  ).all<SeasonSeedRow>();

  const users = await env.DB.prepare(
    `
      SELECT *
      FROM users
    `,
  ).all<UserRow>();

  const participantRows = [
    ...(await env.DB.prepare(
      `
        SELECT 'season' AS segment_type, season_id AS segment_id, user_id
        FROM season_participants
      `,
    ).all<SegmentParticipantRow>()).results,
    ...(await env.DB.prepare(
      `
        SELECT 'tournament' AS segment_type, tournament_id AS segment_id, user_id
        FROM tournament_participants
      `,
    ).all<SegmentParticipantRow>()).results,
  ];

  const matches = await env.DB.prepare(
    `
      SELECT id, match_type, team_a_player_ids_json, team_b_player_ids_json, winner_team, global_elo_delta_json,
             segment_elo_delta_json, season_id, tournament_id, played_at, created_at
      FROM matches
      WHERE status = 'active'
      ORDER BY played_at ASC, created_at ASC, id ASC
    `,
  ).all<MatchDeltaRow>();

  const snapshots = buildRatingSnapshots(
    users.results,
    seasons.results,
    participantRows,
    matches.results,
  );
  const nowIso = isoNow();

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
        snapshots.globalState[user.id]?.elo ?? STARTING_ELO,
        snapshots.globalState[user.id]?.wins ?? 0,
        snapshots.globalState[user.id]?.losses ?? 0,
        snapshots.globalState[user.id]?.streak ?? 0,
        snapshots.globalState[user.id]?.updatedAt ?? nowIso,
      ),
    ),
    env.DB.prepare(`DELETE FROM elo_segments`),
    ...[...snapshots.segmentStates.entries()].flatMap(([segmentKey, state]) => {
      const [segmentType, segmentId] = segmentKey.split(":");
      return Object.entries(state).map(([userId, value]) =>
        env.DB.prepare(
          `
            INSERT INTO elo_segments (
              id, segment_type, segment_id, user_id, elo, matches_played, matches_played_equivalent,
              wins, losses, streak, last_match_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
          `,
        ).bind(
          randomId("seg"),
          segmentType,
          segmentId,
          userId,
          value.elo,
          value.matchesPlayed,
          value.matchEquivalentPlayed,
          value.wins,
          value.losses,
          value.streak,
          value.lastMatchAt,
          value.updatedAt,
        ),
      );
    }),
  ]);

  return snapshots;
}
