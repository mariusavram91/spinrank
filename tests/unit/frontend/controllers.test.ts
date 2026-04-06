import { createSelectionAndFormHandlers, createSharePanelHandlers, createTopLevelUiHandlers } from "../../../src/ui/features/app/controllers";
import type { SharePanelElements } from "../../../src/ui/shared/types/app";

const createSharePanel = (): SharePanelElements =>
  ({
    copyFeedback: document.createElement("span"),
  }) as SharePanelElements;

describe("app controllers", () => {
  it("handles top-level menu and screen transitions", async () => {
    const menuState = { authMenuOpen: false, createMenuOpen: true };
    const args = {
      authActions: document.createElement("div"),
      createMenu: document.createElement("div"),
      createMenuButton: document.createElement("button"),
      closeLanguageSwitchIfOutside: vi.fn(),
      clearSession: vi.fn(),
      setIdleState: vi.fn(),
      openFaqScreen: vi.fn(),
      openPrivacyScreen: vi.fn(),
      syncAuthState: vi.fn(),
      syncDashboardState: vi.fn(),
      loadDashboard: vi.fn().mockResolvedValue(undefined),
      openProfileScreen: vi.fn().mockResolvedValue(undefined),
      resetScoreInputs: vi.fn(),
      showScoreCard: vi.fn(),
      hideScoreCard: vi.fn(),
      populateTournamentPlannerLoadOptions: vi.fn(),
      renderTournamentPlanner: vi.fn(),
      resetTournamentForm: vi.fn(),
      resetSeasonForm: vi.fn(),
      populateSeasonManagerLoadOptions: vi.fn(),
      renderSeasonEditor: vi.fn(),
      closeFaqScreen: vi.fn(),
      closePrivacyScreen: vi.fn(),
      applyFairMatchSuggestion: vi.fn().mockResolvedValue(undefined),
      suggestTournamentBracket: vi.fn(),
      dashboardState: {
        screen: "dashboard" as const,
        seasonFormError: "bad",
        seasonFormMessage: "saved",
        tournamentFormMessage: "created",
      },
      tournamentPlannerState: {
        error: "boom",
      },
      menuState,
    };

    const handlers = createTopLevelUiHandlers(args);
    handlers.onToggleAuthMenu();
    expect(menuState.authMenuOpen).toBe(true);
    expect(menuState.createMenuOpen).toBe(false);

    handlers.onOpenCreateTournament();
    expect(args.dashboardState.screen).toBe("createTournament");
    expect(args.resetTournamentForm).toHaveBeenCalled();
    expect(args.tournamentPlannerState.error).toBe("");
    expect(args.dashboardState.tournamentFormMessage).toBe("");

    handlers.onOpenCreateSeason();
    expect(args.dashboardState.screen).toBe("createSeason");
    expect(args.dashboardState.seasonFormError).toBe("");
    expect(args.dashboardState.seasonFormMessage).toBe("");

    handlers.onOpenScoreCard();
    expect(args.showScoreCard).toHaveBeenCalled();

    const outside = document.createElement("div");
    handlers.onDocumentClick(new MouseEvent("click", { bubbles: true }));
    outside.dispatchEvent(new MouseEvent("click"));

    const event = {
      target: outside,
      currentTarget: outside,
    } as unknown as MouseEvent;
    menuState.authMenuOpen = true;
    menuState.createMenuOpen = true;
    handlers.onDocumentClick(event);
    expect(menuState.authMenuOpen).toBe(false);
    expect(menuState.createMenuOpen).toBe(false);

    handlers.onLogout();
    expect(args.clearSession).toHaveBeenCalled();
    expect(args.setIdleState).toHaveBeenCalled();
  });

  it("routes remaining top-level actions through their delegates", async () => {
    const hideScoreCard = vi.fn();
    const args = {
      authActions: document.createElement("div"),
      createMenu: document.createElement("div"),
      createMenuButton: document.createElement("button"),
      closeLanguageSwitchIfOutside: vi.fn(),
      clearSession: vi.fn(),
      setIdleState: vi.fn(),
      openFaqScreen: vi.fn(),
      openPrivacyScreen: vi.fn(),
      syncAuthState: vi.fn(),
      syncDashboardState: vi.fn(),
      loadDashboard: vi.fn().mockResolvedValue(undefined),
      openProfileScreen: vi.fn().mockResolvedValue(undefined),
      resetScoreInputs: vi.fn(),
      showScoreCard: vi.fn(),
      hideScoreCard,
      populateTournamentPlannerLoadOptions: vi.fn(),
      renderTournamentPlanner: vi.fn(),
      resetTournamentForm: vi.fn(),
      resetSeasonForm: vi.fn(),
      populateSeasonManagerLoadOptions: vi.fn(),
      renderSeasonEditor: vi.fn(),
      closeFaqScreen: vi.fn(),
      closePrivacyScreen: vi.fn(),
      applyFairMatchSuggestion: vi.fn().mockResolvedValue(undefined),
      suggestTournamentBracket: vi.fn(),
      dashboardState: {
        screen: "profile" as const,
        seasonFormError: "",
        seasonFormMessage: "",
        tournamentFormMessage: "",
      },
      tournamentPlannerState: { error: "" },
      menuState: { authMenuOpen: true, createMenuOpen: true },
    };

    const handlers = createTopLevelUiHandlers(args);
    handlers.onOpenFaq();
    handlers.onOpenPrivacy();
    handlers.onOpenProfile();
    handlers.onRefresh();
    handlers.onCloseCreateMatch();
    handlers.onCloseCreateTournament();
    handlers.onCloseCreateSeason();
    handlers.onCloseProfile();
    handlers.onCloseFaq();
    handlers.onClosePrivacy();
    handlers.onSuggestMatch();
    handlers.onSuggestTournament();
    handlers.onCloseScoreCard();
    handlers.onScoreCardOverlayClick({
      target: args.authActions,
      currentTarget: args.createMenu,
    } as unknown as MouseEvent);
    handlers.onScoreCardOverlayClick({
      target: args.createMenu,
      currentTarget: args.createMenu,
    } as unknown as MouseEvent);

    expect(args.openFaqScreen).toHaveBeenCalled();
    expect(args.openPrivacyScreen).toHaveBeenCalled();
    expect(args.openProfileScreen).not.toHaveBeenCalled();
    expect(args.loadDashboard).toHaveBeenCalled();
    expect(args.closeFaqScreen).toHaveBeenCalled();
    expect(args.closePrivacyScreen).toHaveBeenCalled();
    expect(args.applyFairMatchSuggestion).toHaveBeenCalled();
    expect(args.suggestTournamentBracket).toHaveBeenCalled();
    expect(args.dashboardState.screen).toBe("dashboard");
    expect(hideScoreCard).toHaveBeenCalledTimes(2);
  });

  it("does not reopen the profile when the profile screen is already active", () => {
    const args = {
      authActions: document.createElement("div"),
      createMenu: document.createElement("div"),
      createMenuButton: document.createElement("button"),
      closeLanguageSwitchIfOutside: vi.fn(),
      clearSession: vi.fn(),
      setIdleState: vi.fn(),
      openFaqScreen: vi.fn(),
      openPrivacyScreen: vi.fn(),
      syncAuthState: vi.fn(),
      syncDashboardState: vi.fn(),
      loadDashboard: vi.fn().mockResolvedValue(undefined),
      openProfileScreen: vi.fn().mockResolvedValue(undefined),
      resetScoreInputs: vi.fn(),
      showScoreCard: vi.fn(),
      hideScoreCard: vi.fn(),
      populateTournamentPlannerLoadOptions: vi.fn(),
      renderTournamentPlanner: vi.fn(),
      resetTournamentForm: vi.fn(),
      resetSeasonForm: vi.fn(),
      populateSeasonManagerLoadOptions: vi.fn(),
      renderSeasonEditor: vi.fn(),
      closeFaqScreen: vi.fn(),
      closePrivacyScreen: vi.fn(),
      applyFairMatchSuggestion: vi.fn().mockResolvedValue(undefined),
      suggestTournamentBracket: vi.fn(),
      dashboardState: {
        screen: "profile" as const,
        seasonFormError: "",
        seasonFormMessage: "",
        tournamentFormMessage: "",
      },
      tournamentPlannerState: { error: "" },
      menuState: { authMenuOpen: true, createMenuOpen: false },
    };

    const handlers = createTopLevelUiHandlers(args);
    handlers.onOpenProfile();

    expect(args.openProfileScreen).not.toHaveBeenCalled();
    expect(args.syncAuthState).toHaveBeenCalled();
  });

  it("handles selection and draft form workflows", async () => {
    const loadSeasonSelect = document.createElement("select");
    const seasonOption = document.createElement("option");
    seasonOption.value = "season_1";
    loadSeasonSelect.append(seasonOption);
    loadSeasonSelect.value = "season_1";
    const seasonNameInput = document.createElement("input");
    const seasonStartDateInput = document.createElement("input");
    const seasonEndDateInput = document.createElement("input");
    const seasonBaseEloSelect = document.createElement("select");
    seasonBaseEloSelect.append(new Option("carry_over", "carry_over"));
    const seasonIsActiveInput = document.createElement("input");
    const seasonIsPublicInput = document.createElement("input");
    const seasonSelect = document.createElement("select");
    const tournamentSelect = document.createElement("select");
    const loadTournamentSelect = document.createElement("select");
    const tournamentOption = document.createElement("option");
    tournamentOption.value = "tournament_1";
    loadTournamentSelect.append(tournamentOption);
    const tournamentNameInput = document.createElement("input");

    const handlers = createSelectionAndFormHandlers({
      dashboardState: {
        editingSeasonId: "",
        editingSeasonParticipantIds: [],
        seasonDraftMode: "create",
        seasonFormError: "",
        seasonFormMessage: "",
        seasonParticipantQuery: "",
        seasonParticipantResults: [],
        seasonParticipantSearchError: "",
        selectedSeasonId: "",
        selectedTournamentId: "",
        seasons: [
          {
            id: "season_1",
            participantIds: ["user_1"],
            name: "Spring",
            startDate: "2026-04-01",
            endDate: "2026-04-30",
            baseEloMode: "carry_over",
            isActive: true,
            isPublic: false,
          },
        ],
      },
      tournamentPlannerState: {
        tournamentId: "",
        name: "",
        error: "",
      },
      loadSeasonSelect,
      loadTournamentSelect,
      seasonNameInput,
      seasonStartDateInput,
      seasonEndDateInput,
      seasonBaseEloSelect,
      seasonIsActiveInput,
      seasonIsPublicInput,
      seasonSelect,
      tournamentSelect,
      tournamentNameInput,
      renderTournamentDraftSummary: vi.fn(),
      syncLoadControlsVisibility: vi.fn(),
      syncDashboardState: vi.fn(),
      renderSeasonEditor: vi.fn(),
      renderTournamentPlanner: vi.fn(),
      resetSeasonForm: vi.fn(),
      resetTournamentForm: vi.fn(),
      setSeasonSharePanelTargetId: vi.fn(),
      refreshSegmentShareLink: vi.fn().mockResolvedValue(undefined),
      ensureProfileSegmentSummary: vi.fn().mockResolvedValue(undefined),
      seasonSharePanelElements: createSharePanel(),
      saveTournament: vi.fn().mockResolvedValue(undefined),
      deleteTournament: vi.fn().mockResolvedValue(undefined),
      deleteSeason: vi.fn().mockResolvedValue(undefined),
      applySegmentMode: vi.fn().mockResolvedValue(undefined),
      loadMoreMatches: vi.fn().mockResolvedValue(undefined),
      populateMatchFormOptions: vi.fn(),
      submitMatch: vi.fn().mockResolvedValue(undefined),
      submitSeason: vi.fn().mockResolvedValue(undefined),
      renderSeasonDraftSummary: vi.fn(),
      loadTournamentBracket: vi.fn().mockResolvedValue(undefined),
      renderMatchDraftSummary: vi.fn(),
    });

    handlers.onSeasonSelectChange();
    expect(seasonNameInput.value).toBe("Spring");
    expect(seasonStartDateInput.value).toBe("2026-04-01");
    expect(seasonEndDateInput.value).toBe("2026-04-30");

    loadTournamentSelect.value = "tournament_1";
    handlers.onTournamentSelectChange();
    expect(handlers).toBeDefined();

    handlers.onTournamentNameInput();
    handlers.onLoadTournament();
    handlers.onLoadSeason();
    handlers.onResetTournamentDraft();
    handlers.onResetSeasonDraft();
    handlers.onSaveTournament();
    handlers.onDeleteTournament();
    handlers.onDeleteSeason();
    handlers.onApplySeasonMode();
    handlers.onApplyTournamentMode();
    handlers.onApplyGlobalMode();
    handlers.onLeaderboardSeasonChange();
    handlers.onLeaderboardTournamentChange();
    handlers.onMatchInputChange();
    handlers.onMatchSubmit({ preventDefault: vi.fn() } as unknown as SubmitEvent);
    handlers.onSeasonSubmit({ preventDefault: vi.fn() } as unknown as SubmitEvent);
    handlers.onSeasonDraftChange();
    handlers.onTournamentDraftChange();
    handlers.onScoreInputChange();
    handlers.onLoadMoreMatches();
  });

  it("handles empty selections and missing share targets", async () => {
    const loadSeasonSelect = document.createElement("select");
    const loadTournamentSelect = document.createElement("select");
    const syncDashboardState = vi.fn();
    const resetSeasonForm = vi.fn();
    const resetTournamentForm = vi.fn();
    const renderSeasonEditor = vi.fn();
    const renderSeasonDraftSummary = vi.fn();
    const renderTournamentDraftSummary = vi.fn();

    const handlers = createSelectionAndFormHandlers({
      dashboardState: {
        editingSeasonId: "season_1",
        editingSeasonParticipantIds: [],
        seasonDraftMode: "edit",
        seasonFormError: "",
        seasonFormMessage: "",
        seasonParticipantQuery: "",
        seasonParticipantResults: [],
        seasonParticipantSearchError: "",
        selectedSeasonId: "",
        selectedTournamentId: "",
        seasons: [],
      },
      tournamentPlannerState: {
        tournamentId: "tournament_1",
        name: "",
        error: "",
      },
      loadSeasonSelect,
      loadTournamentSelect,
      seasonNameInput: document.createElement("input"),
      seasonStartDateInput: document.createElement("input"),
      seasonEndDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsActiveInput: document.createElement("input"),
      seasonIsPublicInput: document.createElement("input"),
      seasonSelect: document.createElement("select"),
      tournamentSelect: document.createElement("select"),
      tournamentNameInput: document.createElement("input"),
      renderTournamentDraftSummary,
      syncLoadControlsVisibility: vi.fn(),
      syncDashboardState,
      renderSeasonEditor,
      renderTournamentPlanner: vi.fn(),
      resetSeasonForm,
      resetTournamentForm,
      setSeasonSharePanelTargetId: vi.fn(),
      refreshSegmentShareLink: vi.fn().mockResolvedValue(undefined),
      ensureProfileSegmentSummary: vi.fn().mockResolvedValue(undefined),
      seasonSharePanelElements: createSharePanel(),
      saveTournament: vi.fn().mockResolvedValue(undefined),
      deleteTournament: vi.fn().mockResolvedValue(undefined),
      deleteSeason: vi.fn().mockResolvedValue(undefined),
      applySegmentMode: vi.fn().mockResolvedValue(undefined),
      loadMoreMatches: vi.fn().mockResolvedValue(undefined),
      populateMatchFormOptions: vi.fn(),
      submitMatch: vi.fn().mockResolvedValue(undefined),
      submitSeason: vi.fn().mockResolvedValue(undefined),
      renderSeasonDraftSummary,
      loadTournamentBracket: vi.fn().mockResolvedValue(undefined),
      renderMatchDraftSummary: vi.fn(),
    });

    handlers.onSeasonSelectChange();
    handlers.onTournamentSelectChange();

    expect(resetSeasonForm).toHaveBeenCalled();
    expect(renderSeasonEditor).toHaveBeenCalled();
    expect(renderSeasonDraftSummary).toHaveBeenCalled();
    expect(resetTournamentForm).toHaveBeenCalled();
    expect(renderTournamentDraftSummary).toHaveBeenCalled();
    expect(syncDashboardState).toHaveBeenCalled();

    const emptyShareHandlers = createSharePanelHandlers({
      segmentType: "tournament",
      getTargetId: () => "",
      buildSegmentShareKey: (segmentType, targetId) => `${segmentType}:${targetId}`,
      shareCache: {},
      showShareNotice: vi.fn(),
      copyTextToClipboard: vi.fn(),
      showCopyFeedback: vi.fn(),
      t: (key) =>
        ({
          shareNoSegment: "No segment",
          shareCopied: "Copied",
          shareCopyFailure: "Copy failed",
        })[key],
      elements: createSharePanel(),
      refreshSegmentShareLink: vi.fn().mockResolvedValue(undefined),
    });

    await emptyShareHandlers.onCopy();
    emptyShareHandlers.onCreate();
  });

  it("copies and refreshes share links through the share panel handlers", async () => {
    const showShareNotice = vi.fn();
    const copyTextToClipboard = vi.fn().mockResolvedValue(undefined);
    const showCopyFeedback = vi.fn();
    const refreshSegmentShareLink = vi.fn().mockResolvedValue(undefined);
    const elements = createSharePanel();

    const handlers = createSharePanelHandlers({
      segmentType: "season",
      getTargetId: () => "season_1",
      buildSegmentShareKey: (segmentType, targetId) => `${segmentType}:${targetId}`,
      shareCache: {
        "season:season_1": { url: "https://example.test/share/season_1" },
      },
      showShareNotice,
      copyTextToClipboard,
      showCopyFeedback,
      t: (key) =>
        ({
          shareNoSegment: "No segment",
          shareCopied: "Copied",
          shareCopyFailure: "Copy failed",
        })[key],
      elements,
      refreshSegmentShareLink,
    });

    await handlers.onCopy();
    expect(copyTextToClipboard).toHaveBeenCalledWith("https://example.test/share/season_1");
    expect(showCopyFeedback).toHaveBeenCalled();

    handlers.onCreate();
    expect(refreshSegmentShareLink).toHaveBeenCalledWith("season", "season_1", elements);
  });

  it("shows a notice when copying a share link fails", async () => {
    const showShareNotice = vi.fn();
    const handlers = createSharePanelHandlers({
      segmentType: "season",
      getTargetId: () => "season_1",
      buildSegmentShareKey: (segmentType, targetId) => `${segmentType}:${targetId}`,
      shareCache: {
        "season:season_1": { url: "https://example.test/share/season_1" },
      },
      showShareNotice,
      copyTextToClipboard: vi.fn().mockRejectedValue(new Error("copy failed")),
      showCopyFeedback: vi.fn(),
      t: (key) =>
        ({
          shareNoSegment: "No segment",
          shareCopied: "Copied",
          shareCopyFailure: "Copy failed",
        })[key],
      elements: createSharePanel(),
      refreshSegmentShareLink: vi.fn().mockResolvedValue(undefined),
    });

    await handlers.onCopy();
    expect(showShareNotice).toHaveBeenCalledWith("Copy failed");
  });
});
