import { createDashboardActions } from "../../../src/ui/features/dashboard/actions";
import type {
  GetDashboardData,
  GetMatchesData,
  LeaderboardEntry,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
} from "../../../src/api/contract";
import type { DashboardState, SharePanelElements } from "../../../src/ui/shared/types/app";

const leaderboardEntry = (overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  userId: "user_1",
  displayName: "Ada",
  avatarUrl: null,
  elo: 1200,
  wins: 3,
  losses: 1,
  streak: 2,
  rank: 1,
  ...overrides,
});

const matchRecord = (overrides: Partial<MatchRecord> = {}): MatchRecord => ({
  id: "match_1",
  matchType: "singles",
  formatType: "single_game",
  pointsToWin: 11,
  teamAPlayerIds: ["user_1"],
  teamBPlayerIds: ["user_2"],
  score: [{ teamA: 11, teamB: 7 }],
  winnerTeam: "A",
  playedAt: "2026-04-06T10:00:00.000Z",
  seasonId: null,
  tournamentId: null,
  createdByUserId: "user_1",
  status: "active",
  createdAt: "2026-04-06T10:05:00.000Z",
  ...overrides,
});

const seasonRecord = (overrides: Partial<SeasonRecord> = {}): SeasonRecord => ({
  id: "season_1",
  name: "Spring",
  startDate: "2026-04-01",
  endDate: "2026-04-30",
  isActive: true,
  status: "active",
  baseEloMode: "carry_over",
  participantIds: ["user_1"],
  createdByUserId: "user_1",
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: null,
  isPublic: true,
  ...overrides,
});

const tournamentRecord = (overrides: Partial<TournamentRecord> = {}): TournamentRecord => ({
  id: "tournament_1",
  name: "Cup",
  date: "2026-04-06",
  seasonId: null,
  seasonName: null,
  status: "active",
  createdByUserId: "user_1",
  createdAt: "2026-04-06T00:00:00.000Z",
  completedAt: null,
  participantCount: 2,
  participantIds: ["user_1", "user_2"],
  bracketStatus: "draft",
  ...overrides,
});

const createDashboardState = (overrides: Partial<DashboardState> = {}): DashboardState =>
  ({
    screen: "dashboard",
    loading: false,
    error: "",
    leaderboard: [],
    players: [],
    leaderboardUpdatedAt: "",
    leaderboardStats: null,
    tournamentBracket: [],
    userProgress: null,
    segmentMode: "global",
    selectedSeasonId: "missing_season",
    selectedTournamentId: "missing_tournament",
    seasons: [],
    tournaments: [],
    matchesFilter: "recent",
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
    ...overrides,
  }) as DashboardState;

const createPanel = (): SharePanelElements =>
  ({
    section: document.createElement("section"),
    createButton: document.createElement("button"),
    copyButton: document.createElement("button"),
    status: document.createElement("p"),
    qrCanvas: document.createElement("canvas"),
    qrWrapper: document.createElement("div"),
    copyFeedback: document.createElement("span"),
    animationTimer: null,
  }) as SharePanelElements;

const createHarness = (dashboardState: DashboardState, runAuthedAction = vi.fn()) => {
  const markLeaderboardDirty = vi.fn();
  const syncDashboardState = vi.fn();
  const syncAuthState = vi.fn();
  const setGlobalLoading = vi.fn();
  const args = {
    dashboardState,
    runAuthedAction,
    hasUnreadAchievements: vi.fn(() => false),
    syncAuthState,
    syncDashboardState,
    setGlobalLoading,
    markLeaderboardDirty,
    populateSeasonOptions: vi.fn(),
    populateSeasonManagerLoadOptions: vi.fn(),
    populateTournamentOptions: vi.fn(),
    populateTournamentPlannerLoadOptions: vi.fn(),
    populateMatchFormOptions: vi.fn(),
    renderSeasonEditor: vi.fn(),
    renderTournamentPlanner: vi.fn(),
    buildSegmentShareKey: (segmentType: "season" | "tournament", segmentId: string) => `${segmentType}:${segmentId}`,
    animateSharePanel: vi.fn(),
    showShareAlert: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    t: (key: string) => key,
    getMatchLimitForFilter: vi.fn((filter: string) => (filter === "recent" ? 4 : 20)),
  };

  return {
    actions: createDashboardActions(args),
    args,
    syncAuthState,
    syncDashboardState,
    setGlobalLoading,
    markLeaderboardDirty,
  };
};

