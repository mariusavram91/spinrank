import { dateOnly, isoNow, parseJsonArray, parseJsonObject, randomId } from "../db";
import type { WorkerRuntimeDeps } from "../runtime";
import type { Env, MatchType, SeasonRow, UserRow, WinnerTeam } from "../types";

const STARTING_ELO = 1200;
const SINGLES_WEIGHT = 1;
const DOUBLES_WEIGHT = 0.7;
export const MINIMUM_MATCHES_TO_QUALIFY = 10;
export const MINIMUM_LEADERBOARD_MATCHES = 10;

const GLICKO_DEFAULT_RATING = 1200;
const GLICKO_DEFAULT_RD = 350;
const GLICKO_DEFAULT_VOLATILITY = 0.06;
const GLICKO_TAU = 0.5;
const GLICKO_SCALE = 173.7178;

const ATTENDANCE_FREE_MISSES = 2;
const ATTENDANCE_PENALTY_BASE = 4;
const ATTENDANCE_PENALTY_CAP = 128;
const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

interface RatingState {
  elo: number;
  highestElo: number;
  wins: number;
  losses: number;
  streak: number;
  bestWinStreak: number;
  matchesPlayed: number;
  matchEquivalentPlayed: number;
  lastMatchAt: string;
  updatedAt: string;
}

interface SeasonRatingState extends RatingState {
  highestScore: number;
  glickoRating: number;
  glickoRd: number;
  glickoVolatility: number;
  attendedWeekKeys: Set<number>;
}

type AnyRatingState = RatingState | SeasonRatingState;

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

interface MatchImpactReplayRow extends MatchDeltaRow {
  status: "active" | "deleted";
}

interface SegmentParticipantRow {
  segment_type: "season" | "tournament";
  segment_id: string;
  user_id: string;
}

interface TournamentSeasonRow {
  id: string;
  season_id: string | null;
}

interface SeasonSeedState {
  id: string;
  startDate: string;
  endDate: string;
  status: SeasonRow["status"];
  baseEloMode: SeasonRow["base_elo_mode"];
  participantIds: string[];
  initialized: boolean;
}

type SeasonSeedRow = Pick<
  SeasonRow,
  "id" | "start_date" | "end_date" | "status" | "base_elo_mode" | "participant_ids_json"
>;

type TeamGlickoState = {
  rating: number;
  rd: number;
  volatility: number;
};

type SeasonInitializer = (cutoffDate: string) => void;

export interface RatingSnapshot {
  globalState: Record<string, RatingState>;
  segmentStates: Map<string, Record<string, AnyRatingState>>;
}

export interface UserMatchImpactDetail {
  globalDelta: number;
  globalBefore: number;
  globalAfter: number;
  globalGap: number;
  seasonScoreDelta: number | null;
  seasonGap: number | null;
  expectedWinProbability: number;
  effectiveKFactor: number;
  outcome: "win" | "loss";
  seasonBreakdown: {
    expectedWinProbability: number;
    ratingBefore: number;
    ratingAfter: number;
    rdBefore: number;
    rdAfter: number;
    conservativeBefore: number;
    conservativeAfter: number;
    attendancePenaltyBefore: number;
    attendancePenaltyAfter: number;
    scoreBefore: number;
    scoreAfter: number;
  } | null;
}

const USER_MATCH_IMPACT_CACHE_LIMIT = 64;
let userMatchImpactCacheVersion = 0;
const userMatchImpactCache = new Map<string, Promise<Record<string, UserMatchImpactDetail>>>();

function buildUserMatchImpactCacheKey(userId: string, matchIds: string[]): string {
  return `${userMatchImpactCacheVersion}:${userId}:${[...matchIds].sort().join(",")}`;
}

function rememberUserMatchImpactCacheEntry(
  key: string,
  value: Promise<Record<string, UserMatchImpactDetail>>,
): Promise<Record<string, UserMatchImpactDetail>> {
  if (userMatchImpactCache.has(key)) {
    userMatchImpactCache.delete(key);
  }
  userMatchImpactCache.set(key, value);
  while (userMatchImpactCache.size > USER_MATCH_IMPACT_CACHE_LIMIT) {
    const oldestKey = userMatchImpactCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    userMatchImpactCache.delete(oldestKey);
  }
  return value;
}

export function invalidateUserMatchImpactCache(): void {
  userMatchImpactCacheVersion += 1;
  userMatchImpactCache.clear();
}

function getSegmentKey(segmentType: "season" | "tournament", segmentId: string): string {
  return `${segmentType}:${segmentId}`;
}

function buildInClausePlaceholders(count: number): string {
  return Array.from({ length: count }, (_, index) => `?${index + 1}`).join(", ");
}

