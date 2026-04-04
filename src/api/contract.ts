export const apiActions = [
  "health",
  "bootstrapUser",
  "getDashboard",
  "getLeaderboard",
  "getUserProgress",
  "getSegmentLeaderboard",
  "getMatches",
  "createMatch",
  "createSeason",
  "createTournament",
  "deactivateMatch",
  "deactivateTournament",
  "deactivateSeason",
  "getSeasons",
  "getTournaments",
  "getTournamentBracket",
  "createSegmentShareLink",
  "redeemSegmentShareLink",
] as const;

export type ApiAction = (typeof apiActions)[number];

export type AuthProvider = "google" | "apple";
export type MatchType = "singles" | "doubles";
export type FormatType = "single_game" | "best_of_3";
export type WinnerTeam = "A" | "B";
export type MatchStatus = "active" | "deleted";
export type SegmentType = "season" | "tournament";
export type SeasonStatus = "active" | "completed" | "deleted";
export type TournamentStatus = "active" | "completed" | "deleted";
export type MatchFeedFilter = "recent" | "mine" | "all";
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiEnvelope<TAction extends ApiAction, TPayload> {
  action: TAction;
  requestId: string;
  payload: TPayload;
  sessionToken?: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<TData> {
  ok: boolean;
  data: TData | null;
  error: ApiError | null;
  requestId: string;
}

export interface HealthPayload {}

export interface HealthData {
  status: "ok";
  environment: string;
  timestamp: string;
  version: string;
}

export interface BootstrapUserPayload {
  provider: AuthProvider;
  idToken: string;
  nonce: string;
  profile?: {
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
}

export interface AppUser {
  id: string;
  provider: AuthProvider;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface BootstrapUserData {
  sessionToken: string;
  expiresAt: string;
  user: AppUser;
}

export interface AppSession {
  sessionToken: string;
  expiresAt: string;
  user: AppUser;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  wins: number;
  losses: number;
  streak: number;
  rank: number;
  seasonScore?: number;
  matchEquivalentPlayed?: number;
  lastMatchAt?: string | null;
  isQualified?: boolean;
  placementLabel?: string | null;
  placementLabelKey?:
    | "leaderboardPlacementWinner"
    | "leaderboardPlacementFinal"
    | "leaderboardPlacementSemifinals"
    | "leaderboardPlacementQuarterfinals"
    | "leaderboardPlacementRoundOf";
  placementLabelCount?: number | null;
}

export interface SegmentMostMatchesPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export interface SegmentMostWinsPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export interface SegmentTournamentWinner {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SegmentLeaderboardStats {
  totalMatches: number;
  mostMatchesPlayer: SegmentMostMatchesPlayer | null;
  mostWinsPlayer: SegmentMostWinsPlayer | null;
  tournamentWinnerPlayer: SegmentTournamentWinner | null;
}

export interface GetLeaderboardPayload {}

export interface GetLeaderboardData {
  leaderboard: LeaderboardEntry[];
  updatedAt: string;
}

export interface GetUserProgressPayload {}

export interface UserProgressPoint {
  playedAt: string;
  elo: number;
  delta: number;
  label: string;
  rank: number | null;
}

export interface GetUserProgressData {
  currentRank: number | null;
  currentElo: number;
  bestRank: number | null;
  bestElo: number;
  currentStreak: number;
  bestStreak: number;
  wins: number;
  losses: number;
  points: UserProgressPoint[];
}

export interface GetSegmentLeaderboardPayload {
  segmentType: SegmentType;
  segmentId: string;
}

export interface GetSegmentLeaderboardData {
  segmentType: SegmentType;
  segmentId: string;
  leaderboard: LeaderboardEntry[];
  updatedAt: string;
  stats: SegmentLeaderboardStats;
}

export interface MatchBracketContext {
  roundTitle: string;
  isFinal: boolean;
}

export interface GetMatchesPayload {
  cursor?: string;
  limit?: number;
  filter?: MatchFeedFilter;
}

export interface MatchScoreGame {
  teamA: number;
  teamB: number;
}

export interface MatchRecord {
  id: string;
  matchType: MatchType;
  formatType: FormatType;
  pointsToWin: 11 | 21;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  score: MatchScoreGame[];
  winnerTeam: WinnerTeam;
  playedAt: string;
  seasonId: string | null;
  tournamentId: string | null;
  createdByUserId: string;
  status: MatchStatus;
  createdAt: string;
  bracketContext?: MatchBracketContext | null;
}

export interface GetMatchesData {
  matches: MatchRecord[];
  nextCursor: string | null;
}

export interface CreateMatchPayload {
  matchType: MatchType;
  formatType: FormatType;
  pointsToWin: 11 | 21;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  score: MatchScoreGame[];
  winnerTeam: WinnerTeam;
  playedAt: string;
  seasonId?: string | null;
  tournamentId?: string | null;
  tournamentBracketMatchId?: string | null;
}

export interface CreateMatchData {
  match: MatchRecord;
}

export interface DeactivateEntityPayload {
  id: string;
  reason?: string;
}

export interface DeactivateEntityData {
  id: string;
  status: "deleted";
  deletedAt: string;
}

export interface SeasonRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: SeasonStatus;
  baseEloMode: "carry_over" | "reset_1200";
  participantIds: string[];
  createdByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
  isPublic: boolean;
}

export interface GetSeasonsPayload {}

export interface GetSeasonsData {
  seasons: SeasonRecord[];
}

export interface CreateSeasonPayload {
  seasonId?: string | null;
  name: string;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  baseEloMode: "carry_over" | "reset_1200";
  participantIds: string[];
  isPublic?: boolean;
}

export interface CreateSeasonData {
  season: SeasonRecord;
}

export interface TournamentRecord {
  id: string;
  name: string;
  date: string;
  seasonId: string | null;
  seasonName: string | null;
  status: TournamentStatus;
  createdByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
  participantCount: number;
  participantIds: string[];
  bracketStatus: "draft" | "in_progress" | "completed";
}

export interface TournamentBracketMatch {
  id: string;
  leftPlayerId: string | null;
  rightPlayerId: string | null;
  createdMatchId: string | null;
  winnerPlayerId: string | null;
  locked: boolean;
  isFinal: boolean;
}

export interface TournamentBracketRound {
  title: string;
  matches: TournamentBracketMatch[];
}

export interface CreateTournamentPayload {
  tournamentId?: string | null;
  name: string;
  date?: string | null;
  seasonId?: string | null;
  participantIds: string[];
  rounds: TournamentBracketRound[];
}

export interface CreateTournamentData {
  tournament: TournamentRecord;
  rounds: TournamentBracketRound[];
}

export interface GetTournamentsPayload {
  seasonId?: string;
}

export interface GetTournamentsData {
  tournaments: TournamentRecord[];
}

export interface GetTournamentBracketPayload {
  tournamentId: string;
}

export interface GetTournamentBracketData {
  tournament: TournamentRecord;
  participantIds: string[];
  rounds: TournamentBracketRound[];
}

export interface GetDashboardPayload {
  matchesLimit?: number;
  matchesFilter?: MatchFeedFilter;
}

export interface GetDashboardData {
  seasons: SeasonRecord[];
  tournaments: TournamentRecord[];
  leaderboard: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  userProgress: GetUserProgressData;
  matches: MatchRecord[];
  nextCursor: string | null;
  matchBracketContextByMatchId: Record<string, MatchBracketContext>;
}

export interface CreateSegmentShareLinkPayload {
  segmentType: SegmentType;
  segmentId: string;
  requestId?: string;
}

export interface SegmentShareLinkData {
  shareToken: string;
  expiresAt: string;
  url: string;
}

export interface RedeemSegmentShareLinkPayload {
  shareToken: string;
}

export interface RedeemSegmentShareLinkData {
  segmentType: SegmentType;
  segmentId: string;
  segmentName: string;
  joined: boolean;
}

export interface ApiActionMap {
  health: {
    payload: HealthPayload;
    data: HealthData;
  };
  bootstrapUser: {
    payload: BootstrapUserPayload;
    data: BootstrapUserData;
  };
  getDashboard: {
    payload: GetDashboardPayload;
    data: GetDashboardData;
  };
  getLeaderboard: {
    payload: GetLeaderboardPayload;
    data: GetLeaderboardData;
  };
  getUserProgress: {
    payload: GetUserProgressPayload;
    data: GetUserProgressData;
  };
  getSegmentLeaderboard: {
    payload: GetSegmentLeaderboardPayload;
    data: GetSegmentLeaderboardData;
  };
  getMatches: {
    payload: GetMatchesPayload;
    data: GetMatchesData;
  };
  createMatch: {
    payload: CreateMatchPayload;
    data: CreateMatchData;
  };
  createSeason: {
    payload: CreateSeasonPayload;
    data: CreateSeasonData;
  };
  createTournament: {
    payload: CreateTournamentPayload;
    data: CreateTournamentData;
  };
  deactivateMatch: {
    payload: DeactivateEntityPayload;
    data: DeactivateEntityData;
  };
  deactivateTournament: {
    payload: DeactivateEntityPayload;
    data: DeactivateEntityData;
  };
  deactivateSeason: {
    payload: DeactivateEntityPayload;
    data: DeactivateEntityData;
  };
  getSeasons: {
    payload: GetSeasonsPayload;
    data: GetSeasonsData;
  };
  getTournaments: {
    payload: GetTournamentsPayload;
    data: GetTournamentsData;
  };
  getTournamentBracket: {
    payload: GetTournamentBracketPayload;
    data: GetTournamentBracketData;
  };
  createSegmentShareLink: {
    payload: CreateSegmentShareLinkPayload;
    data: SegmentShareLinkData;
  };
  redeemSegmentShareLink: {
    payload: RedeemSegmentShareLinkPayload;
    data: RedeemSegmentShareLinkData;
  };
}