describe("dashboard actions", () => {
  it("loads dashboard data, normalizes selected ids, and syncs helper state", async () => {
    const dashboardState = createDashboardState();
    const data: GetDashboardData = {
      seasons: [
        seasonRecord({ id: "season_2", isActive: false }),
        seasonRecord({ id: "season_3", isActive: true }),
      ],
      tournaments: [tournamentRecord({ id: "tournament_2" })],
      leaderboard: [leaderboardEntry()],
      leaderboardUpdatedAt: "2026-04-06T09:00:00.000Z",
      userProgress: {
        currentRank: 1,
        currentElo: 1200,
        bestRank: 1,
        bestElo: 1200,
        currentStreak: 2,
        bestStreak: 2,
        wins: 3,
        losses: 1,
        points: [],
      },
      matches: [
        matchRecord({
          id: "match_ctx",
          bracketContext: { roundTitle: "Final", isFinal: true },
        }),
      ],
      nextCursor: "cursor_1",
      matchBracketContextByMatchId: { stale: { roundTitle: "Old", isFinal: false } },
    };
    const runAuthedAction = vi.fn().mockResolvedValue(data);
    const harness = createHarness(dashboardState, runAuthedAction);

    await harness.actions.loadDashboard();

    expect(runAuthedAction).toHaveBeenCalledWith("getDashboard", {
      matchesLimit: 4,
      matchesFilter: "recent",
    });
    expect(dashboardState.seasons.map((season) => season.id)).toEqual(["season_2", "season_3"]);
    expect(dashboardState.selectedSeasonId).toBe("season_3");
    expect(dashboardState.selectedTournamentId).toBe("tournament_2");
    expect(dashboardState.players).toEqual(data.leaderboard);
    expect(dashboardState.leaderboard).toEqual(data.leaderboard);
    expect(dashboardState.userProgress).toEqual(data.userProgress);
    expect(dashboardState.matches).toEqual(data.matches);
    expect(dashboardState.matchesCursor).toBe("cursor_1");
    expect(dashboardState.matchBracketContextByMatchId).toEqual(data.matchBracketContextByMatchId);
    expect(dashboardState.loading).toBe(false);
    expect(harness.args.populateSeasonOptions).toHaveBeenCalled();
    expect(harness.args.populateSeasonManagerLoadOptions).toHaveBeenCalled();
    expect(harness.args.populateTournamentOptions).toHaveBeenCalled();
    expect(harness.args.populateTournamentPlannerLoadOptions).toHaveBeenCalled();
    expect(harness.args.populateMatchFormOptions).toHaveBeenCalled();
    expect(harness.args.renderSeasonEditor).toHaveBeenCalled();
    expect(harness.args.renderTournamentPlanner).toHaveBeenCalled();
    expect(harness.markLeaderboardDirty).toHaveBeenCalledTimes(1);
    expect(harness.setGlobalLoading).toHaveBeenNthCalledWith(1, true, "Loading dashboard...");
    expect(harness.setGlobalLoading).toHaveBeenNthCalledWith(2, false);
  });

  it("clears segment leaderboard state when the selected season is no longer visible", async () => {
    const dashboardState = createDashboardState({
      segmentMode: "season",
      selectedSeasonId: "stale_season",
      leaderboard: [leaderboardEntry()],
      leaderboardUpdatedAt: "2026-04-06T08:00:00.000Z",
      leaderboardStats: {
        totalMatches: 1,
        mostMatchesPlayer: null,
        mostWinsPlayer: null,
        tournamentWinnerPlayer: null,
      },
    });
    const runAuthedAction = vi
      .fn()
      .mockResolvedValueOnce({
        seasons: [seasonRecord({ id: "season_1" })],
        tournaments: [],
        leaderboard: [leaderboardEntry()],
        leaderboardUpdatedAt: "2026-04-06T09:00:00.000Z",
        userProgress: {
          currentRank: 1,
          currentElo: 1200,
          bestRank: 1,
          bestElo: 1200,
          currentStreak: 2,
          bestStreak: 2,
          wins: 3,
          losses: 1,
          points: [],
        },
        matches: [],
        nextCursor: null,
        matchBracketContextByMatchId: {},
      } satisfies GetDashboardData)
      .mockResolvedValueOnce({
        leaderboard: [leaderboardEntry({ userId: "user_2", displayName: "Season Ada", rank: 3 })],
        updatedAt: "2026-04-06T10:00:00.000Z",
        stats: {
          totalMatches: 4,
          mostMatchesPlayer: null,
          mostWinsPlayer: null,
          tournamentWinnerPlayer: null,
        },
      });
    const harness = createHarness(dashboardState, runAuthedAction);

    await harness.actions.loadDashboard();

    expect(runAuthedAction).toHaveBeenCalledTimes(2);
    expect(runAuthedAction).toHaveBeenNthCalledWith(2, "getSegmentLeaderboard", {
      segmentType: "season",
      segmentId: "season_1",
    });
    expect(dashboardState.selectedSeasonId).toBe("season_1");
    expect(dashboardState.leaderboard).toEqual([
      expect.objectContaining({ userId: "user_2", displayName: "Season Ada", rank: 3 }),
    ]);
    expect(dashboardState.leaderboardUpdatedAt).toBe("2026-04-06T10:00:00.000Z");
    expect(dashboardState.leaderboardStats).toMatchObject({ totalMatches: 4 });
    expect(harness.markLeaderboardDirty).toHaveBeenCalledTimes(2);
  });

  it("loads and paginates match history while preserving bracket context entries", async () => {
    const dashboardState = createDashboardState({
      matchesFilter: "mine",
      matches: [matchRecord({ id: "existing_match" })],
      matchesCursor: "cursor_1",
      matchBracketContextByMatchId: {
        existing_match: { roundTitle: "Semifinal", isFinal: false },
      },
    });
    const pageOne: GetMatchesData = {
      matches: [
        matchRecord({
          id: "match_2",
          bracketContext: { roundTitle: "Final", isFinal: true },
        }),
      ],
      nextCursor: "cursor_2",
    };
    const pageTwo: GetMatchesData = {
      matches: [matchRecord({ id: "match_3" })],
      nextCursor: null,
    };
    const runAuthedAction = vi
      .fn()
      .mockResolvedValueOnce(pageOne)
      .mockResolvedValueOnce(pageTwo);
    const harness = createHarness(dashboardState, runAuthedAction);

    await harness.actions.applyMatchFilter("all");
    await harness.actions.loadMoreMatches();

    expect(runAuthedAction).toHaveBeenNthCalledWith(1, "getMatches", {
      filter: "all",
      limit: 20,
      cursor: undefined,
    });
    expect(runAuthedAction).toHaveBeenNthCalledWith(2, "getMatches", {
      filter: "all",
      limit: 20,
      cursor: "cursor_2",
    });
    expect(dashboardState.matches.map((match) => match.id)).toEqual(["match_2", "match_3"]);
    expect(dashboardState.matchesCursor).toBeNull();
    expect(dashboardState.matchesFilter).toBe("all");
    expect(dashboardState.matchBracketContextByMatchId).toEqual({
      match_2: { roundTitle: "Final", isFinal: true },
    });
  });

  it("creates segment share links, rewrites urls for the current origin, and redeems pending tokens", async () => {
    const panel = createPanel();
    const dashboardState = createDashboardState({
      pendingShareToken: "share_token",
      shareErrors: { "season:season_1": "stale" },
    });
    const runAuthedAction = vi
      .fn()
      .mockResolvedValueOnce({
        shareToken: "fresh_token",
        url: "https://api.example.test/share/fresh_token",
        expiresAt: "2026-04-07T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        segmentType: "season",
        joined: true,
      });
    const harness = createHarness(dashboardState, runAuthedAction);

    window.history.replaceState({}, "", "/dashboard?foo=bar#hash");

    await harness.actions.refreshSegmentShareLink("season", "season_1", panel);
    await harness.actions.tryRedeemPendingShareToken();

    expect(runAuthedAction).toHaveBeenNthCalledWith(1, "createSegmentShareLink", {
      segmentType: "season",
      segmentId: "season_1",
    });
    expect(dashboardState.shareCache["season:season_1"]).toMatchObject({
      shareToken: "fresh_token",
    });
    expect(dashboardState.shareCache["season:season_1"]?.url).toContain("/dashboard?shareToken=fresh_token");
    expect(dashboardState.shareErrors["season:season_1"]).toBeUndefined();
    expect(harness.args.animateSharePanel).toHaveBeenCalledWith(panel);
    expect(runAuthedAction).toHaveBeenNthCalledWith(2, "redeemSegmentShareLink", {
      shareToken: "share_token",
    });
    expect(dashboardState.pendingShareToken).toBe("");
    expect(harness.args.showShareAlert).toHaveBeenCalledWith("shareJoinedSeason");
  });

  it("surfaces dashboard and share failures without leaving loading state behind", async () => {
    const dashboardState = createDashboardState({
      pendingShareToken: "share_token",
      shareCache: { "season:season_1": { segmentType: "season", segmentId: "season_1", shareToken: "x", url: "u", expiresAt: "e" } },
    });
    const runAuthedAction = vi
      .fn()
      .mockRejectedValueOnce(new Error("Dashboard exploded"))
      .mockRejectedValueOnce(new Error("Link failed"))
      .mockRejectedValueOnce(new Error("Join failed"));
    const harness = createHarness(dashboardState, runAuthedAction);

    await harness.actions.loadDashboard();
    await harness.actions.refreshSegmentShareLink("season", "season_1");
    await harness.actions.tryRedeemPendingShareToken();

    expect(dashboardState.loading).toBe(false);
    expect(dashboardState.error).toBe("Dashboard exploded");
    expect(dashboardState.shareLoadingSegmentKey).toBe("");
    expect(dashboardState.shareErrors["season:season_1"]).toBe("Link failed");
    expect(harness.args.showShareAlert).toHaveBeenCalledWith("Join failed");
  });
});
