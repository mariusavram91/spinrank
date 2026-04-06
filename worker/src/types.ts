import type { WorkerRuntimeDeps } from "./runtime";

export const apiActionNames = [
  "health",
  "bootstrapUser",
  "getDashboard",
  "getLeaderboard",
  "searchParticipants",
  "getMatches",
  "getSeasons",
  "getSegmentLeaderboard",
  "getTournamentBracket",
  "getTournaments",
  "getUserProgress",
  "createMatch",
  "createSeason",
  "createTournament",
  "createSegmentShareLink",
  "redeemSegmentShareLink",
  "deactivateMatch",
  "deactivateTournament",
  "deactivateSeason",
] as const;

export type ApiAction = (typeof apiActionNames)[number];

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

export interface ApiRequest<TAction extends ApiAction = ApiAction, TPayload = unknown> {
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

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  APP_SESSION_SECRET: string;
  APP_ORIGIN: string;
  APP_ENV?: string;
  TEST_AUTH_SECRET?: string;
  DISABLE_RATE_LIMIT?: string;
  runtime?: Partial<WorkerRuntimeDeps>;
}

export interface SessionClaims {
  sub: string;
  iat: number;
  exp: number;
}

export interface AppUser {
  id: string;
  provider: AuthProvider;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
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

export interface BootstrapUserData {
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
  seasonGlickoRating?: number;
  seasonGlickoRd?: number;
  seasonConservativeRating?: number;
  seasonAttendancePenalty?: number;
  seasonAttendedWeeks?: number;
  seasonTotalWeeks?: number;
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

export interface GetLeaderboardData {
  leaderboard: LeaderboardEntry[];
  updatedAt: string;
}

export interface SearchParticipantsPayload {
  query?: string;
  segmentType: "season" | "tournament";
  seasonId?: string | null;
  limit?: number;
}

export interface ParticipantSearchEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  isSuggested: boolean;
}

export interface SearchParticipantsData {
  participants: ParticipantSearchEntry[];
}

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

export interface MatchBracketContext {
  roundTitle: string;
  isFinal: boolean;
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

export interface GetMatchesPayload {
  cursor?: string;
  limit?: number;
  filter?: "recent" | "mine" | "all";
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

export interface GetSeasonsData {
  seasons: SeasonRecord[];
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
  participants: ParticipantSearchEntry[];
  rounds: TournamentBracketRound[];
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

export interface DeactivateEntityPayload {
  id: string;
  reason?: string;
}

export interface DeactivateEntityData {
  id: string;
  status: "deleted";
  deletedAt: string;
}

export interface UserRow {
  id: string;
  provider: AuthProvider;
  provider_user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  global_elo: number;
  wins: number;
  losses: number;
  streak: number;
  created_at: string;
  updated_at: string;
}

export interface SeasonRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
  status: SeasonStatus;
  base_elo_mode: "carry_over" | "reset_1200";
  participant_ids_json: string;
  created_by_user_id: string | null;
  created_at: string;
  completed_at: string | null;
  is_public: number;
}

export interface TournamentRow {
  id: string;
  name: string;
  date: string;
  status: TournamentStatus;
  season_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SegmentShareLinkRow {
  id: string;
  segment_type: SegmentType;
  segment_id: string;
  created_by_user_id: string;
  share_token: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_user_id: string | null;
  created_at: string;
}
