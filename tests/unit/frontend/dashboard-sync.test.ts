import { createDashboardSync } from "../../../src/ui/features/dashboard/sync";
import type { MatchFeedFilter, SeasonRecord, TournamentRecord } from "../../../src/api/contract";
import type { DashboardState, SharePanelElements, TournamentPlannerState } from "../../../src/ui/shared/types/app";

const makeButton = () => document.createElement("button");
const makeInput = () => document.createElement("input");
const makeSelect = () => document.createElement("select");
const makeDiv = () => document.createElement("div");
const makeParagraph = () => document.createElement("p");

const createSharePanelElements = (): SharePanelElements => ({
  section: document.createElement("section"),
  createButton: makeButton(),
  copyButton: makeButton(),
  status: makeParagraph(),
  qrCanvas: document.createElement("canvas"),
  qrWrapper: makeDiv(),
  copyFeedback: document.createElement("span"),
  animationTimer: null,
});

const createSeasonRecord = (overrides?: Partial<SeasonRecord>): SeasonRecord => ({
  id: "season_1",
  name: "Spring",
  startDate: "2026-04-01",
  endDate: "2026-04-30",
  isActive: true,
  status: "active",
  baseEloMode: "carry_over",
  participantIds: ["user_1", "user_2"],
  createdByUserId: "user_1",
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: null,
  isPublic: true,
  ...overrides,
});

const createTournamentRecord = (overrides?: Partial<TournamentRecord>): TournamentRecord => ({
  id: "tournament_1",
  name: "Cup",
  date: "2026-04-06",
  seasonId: "season_1",
  seasonName: "Spring",
  status: "active",
  createdByUserId: "user_1",
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: null,
  participantCount: 2,
  participantIds: ["user_1", "user_2"],
  bracketStatus: "draft",
  ...overrides,
});

const createLeaderboardEntry = (overrides?: Record<string, unknown>) => ({
  userId: "user_1",
  displayName: "Ada",
  avatarUrl: null,
  elo: 1200,
  highestElo: 1290,
  highestScore: 1230,
  wins: 7,
  losses: 1,
  streak: 4,
  bestWinStreak: 4,
  rank: 1,
  ...overrides,
});

