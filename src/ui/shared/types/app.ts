import type {
  AppSession,
  GetUserProgressData,
  LeaderboardEntry,
  MatchFeedFilter,
  MatchRecord,
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

export interface DashboardState {
  screen: "dashboard" | "createMatch" | "createTournament" | "createSeason" | "faq" | "privacy";
  loading: boolean;
  error: string;
  leaderboard: LeaderboardEntry[];
  players: LeaderboardEntry[];
  leaderboardUpdatedAt: string;
  leaderboardStats: SegmentLeaderboardStats | null;
  tournamentBracket: TournamentBracketRound[];
  userProgress: GetUserProgressData | null;
  segmentMode: SegmentMode;
  selectedSeasonId: string;
  selectedTournamentId: string;
  seasons: SeasonRecord[];
  tournaments: TournamentRecord[];
  matchesFilter: MatchFeedFilter;
  matches: MatchRecord[];
  matchesCursor: string | null;
  matchesLoading: boolean;
  matchBracketContextByMatchId: Record<string, { roundTitle: string; isFinal: boolean }>;
  matchSubmitting: boolean;
  matchFormError: string;
  matchFormMessage: string;
  seasonSubmitting: boolean;
  seasonFormError: string;
  seasonFormMessage: string;
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
