import { createDashboardSync } from "../../../src/ui/features/dashboard/sync";
import type { DashboardState, TournamentPlannerState } from "../../../src/ui/shared/types/app";

const makeButton = () => document.createElement("button");
const makeInput = () => document.createElement("input");
const makeSelect = () => document.createElement("select");
const makeDiv = () => document.createElement("div");

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
  matchFilterButtons: new Map([
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
  leaderboardStatMostWins: makeDiv(),
  leaderboardStatMostWinsPlayer: makeDiv(),
  leaderboardStatMostWinsMeta: makeDiv(),
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
    seasons: [{ id: "season_1", status: "active" }],
    tournaments: [{ id: "tournament_1", status: "active" }],
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
      { userId: "user_1", displayName: "Ada", streak: 4, wins: 7 },
      { userId: "user_2", displayName: "Bob", streak: 2, wins: 3 },
    ],
    leaderboardStats: {
      totalMatches: 12,
      mostMatchesPlayer: { displayName: "Ada", matchesPlayed: 8 },
      mostWinsPlayer: { displayName: "Ada", wins: 7 },
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
      season: { section: document.createElement("section") },
      tournament: { section: document.createElement("section") },
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
      getEditingSeason: () => ({ createdByUserId: "user_1", status: "active" }),
      getEditingTournament: () => ({ createdByUserId: "user_1", status: "active" }),
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
    expect(dom.leaderboardStatsGroup.hidden).toBe(false);
    expect(dom.leaderboardMatchesSummaryValue.textContent).toBe("12");
    expect(dom.leaderboardStatMostActive.hidden).toBe(false);
    expect(dom.leaderboardStatMostWins.hidden).toBe(false);
    expect(dom.leaderboardStatLongestStreak.hidden).toBe(false);
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
      getEditingSeason: () => ({ createdByUserId: "user_1", status: "completed" }),
      getEditingTournament: () => ({ createdByUserId: "user_1", status: "deleted" }),
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
          mostMatchesPlayer: { displayName: "Ada", matchesPlayed: 5 },
          mostWinsPlayer: { displayName: "Ada", wins: 4 },
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
  });
});