function createSeasonInitializer(
  orderedSeasons: SeasonSeedState[],
  globalState: Record<string, RatingState>,
  segmentStates: Map<string, Record<string, AnyRatingState>>,
  nowIso: string,
): SeasonInitializer {
  let nextSeasonIndex = 0;
  return (cutoffDate: string): void => {
    while (nextSeasonIndex < orderedSeasons.length && orderedSeasons[nextSeasonIndex].startDate <= cutoffDate) {
      const season = orderedSeasons[nextSeasonIndex];
      if (!season.initialized) {
        initializeSeasonRatingState(season, globalState, segmentStates, nowIso);
      }
      nextSeasonIndex += 1;
    }
  };
}

function getMatchEquivalent(matchType: MatchType): number {
  return matchType === "singles" ? SINGLES_WEIGHT : DOUBLES_WEIGHT;
}

function getKFactor(matchEquivalentPlayed: number): number {
  if (matchEquivalentPlayed < 10) return 40;
  if (matchEquivalentPlayed < 30) return 24;
  return 16;
}

function calculateSeasonConservativeRating(rating: number, rd: number): number {
  return Math.round(rating - 2 * rd);
}

function calculateAttendancePenaltyForMissedWeeks(missedWeeks: number): number {
  const penalizedMisses = Math.max(0, missedWeeks - ATTENDANCE_FREE_MISSES);
  if (penalizedMisses <= 0) {
    return 0;
  }

  return Math.min(ATTENDANCE_PENALTY_CAP, ATTENDANCE_PENALTY_BASE * 2 ** (penalizedMisses - 1));
}

export function calculateSeasonScore(args: {
  rating: number;
  rd: number;
  attendancePenalty?: number;
  consecutiveMissedWeeks?: number;
  attendedWeeks?: number;
  totalWeeks?: number;
}): number {
  const attendedWeeks = Number(args.attendedWeeks ?? 0);
  const totalWeeks = Number(args.totalWeeks ?? 0);
  const attendancePenalty =
    args.attendancePenalty ??
    (args.consecutiveMissedWeeks !== undefined
      ? calculateAttendancePenaltyForMissedWeeks(Math.max(0, Number(args.consecutiveMissedWeeks)))
      : calculateAttendancePenaltyForMissedWeeks(Math.max(0, totalWeeks - attendedWeeks)));
  return calculateSeasonConservativeRating(args.rating, args.rd) - attendancePenalty;
}

function calculateConsecutiveMissedWeeks(attendedWeekKeys: Set<number>, totalWeeks: number): number {
  if (totalWeeks <= 0) {
    return 0;
  }

  let missedWeeks = 0;
  for (let weekIndex = totalWeeks - 1; weekIndex >= 0; weekIndex -= 1) {
    if (attendedWeekKeys.has(weekIndex)) {
      break;
    }
    missedWeeks += 1;
  }

  return missedWeeks;
}

function calculateAttendancePenalty(attendedWeekKeys: Set<number>, totalWeeks: number): number {
  return calculateAttendancePenaltyForMissedWeeks(calculateConsecutiveMissedWeeks(attendedWeekKeys, totalWeeks));
}