const createDom = () => ({
  dashboardStatus: makeDiv(),
  shareAlert: makeDiv(),
  globalButton: makeButton(),
  seasonButton: makeButton(),
  tournamentButton: makeButton(),
  seasonSelect: makeSelect(),
  tournamentSelect: makeSelect(),
  refreshButton: makeButton(),
  createMenuButton: makeButton(),
  openCreateMatchButton: makeButton(),
  openCreateTournamentButton: makeButton(),
  openCreateSeasonButton: makeButton(),
  tournamentMeta: makeDiv(),
  seasonMeta: makeDiv(),
  closeCreateMatchButton: makeButton(),
  closeCreateSeasonButton: makeButton(),
  resetSeasonDraftButton: (() => {
    const button = makeButton();
    const wrapper = makeDiv();
    wrapper.append(button);
    return button;
  })(),
  seasonNameInput: makeInput(),
  seasonStartDateInput: makeInput(),
  seasonEndDateInput: makeInput(),
  seasonBaseEloSelect: makeSelect(),
  seasonIsActiveInput: makeInput(),
  seasonIsPublicInput: makeInput(),
  seasonSelectAllParticipantsInput: makeInput(),
  suggestMatchButton: makeButton(),
  formTournamentSelect: makeSelect(),
  matchTypeSelect: makeSelect(),
  resetTournamentDraftButton: (() => {
    const button = makeButton();
    const wrapper = makeDiv();
    wrapper.append(button);
    return button;
  })(),
  saveTournamentButton: makeButton(),
  suggestTournamentButton: makeButton(),
  loadMoreButton: makeButton(),
  matchFilterButtons: new Map<MatchFeedFilter, HTMLButtonElement>([
    ["recent", makeButton()],
    ["mine", makeButton()],
    ["all", makeButton()],
  ]),
  composerStatus: makeDiv(),
  seasonStatus: makeDiv(),
  submitSeasonButton: makeButton(),
  submitMatchButton: makeButton(),
  tournamentStatus: makeDiv(),
  deleteSeasonButton: makeButton(),
  deleteTournamentButton: makeButton(),
  seasonLockNotice: makeDiv(),
  tournamentLockNotice: makeDiv(),
  seasonBaseEloToggle: (() => {
    const root = makeDiv();
    root.innerHTML = '<button data-value="carry_over"></button>';
    return root;
  })(),
  seasonStateToggle: (() => {
    const root = makeDiv();
    root.innerHTML = '<button data-value="active"></button>';
    return root;
  })(),
  seasonVisibilityToggle: (() => {
    const root = makeDiv();
    root.innerHTML = '<button data-value="public"></button>';
    return root;
  })(),
  tournamentNameInput: makeInput(),
  tournamentDateInput: makeInput(),
  tournamentSeasonSelect: makeSelect(),
  tournamentSelectAllParticipantsInput: makeInput(),
  loadSeasonSelect: makeSelect(),
  loadTournamentSelect: makeSelect(),
  leaderboardStatsGroup: makeDiv(),
  leaderboardMatchesSummary: makeDiv(),
  leaderboardMatchesSummaryValue: makeDiv(),
  leaderboardStatMostActive: makeDiv(),
  leaderboardStatMostActivePlayer: makeDiv(),
  leaderboardStatMostActiveMeta: makeDiv(),
  leaderboardStatLongestStreak: makeDiv(),
  leaderboardStatLongestStreakLabel: makeDiv(),
  leaderboardStatLongestStreakPlayer: makeDiv(),
  leaderboardStatLongestStreakMeta: makeDiv(),
  leaderboardStatHighestPeak: makeDiv(),
  leaderboardStatHighestPeakLabel: makeDiv(),
  leaderboardStatHighestPeakPlayer: makeDiv(),
  leaderboardStatHighestPeakMeta: makeDiv(),
  leaderboardStatMostWins: makeDiv(),
  leaderboardStatMostWinsPlayer: makeDiv(),
  leaderboardStatMostWinsMeta: makeDiv(),
  leaderboardStatBestSingles: makeDiv(),
  leaderboardStatBestSinglesPlayer: makeDiv(),
  leaderboardStatBestSinglesMeta: makeDiv(),
  leaderboardStatBestDoubles: makeDiv(),
  leaderboardStatBestDoublesPlayer: makeDiv(),
  leaderboardStatBestDoublesMeta: makeDiv(),
  leaderboardStatBestWinRate: makeDiv(),
  leaderboardStatBestWinRatePlayer: makeDiv(),
  leaderboardStatBestWinRateMeta: makeDiv(),
});

const setSelectValue = (select: HTMLSelectElement, value: string) => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  select.append(option);
  select.value = value;
};

