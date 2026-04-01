export const apiActions = [
  "health",
  "bootstrapUser",
  "getLeaderboard",
  "getSegmentLeaderboard",
  "getMatches",
  "createMatch",
  "createTournament",
  "deactivateMatch",
  "getSeasons",
  "getTournaments",
  "getTournamentBracket",
] as const;

export type ApiAction = (typeof apiActions)[number];

export type AuthProvider = "google" | "apple";
export type MatchType = "singles" | "doubles";
export type FormatType = "single_game" | "best_of_3";
export type WinnerTeam = "A" | "B";
export type MatchStatus = "active" | "deactivated";
export type SegmentType = "season" | "tournament";
export type ErrorCode =
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
}

export interface GetLeaderboardPayload {}

export interface GetLeaderboardData {
  leaderboard: LeaderboardEntry[];
  updatedAt: string;
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
}

export interface GetMatchesPayload {
  cursor?: string;
  limit?: number;
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

export interface DeactivateMatchPayload {
  matchId: string;
  reason?: string;
}

export interface DeactivateMatchData {
  match: MatchRecord;
}

export interface SeasonRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  baseEloMode: "carry_over" | "reset_1200";
}

export interface GetSeasonsPayload {}

export interface GetSeasonsData {
  seasons: SeasonRecord[];
}

export interface TournamentRecord {
  id: string;
  name: string;
  date: string;
  seasonId: string | null;
}

export interface TournamentBracketMatch {
  id: string;
  leftPlayerId: string | null;
  rightPlayerId: string | null;
  createdMatchId: string | null;
  winnerPlayerId?: string | null;
}

export interface TournamentBracketRound {
  title: string;
  matches: TournamentBracketMatch[];
}

export interface CreateTournamentPayload {
  tournamentId?: string | null;
  name: string;
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

export interface ApiActionMap {
  health: {
    payload: HealthPayload;
    data: HealthData;
  };
  bootstrapUser: {
    payload: BootstrapUserPayload;
    data: BootstrapUserData;
  };
  getLeaderboard: {
    payload: GetLeaderboardPayload;
    data: GetLeaderboardData;
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
  createTournament: {
    payload: CreateTournamentPayload;
    data: CreateTournamentData;
  };
  deactivateMatch: {
    payload: DeactivateMatchPayload;
    data: DeactivateMatchData;
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
}
