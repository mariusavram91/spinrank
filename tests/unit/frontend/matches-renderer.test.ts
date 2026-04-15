import type { DashboardState } from "../../../src/ui/shared/types/app";
import { createMatchesRenderer } from "../../../src/ui/features/dashboard/renderers/matches";

const createDashboardState = (overrides: Partial<DashboardState> = {}): DashboardState =>
  ({
    screen: "dashboard",
    loading: false,
    error: "",
    leaderboard: [],
    players: [
      {
        userId: "user_1",
        displayName: "Ada",
        avatarUrl: null,
        elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        rank: 1,
      },
      {
        userId: "user_2",
        displayName: "Bea",
        avatarUrl: null,
        elo: 1180,
        wins: 0,
        losses: 0,
        streak: 0,
        rank: 2,
      },
    ],
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
    matches: [
      {
        id: "match_1",
        matchType: "singles",
        formatType: "single_game",
        pointsToWin: 11,
        teamAPlayerIds: ["user_1"],
        teamBPlayerIds: ["user_2"],
        score: [{ teamA: 11, teamB: 8 }],
        winnerTeam: "A",
        playedAt: "2026-04-16T10:00:00.000Z",
        seasonId: null,
        tournamentId: null,
        createdByUserId: "user_1",
        status: "active",
        createdAt: "2026-04-16T10:05:00.000Z",
      },
    ],
    disputedMatches: [],
    highlightedMatchId: "match_1",
    highlightedMatchIds: ["match_1"],
    pendingHighlightedMatchIds: ["match_1"],
    matchesCursor: null,
    matchesLoading: false,
    profileMatches: [],
    profileMatchesCursor: null,
    profileLoading: false,
    profileMatchesLoading: false,
    profileSubmitting: false,
    profileFormMessage: "",
    profileAchievementsExpanded: false,
    profileSelectedAchievementKey: "",
    profileRecentlySeenAchievementKeys: [],
    profileSegmentSummaries: {},
    profileSegmentSummaryLoadingKeys: [],
    sharedUserProfile: null,
    sharedUserProfileSelectedAchievementKey: "",
    sharedUserProfileUserId: "",
    sharedUserProfileLoading: false,
    sharedUserProfileMatchesLoading: false,
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
    matchDraft: null,
    shareCache: {},
    shareErrors: {},
    shareLoadingSegmentKey: "",
    shareNotice: "",
    pendingShareToken: "",
    sharePanelSeasonTargetId: "",
    sharePanelTournamentTargetId: "",
    shareAlertMessage: "",
    matchTournamentBracketCache: {},
    ...overrides,
  }) as DashboardState;

describe("matches renderer", () => {
  it("scrolls a pending highlighted match into view on the next paint", () => {
    const dashboardState = createDashboardState();
    const matchesList = document.createElement("div");
    const matchesMeta = document.createElement("div");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
    });

    const renderer = createMatchesRenderer({
      dashboardState,
      matchesList,
      matchesMeta,
      t: (key) => key,
      renderMatchScore: (match) => `${match.score[0]?.teamA ?? 0}-${match.score[0]?.teamB ?? 0}`,
      renderPlayerNames: (playerIds) => playerIds.join(", "),
      renderMatchContext: () => "",
      formatDateTime: () => "Apr 16",
      getCurrentUserId: () => "user_1",
      canDeleteMatch: () => false,
      onDeleteMatch: vi.fn(),
      onDisputeMatch: vi.fn(),
      onRemoveMatchDispute: vi.fn(),
    });

    renderer.render();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    expect(dashboardState.pendingHighlightedMatchIds).toEqual([]);
    expect(matchesList.querySelector(".match-row--highlighted")).not.toBeNull();

    vi.restoreAllMocks();
  });
});