const createDashboardState = (overrides?: Partial<DashboardState>) =>
  ({
    error: "",
    loading: false,
    shareNotice: "",
    shareAlertMessage: "",
    segmentMode: "global",
    screen: "dashboard",
    players: [],
    leaderboardUpdatedAt: "",
    tournamentBracket: [],
    userProgress: null,
    selectedSeasonId: "",
    selectedTournamentId: "",
    matches: [],
    profileMatches: [],
    profileMatchesCursor: null,
    profileLoading: false,
    profileMatchesLoading: false,
    profileSegmentSummaries: {},
    profileSegmentSummaryLoadingKeys: [],
    matchBracketContextByMatchId: {},
    seasonParticipantQuery: "",
    seasonParticipantResults: [],
    seasonParticipantSearchLoading: false,
    seasonParticipantSearchError: "",
    editingSeasonId: "",
    editingSeasonParticipantIds: [],
    pendingCreateRequestId: "",
    shareCache: {},
    shareErrors: {},
    shareLoadingSegmentKey: "",
    pendingShareToken: "",
    matchTournamentBracketCache: {},
    seasons: [createSeasonRecord()],
    tournaments: [createTournamentRecord()],
    matchesLoading: false,
    seasonDraftMode: "create",
    matchSubmitting: false,
    seasonSubmitting: false,
    tournamentSubmitting: false,
    matchFormError: "",
    matchFormMessage: "",
    seasonFormError: "",
    seasonFormMessage: "",
    tournamentFormMessage: "",
    matchesCursor: null,
    matchesFilter: "mine",
    leaderboard: [
      createLeaderboardEntry(),
      createLeaderboardEntry({
        userId: "user_2",
        displayName: "Bob",
        highestElo: 1260,
        highestScore: 1210,
        elo: 1180,
        wins: 12,
        losses: 8,
        streak: 2,
        rank: 2,
      }),
    ],
    leaderboardStats: {
      totalMatches: 12,
      mostMatchesPlayer: {
        userId: "user_1",
        displayName: "Ada",
        avatarUrl: null,
        matchesPlayed: 8,
        wins: 7,
        losses: 1,
      },
      mostWinsPlayer: {
        userId: "user_1",
        displayName: "Ada",
        avatarUrl: null,
        matchesPlayed: 8,
        wins: 7,
        losses: 1,
      },
      bestSinglesPlayer: {
        userId: "user_1",
        displayName: "Ada",
        avatarUrl: null,
        wins: 6,
        losses: 1,
      },
      bestDoublesPair: {
        playerIds: ["user_1", "user_2"],
        displayName: "Ada & Bob",
        wins: 2,
        losses: 1,
      },
      tournamentWinnerPlayer: null,
    },
    sharePanelSeasonTargetId: "season_1",
    sharePanelTournamentTargetId: "tournament_1",
    ...overrides,
  }) as DashboardState;

const createTournamentPlannerState = (overrides?: Partial<TournamentPlannerState>) =>
  ({
    tournamentId: "",
    participantIds: ["user_1", "user_2"],
    rounds: [{ matches: [] }],
    error: "",
    ...overrides,
  }) as TournamentPlannerState;

