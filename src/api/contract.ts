export const apiActions = [
  "health",
  "bootstrapUser",
  "updateProfile",
  "getDashboard",
  "getLeaderboard",
  "searchParticipants",
  "createGuestPlayer",
  "getUserProgress",
  "getSharedUserProfile",
  "getSegmentLeaderboard",
  "getMatches",
  "checkMatchDuplicate",
  "createMatch",
  "createMatchDispute",
  "createSeason",
  "createTournament",
  "deactivateMatch",
  "removeMatchDispute",
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
export type LocaleCode = "en" | "de" | "es";
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
  locale?: LocaleCode;
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
  locale: LocaleCode;
}

export interface BootstrapUserData {
  sessionToken: string;
  expiresAt: string;
  user: AppUser;
}

export interface UpdateProfilePayload {
  displayName: string;
  locale: LocaleCode;
}

export interface UpdateProfileData {
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
  bestWinStreak?: number;
  highestElo?: number;
  highestScore?: number;
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

export interface GetLeaderboardPayload {
  mode?: "default" | "dashboard_preview";
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

export interface CreateGuestPlayerPayload {
  displayName: string;
  seasonId?: string | null;
}

export interface CreateGuestPlayerData {
  participant: ParticipantSearchEntry;
  seasonId: string | null;
  seasonParticipantIds: string[] | null;
}

export interface GetUserProgressPayload {
  mode?: "summary" | "full";
  includeActivityHeatmap?: boolean;
}

export interface UserProgressPoint {
  playedAt: string;
  elo: number;
  delta: number;
  label: string;
  rank: number | null;
}

export interface ActivityHeatmapDay {
  date: string;
  matches: number;
  wins: number;
  losses: number;
}

export interface ActivityHeatmapData {
  startDate: string;
  endDate: string;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  activeDays: number;
  days: ActivityHeatmapDay[];
}

export interface MatchTypeRecord {
  matches: number;
  wins: number;
  losses: number;
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
  singles: MatchTypeRecord;
  doubles: MatchTypeRecord;
  points: UserProgressPoint[];
  activityHeatmap: ActivityHeatmapData | null;
}

export interface GetSharedUserProfilePayload {
  userId: string;
  cursor?: string;
  limit?: number;
}

export interface SharedUserSegmentSummary {
  segmentType: SegmentType;
  segmentId: string;
  wins: number;
  losses: number;
  rank: number | null;
  participantCount: number;
  seasonScore?: number;
  placementLabelKey?: LeaderboardEntry["placementLabelKey"];
  placementLabelCount?: number | null;
}

export interface SharedUserOverview {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  currentRank: number | null;
  currentElo: number;
  bestWinStreak: number;
}

export interface SharedUserSeasonRecord {
  season: SeasonRecord;
  summary: SharedUserSegmentSummary;
}

export interface SharedUserTournamentRecord {
  tournament: TournamentRecord;
  summary: SharedUserSegmentSummary;
}

export interface GetSharedUserProfileData {
  user: SharedUserOverview;
  achievements: AchievementSummaryItem[];
  activityHeatmap: ActivityHeatmapData;
  seasons: SharedUserSeasonRecord[];
  tournaments: SharedUserTournamentRecord[];
  matches: MatchRecord[];
  nextCursor: string | null;
  players: LeaderboardEntry[];
  matchBracketContextByMatchId: Record<string, MatchBracketContext>;
}

export interface AchievementSummaryItem {
  key: string;
  category: "onboarding" | "activity" | "performance" | "community";
  tier: "bronze" | "silver" | "gold" | "platinum";
  icon:
    | "user_plus"
    | "ping_pong"
    | "victory_badge"
    | "single_dot"
    | "bullseye"
    | "double_dot"
    | "handshake"
    | "three_mark"
    | "five_mark"
    | "ten_mark"
    | "twentyfive_mark"
    | "fifty_mark"
    | "hundred_mark"
    | "road_250_badge"
    | "club_500_badge"
    | "endless_rally_badge"
    | "lightning_run"
    | "wildfire"
    | "iron_wall_badge"
    | "perfect_11_badge"
    | "perfect_21_badge"
    | "blowout_11_badge"
    | "blowout_21_badge"
    | "marathon_match_badge"
    | "lucky_numbers_badge"
    | "mirror_match_badge"
    | "style_points_badge"
    | "top_ten_badge"
    | "podium_finish"
    | "gold_medal"
    | "dynasty_badge"
    | "defender_badge"
    | "upset_victory_badge"
    | "positive_record_badge"
    | "dominant_era_badge"
    | "calendar_plus"
    | "calendar_stack"
    | "calendar_archive"
    | "leaf_one"
    | "leaf_three"
    | "leaf_five"
    | "season_podium_badge"
    | "season_winner_badge"
    | "season_podiums_badge"
    | "season_dynasty_badge"
    | "spring_contender_badge"
    | "spring_champion_badge"
    | "bracket_seed"
    | "bracket_triplet"
    | "bracket_crown"
    | "tournament_finalist_badge"
    | "tournament_winner_badge"
    | "tournament_finals_badge"
    | "tournament_dynasty_badge"
    | "squad_goals_badge"
    | "rivalry_begins_badge"
    | "arch_rival_badge"
    | "weekly_warrior_badge"
    | "all_rounder_badge"
    | "ticket_one"
    | "ticket_three"
    | "ticket_five"
    | "chart_up"
    | "chart_peak"
    | "diamond_rank"
    | "rocket_rank"
    | "deuce_master_badge"
    | "ice_cold_badge"
    | "clutch_player_badge"
    | "comeback_king_badge"
    | "completionist_i_badge"
    | "completionist_ii_badge"
    | "completionist_iii_badge"
    | "moon_cycle"
    | "sun_path"
    | "party_year";
  unlockedAt: string | null;
  progressValue: number;
  progressTarget: number | null;
  titleKey: string;
  descriptionKey: string;
  points: number;
}

export interface AchievementOverview {
  totalUnlocked: number;
  totalAvailable: number;
  score: number;
  items: AchievementSummaryItem[];
  recentUnlocks: AchievementSummaryItem[];
  featured: AchievementSummaryItem[];
  nextUp: AchievementSummaryItem | null;
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
  matchType?: MatchType;
  targetMatchIds?: string[];
  mode?: "default" | "dashboard_preview";
}

export interface MatchScoreGame {
  teamA: number;
  teamB: number;
}

export interface MatchDisputeRecord {
  id: string;
  matchId: string;
  createdByUserId: string;
  comment: string;
  status: "active" | "withdrawn";
  createdAt: string;
  updatedAt: string;
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
  deleteLockedAt?: string | null;
  hasActiveDispute?: boolean;
  currentUserDispute?: MatchDisputeRecord | null;
  bracketContext?: MatchBracketContext | null;
}

export interface DuplicateMatchCandidate extends MatchRecord {
  createdByDisplayName: string;
}

export interface GetMatchesData {
  matches: MatchRecord[];
  nextCursor: string | null;
  players?: LeaderboardEntry[];
}

export interface CheckMatchDuplicatePayload extends CreateMatchPayload {}

export interface CheckMatchDuplicateData {
  matches: DuplicateMatchCandidate[];
  players?: LeaderboardEntry[];
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
  ignoreDuplicateWarning?: boolean;
}

export interface CreateMatchData {
  match: MatchRecord;
}

export interface CreateMatchDisputePayload {
  matchId: string;
  comment: string;
}

export interface CreateMatchDisputeData {
  matchId: string;
  dispute: MatchDisputeRecord;
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

export interface RemoveMatchDisputePayload {
  matchId: string;
}

export interface RemoveMatchDisputeData {
  matchId: string;
  removed: boolean;
}

export interface DisputedMatchAlert {
  matchId: string;
  playedAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  disputedByUserId: string;
  disputedByDisplayName: string;
  comment: string;
  updatedAt: string;
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
  participants: ParticipantSearchEntry[];
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
  players: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  userProgress: GetUserProgressData;
  achievements: AchievementOverview;
  matches: MatchRecord[];
  nextCursor: string | null;
  matchBracketContextByMatchId: Record<string, MatchBracketContext>;
  disputedMatches?: DisputedMatchAlert[];
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
  updateProfile: {
    payload: UpdateProfilePayload;
    data: UpdateProfileData;
  };
  getDashboard: {
    payload: GetDashboardPayload;
    data: GetDashboardData;
  };
  getLeaderboard: {
    payload: GetLeaderboardPayload;
    data: GetLeaderboardData;
  };
  searchParticipants: {
    payload: SearchParticipantsPayload;
    data: SearchParticipantsData;
  };
  createGuestPlayer: {
    payload: CreateGuestPlayerPayload;
    data: CreateGuestPlayerData;
  };
  getUserProgress: {
    payload: GetUserProgressPayload;
    data: GetUserProgressData;
  };
  getSharedUserProfile: {
    payload: GetSharedUserProfilePayload;
    data: GetSharedUserProfileData;
  };
  getSegmentLeaderboard: {
    payload: GetSegmentLeaderboardPayload;
    data: GetSegmentLeaderboardData;
  };
  getMatches: {
    payload: GetMatchesPayload;
    data: GetMatchesData;
  };
  checkMatchDuplicate: {
    payload: CheckMatchDuplicatePayload;
    data: CheckMatchDuplicateData;
  };
  createMatch: {
    payload: CreateMatchPayload;
    data: CreateMatchData;
  };
  createMatchDispute: {
    payload: CreateMatchDisputePayload;
    data: CreateMatchDisputeData;
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
  removeMatchDispute: {
    payload: RemoveMatchDisputePayload;
    data: RemoveMatchDisputeData;
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