function getSeasonScoreAtWeek(state: SeasonRatingState, totalWeeks: number): number {
  return calculateSeasonScore({
    rating: state.glickoRating,
    rd: state.glickoRd,
    attendancePenalty: calculateAttendancePenalty(state.attendedWeekKeys, totalWeeks),
  });
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

export function compareLeaderboardRows(
  left: { elo: number; wins: number; losses: number; displayName: string; matchEquivalentPlayed?: number },
  right: { elo: number; wins: number; losses: number; displayName: string; matchEquivalentPlayed?: number },
): number {
  const leftMatches = Number(left.matchEquivalentPlayed ?? left.wins + left.losses);
  const rightMatches = Number(right.matchEquivalentPlayed ?? right.wins + right.losses);
  const leftQualified = leftMatches >= MINIMUM_LEADERBOARD_MATCHES;
  const rightQualified = rightMatches >= MINIMUM_LEADERBOARD_MATCHES;

  if (leftQualified !== rightQualified) {
    return Number(rightQualified) - Number(leftQualified);
  }

  if (!leftQualified) {
    if (rightMatches !== leftMatches) {
      return rightMatches - leftMatches;
    }
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

function ensureSeasonRatingState(
  stateMap: Record<string, SeasonRatingState>,
  playerId: string,
  nowIso: string,
): SeasonRatingState {
  const state = stateMap[playerId];
  if (state) {
    return state;
  }

  const blank = createBlankSeasonRatingState(nowIso);
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

function seedSeasonRatingStates(
  stateMap: Record<string, SeasonRatingState>,
  playerIds: string[],
  nowIso: string,
): void {
  playerIds.forEach((playerId) => {
    ensureSeasonRatingState(stateMap, playerId, nowIso);
  });
}

function initializeSeasonRatingState(
  season: SeasonSeedState,
  globalState: Record<string, RatingState>,
  segmentStates: Map<string, Record<string, AnyRatingState>>,
  nowIso: string,
): void {
  if (season.initialized) {
    return;
  }

  const state: Record<string, SeasonRatingState> = {};
  season.participantIds.forEach((playerId) => {
    const blank = createBlankSeasonRatingState(nowIso);
    if (season.baseEloMode === "carry_over") {
      blank.elo = globalState[playerId]?.elo ?? STARTING_ELO;
      blank.highestElo = blank.elo;
      blank.glickoRating = blank.elo;
      blank.highestScore = calculateSeasonScore({
        rating: blank.glickoRating,
        rd: blank.glickoRd,
        attendancePenalty: 0,
      });
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
    state.highestElo = Math.max(state.highestElo, state.elo);
    state.matchesPlayed += 1;
    state.matchEquivalentPlayed = addMatchEquivalent(state.matchEquivalentPlayed, matchEquivalentPlayed);
    state.lastMatchAt = playedAt;
    state.updatedAt = nowIso;
    if (isWinner) {
      state.wins += 1;
      state.streak = state.streak >= 0 ? state.streak + 1 : 1;
      state.bestWinStreak = Math.max(state.bestWinStreak, state.streak);
    } else {
      state.losses += 1;
      state.streak = state.streak <= 0 ? state.streak - 1 : -1;
    }
  });
}

function updateSeasonTeamState(
  teamPlayerIds: string[],
  stateMap: Record<string, SeasonRatingState>,
  nextTeamState: TeamGlickoState,
  currentTeamState: TeamGlickoState,
  nowIso: string,
  playedAt: string,
  matchEquivalentPlayed: number,
  isWinner: boolean,
  weekIndex: number,
  matchWeight: number,
): void {
  teamPlayerIds.forEach((playerId) => {
    const state = ensureSeasonRatingState(stateMap, playerId, nowIso);
    state.glickoRating += (nextTeamState.rating - currentTeamState.rating) * matchWeight;
    state.glickoRd = Math.max(30, state.glickoRd + (nextTeamState.rd - currentTeamState.rd) * matchWeight);
    state.glickoVolatility = Math.max(
      0.01,
      state.glickoVolatility + (nextTeamState.volatility - currentTeamState.volatility) * matchWeight,
    );
    state.elo = Math.round(state.glickoRating);
    state.highestElo = Math.max(state.highestElo, state.elo);
    state.matchesPlayed += 1;
    state.matchEquivalentPlayed = addMatchEquivalent(state.matchEquivalentPlayed, matchEquivalentPlayed);
    state.lastMatchAt = playedAt;
    state.updatedAt = nowIso;
    state.attendedWeekKeys.add(weekIndex);
    state.highestScore = Math.max(
      state.highestScore,
      calculateSeasonScore({
        rating: state.glickoRating,
        rd: state.glickoRd,
        attendancePenalty: calculateAttendancePenalty(state.attendedWeekKeys, weekIndex + 1),
      }),
    );
    if (isWinner) {
      state.wins += 1;
      state.streak = state.streak >= 0 ? state.streak + 1 : 1;
      state.bestWinStreak = Math.max(state.bestWinStreak, state.streak);
    } else {
      state.losses += 1;
      state.streak = state.streak <= 0 ? state.streak - 1 : -1;
    }
  });
}

function toGlickoScale(rating: number): number {
  return (rating - GLICKO_DEFAULT_RATING) / GLICKO_SCALE;
}

function fromGlickoScale(mu: number): number {
  return mu * GLICKO_SCALE + GLICKO_DEFAULT_RATING;
}

function toGlickoDeviation(rd: number): number {
  return rd / GLICKO_SCALE;
}

function fromGlickoDeviation(phi: number): number {
  return phi * GLICKO_SCALE;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function computeVariance(mu: number, opponentMu: number, opponentPhi: number): number {
  const expectation = expectedScore(mu, opponentMu, opponentPhi);
  const opponentG = g(opponentPhi);
  return 1 / (opponentG * opponentG * expectation * (1 - expectation));
}

function computeDelta(mu: number, opponentMu: number, opponentPhi: number, score: number, variance: number): number {
  return variance * g(opponentPhi) * (score - expectedScore(mu, opponentMu, opponentPhi));
}

function solveVolatility(phi: number, delta: number, variance: number, volatility: number): number {
  const a = Math.log(volatility * volatility);
  const f = (x: number): number => {
    const expX = Math.exp(x);
    const numerator = expX * (delta * delta - phi * phi - variance - expX);
    const denominator = 2 * (phi * phi + variance + expX) * (phi * phi + variance + expX);
    return numerator / denominator - (x - a) / (GLICKO_TAU * GLICKO_TAU);
  };

  let lower = 0;
  let upper = 0;
  if (delta * delta > phi * phi + variance) {
    upper = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    upper = a - k * GLICKO_TAU;
    while (f(upper) < 0) {
      k += 1;
      upper = a - k * GLICKO_TAU;
    }
  }
  lower = a;

  let fLower = f(lower);
  let fUpper = f(upper);

  while (Math.abs(upper - lower) > 0.000001) {
    const midpoint = lower + ((lower - upper) * fLower) / (fUpper - fLower);
    const fMid = f(midpoint);
    if (fMid * fUpper < 0) {
      lower = upper;
      fLower = fUpper;
    } else {
      fLower /= 2;
    }
    upper = midpoint;
    fUpper = fMid;
  }

  return Math.exp(lower / 2);
}

function applyGlickoResult(player: TeamGlickoState, opponent: TeamGlickoState, score: number): TeamGlickoState {
  const mu = toGlickoScale(player.rating);
  const phi = toGlickoDeviation(player.rd);
  const opponentMu = toGlickoScale(opponent.rating);
  const opponentPhi = toGlickoDeviation(opponent.rd);
  const variance = computeVariance(mu, opponentMu, opponentPhi);
  const delta = computeDelta(mu, opponentMu, opponentPhi, score, variance);
  const nextVolatility = solveVolatility(phi, delta, variance, player.volatility);
  const phiStar = Math.sqrt(phi * phi + nextVolatility * nextVolatility);
  const nextPhi = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / variance));
  const nextMu = mu + nextPhi * nextPhi * g(opponentPhi) * (score - expectedScore(mu, opponentMu, opponentPhi));

  return {
    rating: fromGlickoScale(nextMu),
    rd: fromGlickoDeviation(nextPhi),
    volatility: nextVolatility,
  };
}

function buildTeamGlickoState(playerIds: string[], seasonState: Record<string, SeasonRatingState>): TeamGlickoState {
  const players = playerIds.map((playerId) => seasonState[playerId]);
  return {
    rating: average(players.map((player) => player.glickoRating)),
    rd: Math.sqrt(average(players.map((player) => player.glickoRd * player.glickoRd))),
    volatility: average(players.map((player) => player.glickoVolatility)),
  };
}

function getSeasonWeekIndex(seasonStartDate: string, playedAtIso: string): number {
  const startMs = Date.parse(`${seasonStartDate}T00:00:00.000Z`);
  const playedMs = Date.parse(playedAtIso);
  return Math.max(0, Math.floor((playedMs - startMs) / WEEK_IN_MS));
}

function calculateSeasonTotalWeeks(season: SeasonSeedState, nowIso: string): number {
  const seasonStartMs = Date.parse(`${season.startDate}T00:00:00.000Z`);
  const seasonEndDate = season.status === "completed" && season.endDate ? season.endDate : "";
  const cutoffDate = seasonEndDate || dateOnly(nowIso);
  const cutoffMs = Date.parse(`${cutoffDate}T00:00:00.000Z`);
  if (!Number.isFinite(seasonStartMs) || !Number.isFinite(cutoffMs) || cutoffMs < seasonStartMs) {
    return 0;
  }
  return Math.floor((cutoffMs - seasonStartMs) / WEEK_IN_MS) + 1;
}

function updateSeasonGlickoMatch(args: {
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  seasonState: Record<string, SeasonRatingState>;
  seasonStartDate: string;
  winnerTeam: WinnerTeam;
  matchType: MatchType;
  playedAt: string;
  updatedAt: string;
}): void {
  const matchEquivalentPlayed = getMatchEquivalent(args.matchType);
  const matchWeight = matchEquivalentPlayed;
  const weekIndex = getSeasonWeekIndex(args.seasonStartDate, args.playedAt);

  seedSeasonRatingStates(args.seasonState, [...args.teamAPlayerIds, ...args.teamBPlayerIds], args.updatedAt);

  const currentTeamA = buildTeamGlickoState(args.teamAPlayerIds, args.seasonState);
  const currentTeamB = buildTeamGlickoState(args.teamBPlayerIds, args.seasonState);
  const nextTeamA = applyGlickoResult(currentTeamA, currentTeamB, args.winnerTeam === "A" ? 1 : 0);
  const nextTeamB = applyGlickoResult(currentTeamB, currentTeamA, args.winnerTeam === "B" ? 1 : 0);

  updateSeasonTeamState(
    args.teamAPlayerIds,
    args.seasonState,
    nextTeamA,
    currentTeamA,
    args.updatedAt,
    args.playedAt,
    matchEquivalentPlayed,
    args.winnerTeam === "A",
    weekIndex,
    matchWeight,
  );
  updateSeasonTeamState(
    args.teamBPlayerIds,
    args.seasonState,
    nextTeamB,
    currentTeamB,
    args.updatedAt,
    args.playedAt,
    matchEquivalentPlayed,
    args.winnerTeam === "B",
    weekIndex,
    matchWeight,
  );
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
  tournaments: TournamentSeasonRow[],
  participantRows: SegmentParticipantRow[],
  matches: MatchDeltaRow[],
  runtime?: Partial<WorkerRuntimeDeps>,
): RatingSnapshot {
  const nowIso = isoNow(runtime);
  const globalState = Object.fromEntries(
    users.map((user) => [user.id, createBlankRatingState(nowIso)]),
  ) as Record<string, RatingState>;

  const segmentStates = new Map<string, Record<string, AnyRatingState>>();
  const seasonStateById = new Map<string, SeasonSeedState>(
    seasons.map((season) => [
      season.id,
      {
        id: season.id,
        startDate: season.start_date,
        endDate: season.end_date,
        status: season.status,
        baseEloMode: season.base_elo_mode,
        participantIds: parseJsonArray<string>(season.participant_ids_json),
        initialized: false,
      },
    ]),
  );
  const tournamentSeasonIdByTournamentId = new Map<string, string | null>(
    tournaments.map((tournament) => [tournament.id, tournament.season_id]),
  );
  const orderedSeasons = [...seasonStateById.values()].sort((left, right) =>
    left.startDate === right.startDate ? left.id.localeCompare(right.id) : left.startDate.localeCompare(right.startDate),
  );

  participantRows.forEach((row) => {
    if (row.segment_type === "season") {
      return;
    }
    const segmentKey = getSegmentKey(row.segment_type, row.segment_id);
    const segmentState = (segmentStates.get(segmentKey) ?? {}) as Record<string, RatingState>;
    ensureRatingState(segmentState, row.user_id, nowIso);
    segmentStates.set(segmentKey, segmentState);
  });

  const initializeSeasonsUpTo = createSeasonInitializer(orderedSeasons, globalState, segmentStates, nowIso);

  matches.forEach((match) => {
    initializeSeasonsUpTo(dateOnly(match.played_at || match.created_at || nowIso));

    const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
    const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
    const globalDelta = parseJsonObject<Record<string, number>>(match.global_elo_delta_json, {});
    const segmentDelta = parseJsonObject<Record<string, Record<string, number>>>(match.segment_elo_delta_json, {});
    const playedAt = match.played_at || match.created_at || nowIso;
    const updatedAt = match.created_at || match.played_at || nowIso;
    const matchEquivalentPlayed = getMatchEquivalent(match.match_type);

    seedRatingStates(globalState, [...teamA, ...teamB], nowIso);
    updateTeamState(teamA, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "A");
    updateTeamState(teamB, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "B");

    const targetSeasonId = match.season_id ?? tournamentSeasonIdByTournamentId.get(match.tournament_id ?? "") ?? null;
    if (targetSeasonId) {
      const season = seasonStateById.get(targetSeasonId);
      if (season) {
        initializeSeasonRatingState(season, globalState, segmentStates, nowIso);
        const segmentKey = getSegmentKey("season", targetSeasonId);
        const seasonState = (segmentStates.get(segmentKey) ?? {}) as Record<string, SeasonRatingState>;
        updateSeasonGlickoMatch({
          teamAPlayerIds: teamA,
          teamBPlayerIds: teamB,
          seasonState,
          seasonStartDate: season.startDate,
          winnerTeam: match.winner_team,
          matchType: match.match_type,
          playedAt,
          updatedAt,
        });
        segmentStates.set(segmentKey, seasonState);
      }
    }

    if (match.tournament_id) {
      const tournamentDelta = segmentDelta[match.tournament_id];
      if (tournamentDelta) {
        const segmentKey = getSegmentKey("tournament", match.tournament_id);
        const tournamentState = (segmentStates.get(segmentKey) ?? {}) as Record<string, RatingState>;
        seedRatingStates(tournamentState, [...teamA, ...teamB], nowIso);
        updateTeamState(teamA, tournamentState, tournamentDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "A");
        updateTeamState(teamB, tournamentState, tournamentDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "B");
        segmentStates.set(segmentKey, tournamentState);
      }
    }
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
    highestElo: STARTING_ELO,
    wins: 0,
    losses: 0,
    streak: 0,
    bestWinStreak: 0,
    matchesPlayed: 0,
    matchEquivalentPlayed: 0,
    lastMatchAt: "",
    updatedAt: nowIso,
  };
}

function createBlankSeasonRatingState(nowIso: string): SeasonRatingState {
  return {
    ...createBlankRatingState(nowIso),
    highestScore: calculateSeasonScore({
      rating: GLICKO_DEFAULT_RATING,
      rd: GLICKO_DEFAULT_RD,
      attendancePenalty: 0,
    }),
    glickoRating: GLICKO_DEFAULT_RATING,
    glickoRd: GLICKO_DEFAULT_RD,
    glickoVolatility: GLICKO_DEFAULT_VOLATILITY,
    attendedWeekKeys: new Set<number>(),
  };
}

function isSeasonRatingState(state: AnyRatingState): state is SeasonRatingState {
  return "glickoRating" in state;
}

export async function recomputeAllRankings(env: Env): Promise<RatingSnapshot> {
  const seasons = await env.DB.prepare(
    `
      SELECT id, start_date, end_date, status, base_elo_mode, participant_ids_json
      FROM seasons
      WHERE status != 'deleted'
      ORDER BY start_date ASC, id ASC
    `,
  ).all<SeasonSeedRow>();

  const tournaments = await env.DB.prepare(
    `
      SELECT id, season_id
      FROM tournaments
      WHERE status != 'deleted'
    `,
  ).all<TournamentSeasonRow>();

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
    tournaments.results,
    participantRows,
    matches.results,
    env.runtime,
  );
  const nowIso = isoNow(env.runtime);
  const seasonMetadataById = new Map<string, SeasonSeedState>(
    seasons.results.map((season) => [
      season.id,
      {
        id: season.id,
        startDate: season.start_date,
        endDate: season.end_date,
        status: season.status,
        baseEloMode: season.base_elo_mode,
        participantIds: parseJsonArray<string>(season.participant_ids_json),
        initialized: true,
      },
    ]),
  );

  await env.DB.batch([
    ...users.results.map((user) =>
      env.DB.prepare(
        `
          UPDATE users
          SET global_elo = ?2,
              highest_global_elo = ?3,
              wins = ?4,
              losses = ?5,
              streak = ?6,
              best_win_streak = ?7,
              updated_at = ?8
          WHERE id = ?1
        `,
      ).bind(
        user.id,
        snapshots.globalState[user.id]?.elo ?? STARTING_ELO,
        snapshots.globalState[user.id]?.highestElo ?? STARTING_ELO,
        snapshots.globalState[user.id]?.wins ?? 0,
        snapshots.globalState[user.id]?.losses ?? 0,
        snapshots.globalState[user.id]?.streak ?? 0,
        snapshots.globalState[user.id]?.bestWinStreak ?? 0,
        snapshots.globalState[user.id]?.updatedAt ?? nowIso,
      ),
    ),
    env.DB.prepare(`DELETE FROM elo_segments`),
    ...[...snapshots.segmentStates.entries()].flatMap(([segmentKey, state]) => {
      const [segmentType, segmentId] = segmentKey.split(":") as ["season" | "tournament", string];
      const seasonMetadata = segmentType === "season" ? seasonMetadataById.get(segmentId) : null;
      const totalWeeks = seasonMetadata ? calculateSeasonTotalWeeks(seasonMetadata, nowIso) : 0;
      return Object.entries(state).map(([userId, value]) => {
        const seasonState = segmentType === "season" && isSeasonRatingState(value) ? value : null;
        const conservativeRating = seasonState
          ? calculateSeasonConservativeRating(seasonState.glickoRating, seasonState.glickoRd)
          : null;
        const attendedWeeks = seasonState ? seasonState.attendedWeekKeys.size : 0;
        const attendancePenalty = seasonState ? calculateAttendancePenalty(seasonState.attendedWeekKeys, totalWeeks) : 0;

        return env.DB.prepare(
          `
            INSERT INTO elo_segments (
              id, segment_type, segment_id, user_id, elo, matches_played, matches_played_equivalent,
              wins, losses, streak, best_win_streak, highest_score, last_match_at, updated_at,
              season_glicko_rating, season_glicko_rd, season_glicko_volatility, season_conservative_rating,
              season_attended_weeks, season_total_weeks, season_attendance_penalty
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21
            )
          `,
        ).bind(
          randomId("seg", env.runtime),
          segmentType,
          segmentId,
          userId,
          value.elo,
          value.matchesPlayed,
          value.matchEquivalentPlayed,
          value.wins,
          value.losses,
          value.streak,
          value.bestWinStreak,
          seasonState ? seasonState.highestScore : 0,
          value.lastMatchAt,
          value.updatedAt,
          seasonState ? seasonState.glickoRating : null,
          seasonState ? seasonState.glickoRd : null,
          seasonState ? seasonState.glickoVolatility : null,
          conservativeRating,
          attendedWeeks,
          totalWeeks,
          attendancePenalty,
        );
      });
    }),
  ]);

  return snapshots;
}

export async function deriveUserMatchImpactDetails(
  env: Env,
  userId: string,
  matchIds: string[],
): Promise<Record<string, UserMatchImpactDetail>> {
  const targetIds = [...new Set(matchIds)].filter(Boolean);
  if (targetIds.length === 0) {
    return {};
  }

  const cacheKey = buildUserMatchImpactCacheKey(userId, targetIds);
  const cached = userMatchImpactCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const computation = (async () => {
    const nowIso = isoNow(env.runtime);
    const latestTarget = await env.DB.prepare(
      `
        SELECT id, played_at, created_at
        FROM matches
        WHERE status = 'active'
          AND id IN (${buildInClausePlaceholders(targetIds.length)})
        ORDER BY played_at DESC, created_at DESC, id DESC
        LIMIT 1
      `,
    )
      .bind(...targetIds)
      .first<{ id: string; played_at: string; created_at: string }>();
    if (!latestTarget) {
      return {};
    }

    const matches = await env.DB.prepare(
      `
        SELECT id, match_type, team_a_player_ids_json, team_b_player_ids_json, winner_team, global_elo_delta_json,
               segment_elo_delta_json, season_id, tournament_id, played_at, created_at, status
        FROM matches
        WHERE status = 'active'
          AND (
            played_at < ?1
            OR (played_at = ?1 AND created_at < ?2)
            OR (played_at = ?1 AND created_at = ?2 AND id <= ?3)
          )
        ORDER BY played_at ASC, created_at ASC, id ASC
      `,
    )
      .bind(latestTarget.played_at, latestTarget.created_at, latestTarget.id)
      .all<MatchImpactReplayRow>();

    const replayTournamentIds = [
      ...new Set(matches.results.map((match) => match.tournament_id).filter((value): value is string => Boolean(value))),
    ];
    const tournaments =
      replayTournamentIds.length > 0
        ? await env.DB.prepare(
            `
              SELECT id, season_id
              FROM tournaments
              WHERE status != 'deleted'
                AND id IN (${buildInClausePlaceholders(replayTournamentIds.length)})
            `,
          ).bind(...replayTournamentIds).all<TournamentSeasonRow>()
        : { results: [] as TournamentSeasonRow[] };
    const replaySeasonIds = [
      ...new Set(
        [
          ...matches.results.map((match) => match.season_id),
          ...tournaments.results.map((tournament) => tournament.season_id),
        ].filter((value): value is string => Boolean(value)),
      ),
    ];
    const seasons =
      replaySeasonIds.length > 0
        ? await env.DB.prepare(
            `
              SELECT id, start_date, end_date, status, base_elo_mode, participant_ids_json
              FROM seasons
              WHERE status != 'deleted'
                AND id IN (${buildInClausePlaceholders(replaySeasonIds.length)})
              ORDER BY start_date ASC, id ASC
            `,
          ).bind(...replaySeasonIds).all<SeasonSeedRow>()
        : { results: [] as SeasonSeedRow[] };

    const globalState = {} as Record<string, RatingState>;
    const segmentStates = new Map<string, Record<string, AnyRatingState>>();
    const seasonStateById = new Map<string, SeasonSeedState>(
      seasons.results.map((season) => [
        season.id,
        {
          id: season.id,
          startDate: season.start_date,
          endDate: season.end_date,
          status: season.status,
          baseEloMode: season.base_elo_mode,
          participantIds: parseJsonArray<string>(season.participant_ids_json),
          initialized: false,
        },
      ]),
    );
    const orderedSeasons = [...seasonStateById.values()].sort((left, right) =>
      left.startDate === right.startDate ? left.id.localeCompare(right.id) : left.startDate.localeCompare(right.startDate),
    );
    const tournamentSeasonIdByTournamentId = new Map<string, string | null>(
      tournaments.results.map((tournament) => [tournament.id, tournament.season_id]),
    );

    const initializeSeasonsUpTo = createSeasonInitializer(orderedSeasons, globalState, segmentStates, nowIso);

    const pending = new Set(targetIds);
    const details: Record<string, UserMatchImpactDetail> = {};

    for (const match of matches.results) {
      if (pending.size === 0) {
        break;
      }

      initializeSeasonsUpTo(dateOnly(match.played_at || match.created_at || nowIso));

      const teamA = parseJsonArray<string>(match.team_a_player_ids_json);
      const teamB = parseJsonArray<string>(match.team_b_player_ids_json);
      const playedAt = match.played_at || match.created_at || nowIso;
      const updatedAt = match.created_at || match.played_at || nowIso;
      const inTeamA = teamA.includes(userId);
      const inTeamB = teamB.includes(userId);
      const userInMatch = inTeamA || inTeamB;
      const needsDetail = userInMatch && pending.has(match.id);
      const matchEquivalentPlayed = getMatchEquivalent(match.match_type);

      seedRatingStates(globalState, [...teamA, ...teamB], nowIso);
      const globalDelta = parseJsonObject<Record<string, number>>(match.global_elo_delta_json, {});
      const beforeGlobalElo = needsDetail ? Math.round(globalState[userId]?.elo ?? STARTING_ELO) : STARTING_ELO;
      let effectiveKFactor = 0;
      let expectedWinProbability = 0;
      let globalGap = 0;
      let outcome: "win" | "loss" = "loss";
      if (needsDetail) {
        const teamARating = computeAverageRating(teamA, globalState);
        const teamBRating = computeAverageRating(teamB, globalState);
        const expectedA = 1 / (1 + 10 ** ((teamBRating - teamARating) / 400));
        const teamAK = computeTeamKFactor(teamA, globalState);
        const teamBK = computeTeamKFactor(teamB, globalState);
        effectiveKFactor = ((teamAK + teamBK) / 2) * matchEquivalentPlayed;
        expectedWinProbability = inTeamA ? expectedA : (inTeamB ? 1 - expectedA : 0);
        globalGap = inTeamA ? (teamARating - teamBRating) : (teamBRating - teamARating);
        outcome = (match.winner_team === "A" && inTeamA) || (match.winner_team === "B" && inTeamB) ? "win" : "loss";
      }

      let seasonScoreDelta: number | null = null;
      let seasonGap: number | null = null;
      let seasonBreakdown: UserMatchImpactDetail["seasonBreakdown"] = null;
      const targetSeasonId = match.season_id ?? tournamentSeasonIdByTournamentId.get(match.tournament_id ?? "") ?? null;
      if (targetSeasonId) {
        const season = seasonStateById.get(targetSeasonId);
        if (season) {
          initializeSeasonRatingState(season, globalState, segmentStates, nowIso);
          const segmentKey = getSegmentKey("season", targetSeasonId);
          const seasonState = (segmentStates.get(segmentKey) ?? {}) as Record<string, SeasonRatingState>;
          seedSeasonRatingStates(seasonState, [...teamA, ...teamB], nowIso);
          const totalWeeks = needsDetail ? getSeasonWeekIndex(season.startDate, playedAt) + 1 : 0;
          const currentTeamA = needsDetail ? buildTeamGlickoState(teamA, seasonState) : null;
          const currentTeamB = needsDetail ? buildTeamGlickoState(teamB, seasonState) : null;
          const beforeUserState = needsDetail ? seasonState[userId] : null;
          const beforeRating = beforeUserState ? beforeUserState.glickoRating : null;
          const beforeRd = beforeUserState ? beforeUserState.glickoRd : null;
          const beforeScore = beforeUserState ? getSeasonScoreAtWeek(beforeUserState, totalWeeks) : 0;
          const beforeConservative =
            beforeRating !== null && beforeRd !== null ? calculateSeasonConservativeRating(beforeRating, beforeRd) : 0;
          const beforePenalty = beforeUserState
            ? calculateAttendancePenalty(beforeUserState.attendedWeekKeys, totalWeeks)
            : 0;
          let seasonExpectedWinProbability = 0;
          if (currentTeamA && currentTeamB) {
            const seasonExpectedA = expectedScore(
              toGlickoScale(currentTeamA.rating),
              toGlickoScale(currentTeamB.rating),
              toGlickoDeviation(currentTeamB.rd),
            );
            seasonExpectedWinProbability = inTeamA ? seasonExpectedA : (inTeamB ? 1 - seasonExpectedA : 0);
            seasonGap = inTeamA
              ? (currentTeamA.rating - currentTeamB.rating)
              : (currentTeamB.rating - currentTeamA.rating);
          }
          updateSeasonGlickoMatch({
            teamAPlayerIds: teamA,
            teamBPlayerIds: teamB,
            seasonState,
            seasonStartDate: season.startDate,
            winnerTeam: match.winner_team,
            matchType: match.match_type,
            playedAt,
            updatedAt,
          });
          if (beforeUserState && beforeRating !== null && beforeRd !== null) {
            const afterUserState = seasonState[userId];
            const afterScore = getSeasonScoreAtWeek(afterUserState, totalWeeks);
            const afterConservative = calculateSeasonConservativeRating(afterUserState.glickoRating, afterUserState.glickoRd);
            const afterPenalty = calculateAttendancePenalty(afterUserState.attendedWeekKeys, totalWeeks);
            seasonScoreDelta = afterScore - beforeScore;
            seasonBreakdown = {
              expectedWinProbability: seasonExpectedWinProbability,
              ratingBefore: beforeRating,
              ratingAfter: afterUserState.glickoRating,
              rdBefore: beforeRd,
              rdAfter: afterUserState.glickoRd,
              conservativeBefore: beforeConservative,
              conservativeAfter: afterConservative,
              attendancePenaltyBefore: beforePenalty,
              attendancePenaltyAfter: afterPenalty,
              scoreBefore: beforeScore,
              scoreAfter: afterScore,
            };
          }
          segmentStates.set(segmentKey, seasonState);
        }
      }

      updateTeamState(teamA, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "A");
      updateTeamState(teamB, globalState, globalDelta, updatedAt, playedAt, matchEquivalentPlayed, match.winner_team === "B");
      const afterGlobalElo = needsDetail ? Math.round(globalState[userId]?.elo ?? beforeGlobalElo) : beforeGlobalElo;

      if (needsDetail) {
        details[match.id] = {
          globalDelta: Number(globalDelta[userId] ?? 0),
          globalBefore: beforeGlobalElo,
          globalAfter: afterGlobalElo,
          globalGap: Math.round(globalGap),
          seasonScoreDelta,
          seasonGap: seasonGap === null ? null : Math.round(seasonGap),
          expectedWinProbability,
          effectiveKFactor: Math.round(effectiveKFactor * 100) / 100,
          outcome,
          seasonBreakdown,
        };
        pending.delete(match.id);
      }
    }

    return details;
  })();

  rememberUserMatchImpactCacheEntry(
    cacheKey,
    computation.catch((error) => {
      userMatchImpactCache.delete(cacheKey);
      throw error;
    }),
  );

  return userMatchImpactCache.get(cacheKey)!;
}
