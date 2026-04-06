import { hasBackendConfig } from "../../../config/env";
import { loadSession } from "../../../auth/session";
import type { DashboardState, TournamentPlannerState, ViewState } from "../../shared/types/app";

export const createViewState = (): { current: ViewState } => ({
  current: (() => {
    const existing = loadSession();
    return existing
      ? { status: "authenticated", message: "Signed in", session: existing }
      : hasBackendConfig
        ? { status: "idle", message: "Sign in with Google to open the leaderboard." }
        : { status: "error", message: "Configure the backend URL before testing login." };
  })(),
});

export const createDashboardState = (): DashboardState => ({
  screen: "dashboard",
  loading: false,
  error: "",
  leaderboard: [],
  players: [],
  leaderboardUpdatedAt: "",
  leaderboardStats: null,
  tournamentBracket: [],
  userProgress: null,
  achievements: null,
  hasNewAchievements: false,
  segmentMode: "global",
  selectedSeasonId: "",
  selectedTournamentId: "",
  seasons: [],
  tournaments: [],
  matchesFilter: "mine",
  matches: [],
  matchesCursor: null,
  matchesLoading: false,
  profileMatches: [],
  profileMatchesCursor: null,
  profileLoading: false,
  profileMatchesLoading: false,
  profileSegmentSummaries: {},
  profileSegmentSummaryLoadingKeys: [],
  matchBracketContextByMatchId: {},
  matchSubmitting: false,
  matchFormError: "",
  matchFormMessage: "",
  seasonSubmitting: false,
  seasonFormError: "",
  seasonFormMessage: "",
  seasonParticipantQuery: "",
  seasonParticipantResults: [],
  seasonParticipantSearchLoading: false,
  seasonParticipantSearchError: "",
  tournamentSubmitting: false,
  tournamentFormMessage: "",
  editingSeasonId: "",
  editingSeasonParticipantIds: [],
  seasonDraftMode: "create",
  pendingCreateRequestId: "",
  shareCache: {},
  shareErrors: {},
  shareLoadingSegmentKey: "",
  shareNotice: "",
  pendingShareToken: "",
  sharePanelSeasonTargetId: "",
  sharePanelTournamentTargetId: "",
  shareAlertMessage: "",
  matchTournamentBracketCache: {},
});

export const captureShareTokenFromUrl = (dashboardState: DashboardState): void => {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  const shareToken = url.searchParams.get("shareToken");
  if (!shareToken) {
    return;
  }
  dashboardState.pendingShareToken = shareToken;
  url.searchParams.delete("shareToken");
  const newSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ""}${url.hash}`;
  window.history.replaceState(null, "", nextUrl);
};

export const createTournamentPlannerState = (): TournamentPlannerState => ({
  name: "",
  tournamentId: "",
  participantIds: [],
  participantQuery: "",
  participantResults: [],
  participantSearchLoading: false,
  participantSearchError: "",
  firstRoundMatches: [],
  rounds: [],
  error: "",
});
