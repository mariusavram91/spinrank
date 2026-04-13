import type {
  AchievementOverview,
  GetSharedUserProfileData,
  AppSession,
  GetTournamentBracketData,
  GetUserProgressData,
  LeaderboardEntry,
  MatchFeedFilter,
  MatchRecord,
  ParticipantSearchEntry,
  SeasonRecord,
  SegmentLeaderboardStats,
  SegmentType,
  TournamentBracketRound,
  TournamentRecord,
} from "../../../api/contract";

export type ViewState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | { status: "authenticated"; message: string; session: AppSession };

export type SegmentMode = "global" | "season" | "tournament";

export type SeasonDraftMode = "create" | "edit";

export interface ProfileSegmentSummary {
  segmentType: SegmentType;
  segmentId: string;
  wins: number;
  losses: number;
  rank: number | null;
  placementLabelKey?: LeaderboardEntry["placementLabelKey"];
  placementLabelCount?: number | null;
  participantCount: number;
}

export interface DashboardState {
  screen:
    | "dashboard"
    | "createMatch"
    | "createTournament"
    | "createSeason"
    | "profile"
    | "userProfile"
    | "faq"
    | "privacy";
  loading: boolean;
  error: string;
  leaderboard: LeaderboardEntry[];
  players: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  leaderboardStats: SegmentLeaderboardStats | null;
  tournamentBracket: TournamentBracketRound[];
  userProgress: GetUserProgressData | null;
  achievements: AchievementOverview | null;
  hasNewAchievements: boolean;
  segmentMode: SegmentMode;
  selectedSeasonId: string;
  selectedTournamentId: string;
  seasons: SeasonRecord[];
  tournaments: TournamentRecord[];
  matchesFilter: MatchFeedFilter;
  matches: MatchRecord[];
  matchesCursor: string | null;
  matchesLoading: boolean;
  profileMatches: MatchRecord[];
  profileMatchesCursor: string | null;
  profileLoading: boolean;
  profileMatchesLoading: boolean;
  profileSubmitting: boolean;
  profileFormMessage: string;
  profileAchievementsExpanded: boolean;
  profileSelectedAchievementKey: string;
  profileRecentlySeenAchievementKeys: string[];
  profileSegmentSummaries: Record<string, ProfileSegmentSummary>;
  profileSegmentSummaryLoadingKeys: string[];
  sharedUserProfile: GetSharedUserProfileData | null;
  sharedUserProfileSelectedAchievementKey: string;
  sharedUserProfileUserId: string;
  sharedUserProfileLoading: boolean;
  sharedUserProfileMatchesLoading: boolean;
  matchBracketContextByMatchId: Record<string, { roundTitle: string; isFinal: boolean }>;
  matchSubmitting: boolean;
  matchFormError: string;
  matchFormMessage: string;
  seasonSubmitting: boolean;
  seasonFormError: string;
  seasonFormMessage: string;
  seasonParticipantQuery: string;
  seasonParticipantResults: ParticipantSearchEntry[];
  seasonParticipantSearchLoading: boolean;
  seasonParticipantSearchError: string;
  tournamentSubmitting: boolean;
  tournamentFormMessage: string;
  editingSeasonId: string;
  editingSeasonParticipantIds: string[];
  seasonDraftMode: SeasonDraftMode;
  pendingCreateRequestId: string;
  shareCache: Record<string, SegmentShareInfo>;
  shareErrors: Record<string, string>;
  shareLoadingSegmentKey: string;
  shareNotice: string;
  pendingShareToken: string;
  sharePanelSeasonTargetId: string;
  sharePanelTournamentTargetId: string;
  shareAlertMessage: string;
  matchTournamentBracketCache: Record<string, GetTournamentBracketData>;
}

export interface SegmentShareInfo {
  segmentType: SegmentType;
  segmentId: string;
  shareToken: string;
  url: string;
  expiresAt: string;
}

export interface SharePanelElements {
  section: HTMLElement;
  createButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  status: HTMLParagraphElement;
  qrCanvas: HTMLCanvasElement;
  qrWrapper: HTMLElement;
  copyFeedback: HTMLSpanElement;
  animationTimer: number | null;
}

export interface FairPlayerProfile {
  userId: string;
  displayName: string;
  elo: number;
  winRate: number;
}

export interface SuggestedMatchup {
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  fairnessScore: number;
}

export interface TournamentPlannerMatch {
  id: string;
  leftPlayerId: string | null;
  rightPlayerId: string | null;
  createdMatchId?: string | null;
  winnerPlayerId?: string | null;
  locked?: boolean;
  isFinal?: boolean;
}

export interface TournamentPlannerRound {
  title: string;
  matches: TournamentPlannerMatch[];
}

export interface TournamentPlannerState {
  name: string;
  tournamentId: string;
  participantIds: string[];
  participantQuery: string;
  participantResults: ParticipantSearchEntry[];
  participantSearchLoading: boolean;
  participantSearchError: string;
  firstRoundMatches: TournamentPlannerMatch[];
  rounds: TournamentPlannerRound[];
  error: string;
}

export type DeleteWarningContext = "match" | "season" | "tournament";

export interface DeleteWarningRequest {
  context: DeleteWarningContext;
  detail?: () => string | null;
  confirmationValue?: string;
}

export interface ProgressGeometry {
  path: string;
  coordinates: Array<{ x: number; y: number }>;
  min: number;
  max: number;
}
