import {
  bindSelectionAndFormHandlers,
  bindSharePanelHandlers,
  bindTopLevelUiHandlers,
  bindWindowLifecycleHandlers,
} from "../../../src/ui/features/app/eventBindings";

const createButton = () => document.createElement("button");

describe("event bindings", () => {
  it("binds top-level handlers including keyboard profile access and score-card overlay clicks", () => {
    const onOpenProfile = vi.fn();
    const onScoreCardOverlayClick = vi.fn();
    const onDocumentClick = vi.fn();

    const authAvatarButton = document.createElement("button");

    const scoreCardOverlay = document.createElement("div");
    const overlayTarget = document.createElement("div");
    scoreCardOverlay.append(overlayTarget);

    bindTopLevelUiHandlers({
      logoutButton: createButton(),
      footerFeaturesButton: createButton(),
      faqMenuButton: createButton(),
      footerFaqButton: createButton(),
      footerPrivacyButton: createButton(),
      authAvatarButton,
      authMenuButton: createButton(),
      createMenuButton: createButton(),
      refreshButton: createButton(),
      openCreateMatchButton: createButton(),
      openCreateTournamentButton: createButton(),
      openCreateSeasonButton: createButton(),
      openScoreCardButton: createButton(),
      closeCreateMatchButton: createButton(),
      closeCreateTournamentButton: createButton(),
      closeCreateSeasonButton: createButton(),
      closeProfileButton: createButton(),
      featuresBackButton: createButton(),
      faqBackButton: createButton(),
      privacyBackButton: createButton(),
      closeScoreCardButton: createButton(),
      scoreCardOverlay,
      suggestMatchButton: createButton(),
      suggestTournamentButton: createButton(),
      onLogout: vi.fn(),
      onOpenFeatures: vi.fn(),
      onOpenFaq: vi.fn(),
      onOpenPrivacy: vi.fn(),
      onOpenProfile,
      onToggleAuthMenu: vi.fn(),
      onToggleCreateMenu: vi.fn(),
      onDocumentClick,
      onRefresh: vi.fn(),
      onOpenCreateMatch: vi.fn(),
      onOpenCreateTournament: vi.fn(),
      onOpenCreateSeason: vi.fn(),
      onOpenScoreCard: vi.fn(),
      onCloseCreateMatch: vi.fn(),
      onCloseCreateTournament: vi.fn(),
      onCloseCreateSeason: vi.fn(),
      onCloseProfile: vi.fn(),
      onCloseFeatures: vi.fn(),
      onCloseFaq: vi.fn(),
      onClosePrivacy: vi.fn(),
      onCloseScoreCard: vi.fn(),
      onScoreCardOverlayClick,
      onSuggestMatch: vi.fn(),
      onSuggestTournament: vi.fn(),
    });

    authAvatarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onDocumentClick).toHaveBeenCalled();

    overlayTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onScoreCardOverlayClick).toHaveBeenCalledTimes(1);
  });

  it("binds selection, form, and score handlers to their delegates", () => {
    const loadTournamentSelect = document.createElement("select");
    const loadSeasonSelect = document.createElement("select");
    const resetTournamentDraftButton = createButton();
    const resetSeasonDraftButton = createButton();
    const tournamentNameInput = document.createElement("input");
    const saveTournamentButton = createButton();
    const deleteTournamentButton = createButton();
    const deleteSeasonButton = createButton();
    const globalButton = createButton();
    const seasonButton = createButton();
    const tournamentButton = createButton();
    const seasonSelect = document.createElement("select");
    const tournamentSelect = document.createElement("select");
    const loadMoreButton = createButton();
    const matchForm = document.createElement("form");
    const seasonForm = document.createElement("form");
    const matchInput = document.createElement("select");
    const seasonDraftInput = document.createElement("input");
    const tournamentDraftInput = document.createElement("input");
    const scoreA = document.createElement("input");
    const scoreB = document.createElement("input");

    const onMatchSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const onSeasonSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    const handlers = {
      onTournamentSelectChange: vi.fn(),
      onSeasonSelectChange: vi.fn(),
      onResetTournamentDraft: vi.fn(),
      onResetSeasonDraft: vi.fn(),
      onTournamentNameInput: vi.fn(),
      onSaveTournament: vi.fn(),
      onDeleteTournament: vi.fn(),
      onDeleteSeason: vi.fn(),
      onApplyGlobalMode: vi.fn(),
      onApplySeasonMode: vi.fn(),
      onApplyTournamentMode: vi.fn(),
      onLeaderboardSeasonChange: vi.fn(),
      onLeaderboardTournamentChange: vi.fn(),
      onLoadMoreMatches: vi.fn(),
      onMatchInputChange: vi.fn(),
      onMatchSubmit,
      onSeasonSubmit,
      onSeasonDraftChange: vi.fn(),
      onTournamentDraftChange: vi.fn(),
      onScoreInputChange: vi.fn(),
    };

    bindSelectionAndFormHandlers({
      loadTournamentSelect,
      loadSeasonSelect,
      resetTournamentDraftButton,
      resetSeasonDraftButton,
      tournamentNameInput,
      saveTournamentButton,
      deleteTournamentButton,
      deleteSeasonButton,
      globalButton,
      seasonButton,
      tournamentButton,
      seasonSelect,
      tournamentSelect,
      loadMoreButton,
      matchForm,
      seasonForm,
      matchInputs: [matchInput],
      seasonDraftInputs: [seasonDraftInput],
      tournamentDraftInputs: [tournamentDraftInput],
      scoreInputs: [{ teamA: scoreA, teamB: scoreB }],
      ...handlers,
    });

    loadTournamentSelect.dispatchEvent(new Event("change", { bubbles: true }));
    loadSeasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    resetTournamentDraftButton.click();
    resetSeasonDraftButton.click();
    tournamentNameInput.dispatchEvent(new Event("input", { bubbles: true }));
    saveTournamentButton.click();
    deleteTournamentButton.click();
    deleteSeasonButton.click();
    globalButton.click();
    seasonButton.click();
    tournamentButton.click();
    seasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    tournamentSelect.dispatchEvent(new Event("change", { bubbles: true }));
    loadMoreButton.click();
    matchInput.dispatchEvent(new Event("change", { bubbles: true }));
    seasonDraftInput.dispatchEvent(new Event("change", { bubbles: true }));
    tournamentDraftInput.dispatchEvent(new Event("change", { bubbles: true }));
    scoreA.dispatchEvent(new Event("input", { bubbles: true }));
    scoreB.dispatchEvent(new Event("input", { bubbles: true }));
    matchForm.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    seasonForm.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    expect(handlers.onTournamentSelectChange).toHaveBeenCalled();
    expect(handlers.onSeasonSelectChange).toHaveBeenCalled();
    expect(handlers.onResetTournamentDraft).toHaveBeenCalled();
    expect(handlers.onResetSeasonDraft).toHaveBeenCalled();
    expect(handlers.onTournamentNameInput).toHaveBeenCalled();
    expect(handlers.onSaveTournament).toHaveBeenCalled();
    expect(handlers.onDeleteTournament).toHaveBeenCalled();
    expect(handlers.onDeleteSeason).toHaveBeenCalled();
    expect(handlers.onApplyGlobalMode).toHaveBeenCalled();
    expect(handlers.onApplySeasonMode).toHaveBeenCalled();
    expect(handlers.onApplyTournamentMode).toHaveBeenCalled();
    expect(handlers.onLeaderboardSeasonChange).toHaveBeenCalled();
    expect(handlers.onLeaderboardTournamentChange).toHaveBeenCalled();
    expect(handlers.onLoadMoreMatches).toHaveBeenCalled();
    expect(handlers.onMatchInputChange).toHaveBeenCalled();
    expect(handlers.onSeasonDraftChange).toHaveBeenCalled();
    expect(handlers.onTournamentDraftChange).toHaveBeenCalled();
    expect(handlers.onScoreInputChange).toHaveBeenCalledTimes(2);
    expect(onMatchSubmit).toHaveBeenCalled();
    expect(onSeasonSubmit).toHaveBeenCalled();
  });

  it("binds share panel and unload handlers", () => {
    const copyButton = createButton();
    const createButtonEl = createButton();
    const copyFeedback = document.createElement("span");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const onHashChange = vi.fn();

    bindSharePanelHandlers({
      segmentType: "season",
      elements: {
        section: document.createElement("section"),
        createButton: createButtonEl,
        copyButton,
        status: document.createElement("p"),
        qrCanvas: document.createElement("canvas"),
        qrWrapper: document.createElement("div"),
        copyFeedback,
        animationTimer: null,
      },
      onCopy: vi.fn(),
      onCreate: vi.fn(),
    });
    bindWindowLifecycleHandlers({ sessionId: 42, onHashChange });

    copyButton.click();
    createButtonEl.click();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new Event("beforeunload"));

    expect(onHashChange).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledWith(42);
    clearIntervalSpy.mockRestore();
  });
});