describe("dashboard sync", () => {
  it("renders dashboard statuses, stats, share panels, and draft summaries", () => {
    const dom = createDom();
    setSelectValue(dom.formTournamentSelect, "");
    dom.matchTypeSelect.value = "singles";

    const renderers = {
      leaderboard: { render: vi.fn() },
      matches: { render: vi.fn() },
      progress: { render: vi.fn() },
    };
    const sharePanels = {
      season: createSharePanelElements(),
      tournament: createSharePanelElements(),
      getSeasonShareTargetId: () => "season_1",
      getTournamentShareTargetId: () => "tournament_1",
      getSeasonSharePanelRenderedUrl: () => "",
      setSeasonSharePanelRenderedUrl: vi.fn(),
      getTournamentSharePanelRenderedUrl: () => "",
      setTournamentSharePanelRenderedUrl: vi.fn(),
      updateSharePanelElements: vi.fn(),
      updateSeasonSharePanelVisibility: vi.fn(),
      updateTournamentSharePanelVisibility: vi.fn(),
    };
    const helpers = {
      renderSeasonDraftSummary: vi.fn(),
      renderTournamentDraftSummary: vi.fn(),
      renderMatchDraftSummary: vi.fn(),
      syncMatchFormLockState: vi.fn(),
      scheduleFormStatusHide: vi.fn(),
      getEditingSeason: () => createSeasonRecord(),
      getEditingTournament: () => createTournamentRecord(),
      hasTournamentProgress: () => false,
      isLockedSeason: () => false,
      isLockedTournament: () => false,
      canSoftDelete: () => true,
      getCurrentUserId: () => "user_1",
    };

    createDashboardSync({
      dashboardState: createDashboardState({
        shareNotice: "Copied link",
        shareAlertMessage: "Join via share link",
        matchFormMessage: "Saved",
        seasonFormMessage: "Season saved",
        tournamentFormMessage: "Tournament saved",
        matchesCursor: "cursor_1",
      }),
      tournamentPlannerState: createTournamentPlannerState(),
      dom,
      sharePanels,
      renderers,
      helpers,
      t: (key) => key,
    }).syncDashboardState();

    expect(dom.dashboardStatus.textContent).toBe("Copied link");
    expect(dom.shareAlert.hidden).toBe(false);
    expect(dom.shareAlert.textContent).toBe("Join via share link");
    expect(dom.globalButton.getAttribute("aria-pressed")).toBe("true");
    expect(dom.seasonButton.disabled).toBe(false);
    expect(dom.tournamentButton.disabled).toBe(false);
    expect(dom.loadMoreButton.hidden).toBe(false);
    expect(dom.suggestMatchButton.textContent).toBe("suggestFairMatchSingles");
    expect(dom.composerStatus.hidden).toBe(false);
    expect(dom.seasonStatus.hidden).toBe(false);
    expect(dom.tournamentStatus.hidden).toBe(false);
    expect(dom.deleteSeasonButton.hidden).toBe(false);
    expect(dom.deleteTournamentButton.hidden).toBe(false);
    expect(dom.seasonBaseEloSelect.disabled).toBe(false);
    expect(
      dom.seasonBaseEloToggle?.querySelector<HTMLButtonElement>('button[data-value="carry_over"]')?.disabled,
    ).toBe(false);
    expect(dom.leaderboardStatsGroup.hidden).toBe(false);
    expect(dom.leaderboardMatchesSummaryValue.textContent).toBe("12");
    expect(dom.leaderboardStatMostActive.hidden).toBe(false);
    expect(dom.leaderboardStatMostWins.hidden).toBe(false);
    expect(dom.leaderboardStatBestSingles.hidden).toBe(false);
    expect(dom.leaderboardStatBestSinglesPlayer.textContent).toBe("Ada");
    expect(dom.leaderboardStatBestSinglesMeta.textContent).toContain("leaderboardWins");
    expect(dom.leaderboardStatBestSinglesMeta.textContent).toContain("leaderboardLosses");
    expect(dom.leaderboardStatBestDoubles.hidden).toBe(false);
    expect(dom.leaderboardStatBestDoublesPlayer.textContent).toBe("Ada & Bob");
    expect(dom.leaderboardStatLongestStreak.hidden).toBe(false);
    expect(dom.leaderboardStatHighestPeak.hidden).toBe(false);
    expect(dom.leaderboardStatHighestPeakPlayer.textContent).toBe("Ada");
    expect(dom.leaderboardStatHighestPeakLabel.textContent).toBe("leaderboardHighestEloLabel");
    expect(dom.leaderboardStatHighestPeakMeta.textContent).toContain("1,290");
    expect(dom.leaderboardStatBestWinRate.hidden).toBe(false);
    expect(dom.leaderboardStatBestWinRatePlayer.textContent).toBe("Bob");
    expect(dom.leaderboardStatBestWinRateMeta.textContent).toContain("60.0%");
    expect(renderers.leaderboard.render).toHaveBeenCalled();
    expect(renderers.matches.render).toHaveBeenCalled();
    expect(renderers.progress.render).toHaveBeenCalled();
    expect(sharePanels.updateSeasonSharePanelVisibility).toHaveBeenCalled();
    expect(sharePanels.updateTournamentSharePanelVisibility).toHaveBeenCalled();
    expect(sharePanels.updateSharePanelElements).toHaveBeenCalledTimes(2);
    expect(helpers.renderSeasonDraftSummary).toHaveBeenCalled();
    expect(helpers.renderTournamentDraftSummary).toHaveBeenCalled();
    expect(helpers.renderMatchDraftSummary).toHaveBeenCalled();
    expect(helpers.syncMatchFormLockState).toHaveBeenCalled();
  });

  it("locks base elo controls while editing an existing season", () => {
    const dom = createDom();
    const helpers = {
      renderSeasonDraftSummary: vi.fn(),
      renderTournamentDraftSummary: vi.fn(),
      renderMatchDraftSummary: vi.fn(),
      syncMatchFormLockState: vi.fn(),
      scheduleFormStatusHide: vi.fn(),
      getEditingSeason: () => createSeasonRecord(),
      getEditingTournament: () => createTournamentRecord(),
      hasTournamentProgress: () => false,
      isLockedSeason: () => false,
      isLockedTournament: () => false,
      canSoftDelete: () => true,
      getCurrentUserId: () => "user_1",
    };

    createDashboardSync({
      dashboardState: createDashboardState({
        screen: "createSeason",
        seasonDraftMode: "edit",
        editingSeasonId: "season_1",
      }),
      tournamentPlannerState: createTournamentPlannerState(),
      dom,
      sharePanels: {
        season: null,
        tournament: null,
        getSeasonShareTargetId: () => "",
        getTournamentShareTargetId: () => "",
        getSeasonSharePanelRenderedUrl: () => "",
        setSeasonSharePanelRenderedUrl: vi.fn(),
        getTournamentSharePanelRenderedUrl: () => "",
        setTournamentSharePanelRenderedUrl: vi.fn(),
        updateSharePanelElements: vi.fn(),
        updateSeasonSharePanelVisibility: vi.fn(),
        updateTournamentSharePanelVisibility: vi.fn(),
      },
      renderers: {
        leaderboard: { render: vi.fn() },
        matches: { render: vi.fn() },
        progress: { render: vi.fn() },
      },
      helpers,
      t: (key) => key,
    }).syncDashboardState();

    expect(dom.seasonBaseEloSelect.disabled).toBe(true);
    expect(
      dom.seasonBaseEloToggle?.querySelector<HTMLButtonElement>('button[data-value="carry_over"]')?.disabled,
    ).toBe(true);
  });

  it("disables locked season and tournament editors and hides stats in tournament mode", () => {
    const dom = createDom();
    setSelectValue(dom.formTournamentSelect, "tournament_1");
    dom.matchTypeSelect.value = "doubles";

    const helpers = {
      renderSeasonDraftSummary: vi.fn(),
      renderTournamentDraftSummary: vi.fn(),
      renderMatchDraftSummary: vi.fn(),
      syncMatchFormLockState: vi.fn(),
      scheduleFormStatusHide: vi.fn(),
      getEditingSeason: () => createSeasonRecord({ status: "completed" }),
      getEditingTournament: () => createTournamentRecord({ status: "deleted" }),
      hasTournamentProgress: () => true,
      isLockedSeason: () => true,
      isLockedTournament: () => true,
      canSoftDelete: () => false,
      getCurrentUserId: () => "user_2",
    };

    createDashboardSync({
      dashboardState: createDashboardState({
        segmentMode: "tournament",
        leaderboardStats: {
          totalMatches: 5,
          mostMatchesPlayer: {
            userId: "user_1",
            displayName: "Ada",
            avatarUrl: null,
            matchesPlayed: 5,
            wins: 4,
            losses: 1,
          },
          mostWinsPlayer: {
            userId: "user_1",
            displayName: "Ada",
            avatarUrl: null,
            matchesPlayed: 5,
            wins: 4,
            losses: 1,
          },
          bestSinglesPlayer: {
            userId: "user_1",
            displayName: "Ada",
            avatarUrl: null,
            wins: 3,
            losses: 1,
          },
          bestDoublesPair: {
            playerIds: ["user_1", "user_2"],
            displayName: "Ada & Bob",
            wins: 1,
            losses: 1,
          },
          tournamentWinnerPlayer: null,
        },
      }),
      tournamentPlannerState: createTournamentPlannerState({ tournamentId: "tournament_1" }),
      dom,
      sharePanels: {
        season: null,
        tournament: null,
        getSeasonShareTargetId: () => "",
        getTournamentShareTargetId: () => "",
        getSeasonSharePanelRenderedUrl: () => "",
        setSeasonSharePanelRenderedUrl: vi.fn(),
        getTournamentSharePanelRenderedUrl: () => "",
        setTournamentSharePanelRenderedUrl: vi.fn(),
        updateSharePanelElements: vi.fn(),
        updateSeasonSharePanelVisibility: vi.fn(),
        updateTournamentSharePanelVisibility: vi.fn(),
      },
      renderers: {
        leaderboard: { render: vi.fn() },
        matches: { render: vi.fn() },
        progress: { render: vi.fn() },
      },
      helpers,
      t: (key) => key,
    }).syncDashboardState();

    expect(dom.suggestMatchButton.hidden).toBe(true);
    expect(dom.suggestTournamentButton.disabled).toBe(true);
    expect(dom.seasonLockNotice.hidden).toBe(false);
    expect(dom.seasonLockNotice.textContent).toBe("seasonLockCompleted");
    expect(dom.tournamentLockNotice.hidden).toBe(false);
    expect(dom.tournamentLockNotice.textContent).toBe("tournamentLockDeleted");
    expect(dom.submitSeasonButton.disabled).toBe(true);
    expect(dom.saveTournamentButton.disabled).toBe(true);
    expect(dom.deleteSeasonButton.hidden).toBe(true);
    expect(dom.deleteTournamentButton.hidden).toBe(true);
    expect(dom.leaderboardStatMostActive.hidden).toBe(true);
    expect(dom.leaderboardStatMostWins.hidden).toBe(true);
    expect(dom.leaderboardStatBestSingles.hidden).toBe(true);
    expect(dom.leaderboardStatBestDoubles.hidden).toBe(true);
    expect(dom.leaderboardStatHighestPeak.hidden).toBe(true);
    expect(dom.leaderboardStatBestWinRate.hidden).toBe(true);
  });

  it("uses the season threshold for best win rate", () => {
    const dom = createDom();

    createDashboardSync({
      dashboardState: createDashboardState({
        segmentMode: "season",
        leaderboard: [
          createLeaderboardEntry({
            userId: "user_1",
            displayName: "Ada",
            highestScore: 1380,
            wins: 9,
            losses: 0,
            rank: 1,
          }),
          createLeaderboardEntry({
            userId: "user_2",
            displayName: "Bob",
            highestScore: 1410,
            wins: 8,
            losses: 2,
            rank: 2,
          }),
        ],
      }),
      tournamentPlannerState: createTournamentPlannerState(),
      dom,
      sharePanels: {
        season: createSharePanelElements(),
        tournament: createSharePanelElements(),
        getSeasonShareTargetId: () => "season_1",
        getTournamentShareTargetId: () => "tournament_1",
        getSeasonSharePanelRenderedUrl: () => "",
        setSeasonSharePanelRenderedUrl: vi.fn(),
        getTournamentSharePanelRenderedUrl: () => "",
        setTournamentSharePanelRenderedUrl: vi.fn(),
        updateSharePanelElements: vi.fn(),
        updateSeasonSharePanelVisibility: vi.fn(),
        updateTournamentSharePanelVisibility: vi.fn(),
      },
      renderers: {
        leaderboard: { render: vi.fn() },
        matches: { render: vi.fn() },
        progress: { render: vi.fn() },
      },
      helpers: {
        renderSeasonDraftSummary: vi.fn(),
        renderTournamentDraftSummary: vi.fn(),
        renderMatchDraftSummary: vi.fn(),
        syncMatchFormLockState: vi.fn(),
        scheduleFormStatusHide: vi.fn(),
        getEditingSeason: () => createSeasonRecord(),
        getEditingTournament: () => createTournamentRecord(),
        hasTournamentProgress: () => false,
        isLockedSeason: () => false,
        isLockedTournament: () => false,
        canSoftDelete: () => true,
        getCurrentUserId: () => "user_1",
      },
      t: (key) => key,
    }).syncDashboardState();

    expect(dom.leaderboardStatBestWinRate.hidden).toBe(false);
    expect(dom.leaderboardStatBestWinRatePlayer.textContent).toBe("Bob");
    expect(dom.leaderboardStatBestWinRateMeta.textContent).toContain("80.0%");
    expect(dom.leaderboardStatHighestPeak.hidden).toBe(false);
    expect(dom.leaderboardStatHighestPeakPlayer.textContent).toBe("Bob");
    expect(dom.leaderboardStatHighestPeakLabel.textContent).toBe("leaderboardHighestScoreLabel");
    expect(dom.leaderboardStatHighestPeakMeta.textContent).toContain("1,410");
  });
});
