import type { SegmentType } from "../../../api/contract";
import type { SharePanelElements } from "../../shared/types/app";

export const createTopLevelUiHandlers = (args: {
  authActions: HTMLElement;
  createMenu: HTMLElement;
  createMenuButton: HTMLButtonElement;
  closeLanguageSwitchIfOutside: (target: EventTarget | null) => void;
  clearSession: () => void;
  setIdleState: () => void;
  openFaqScreen: () => void;
  openPrivacyScreen: () => void;
  syncAuthState: () => void;
  syncDashboardState: () => void;
  loadDashboard: () => Promise<void>;
  resetScoreInputs: () => void;
  showScoreCard: () => void;
  hideScoreCard: () => void;
  populateTournamentPlannerLoadOptions: () => void;
  renderTournamentPlanner: () => void;
  resetSeasonForm: () => void;
  populateSeasonManagerLoadOptions: () => void;
  renderSeasonEditor: () => void;
  closeFaqScreen: () => void;
  closePrivacyScreen: () => void;
  applyFairMatchSuggestion: () => void;
  suggestTournamentBracket: () => void;
  dashboardState: {
    screen: "dashboard" | "createMatch" | "createTournament" | "createSeason" | "faq" | "privacy";
    seasonFormError: string;
    seasonFormMessage: string;
    tournamentFormMessage: string;
  };
  tournamentPlannerState: {
    error: string;
  };
  menuState: {
    authMenuOpen: boolean;
    createMenuOpen: boolean;
  };
}): {
  onLogout: () => void;
  onOpenFaq: () => void;
  onOpenPrivacy: () => void;
  onToggleAuthMenu: () => void;
  onToggleCreateMenu: () => void;
  onDocumentClick: (event: MouseEvent) => void;
  onRefresh: () => void;
  onOpenCreateMatch: () => void;
  onOpenCreateTournament: () => void;
  onOpenCreateSeason: () => void;
  onOpenScoreCard: () => void;
  onCloseCreateMatch: () => void;
  onCloseCreateTournament: () => void;
  onCloseCreateSeason: () => void;
  onCloseFaq: () => void;
  onClosePrivacy: () => void;
  onCloseScoreCard: () => void;
  onScoreCardOverlayClick: (event: MouseEvent) => void;
  onSuggestMatch: () => void;
  onSuggestTournament: () => void;
} => ({
  onLogout: () => {
    args.menuState.authMenuOpen = false;
    args.clearSession();
    args.setIdleState();
  },
  onOpenFaq: () => {
    args.openFaqScreen();
  },
  onOpenPrivacy: () => {
    args.openPrivacyScreen();
  },
  onToggleAuthMenu: () => {
    args.menuState.createMenuOpen = false;
    args.menuState.authMenuOpen = !args.menuState.authMenuOpen;
    args.syncAuthState();
  },
  onToggleCreateMenu: () => {
    args.menuState.authMenuOpen = false;
    args.menuState.createMenuOpen = !args.menuState.createMenuOpen;
    args.syncAuthState();
  },
  onDocumentClick: (event) => {
    const target = event.target;
    args.closeLanguageSwitchIfOutside(target);

    if (!args.menuState.authMenuOpen && !args.menuState.createMenuOpen) {
      return;
    }
    if (
      !(target instanceof Node) ||
      args.authActions.contains(target) ||
      args.createMenuButton.contains(target) ||
      args.createMenu.contains(target)
    ) {
      return;
    }

    args.menuState.authMenuOpen = false;
    args.menuState.createMenuOpen = false;
    args.syncAuthState();
  },
  onRefresh: () => {
    void args.loadDashboard();
  },
  onOpenCreateMatch: () => {
    args.menuState.createMenuOpen = false;
    args.resetScoreInputs();
    args.dashboardState.screen = "createMatch";
    args.syncAuthState();
    args.syncDashboardState();
  },
  onOpenCreateTournament: () => {
    args.menuState.createMenuOpen = false;
    args.dashboardState.screen = "createTournament";
    args.tournamentPlannerState.error = "";
    args.dashboardState.tournamentFormMessage = "";
    args.populateTournamentPlannerLoadOptions();
    args.renderTournamentPlanner();
    args.syncAuthState();
    args.syncDashboardState();
  },
  onOpenCreateSeason: () => {
    args.menuState.createMenuOpen = false;
    args.dashboardState.screen = "createSeason";
    args.dashboardState.seasonFormError = "";
    args.dashboardState.seasonFormMessage = "";
    args.resetSeasonForm();
    args.populateSeasonManagerLoadOptions();
    args.renderSeasonEditor();
    args.syncAuthState();
    args.syncDashboardState();
  },
  onOpenScoreCard: () => {
    args.menuState.createMenuOpen = false;
    args.showScoreCard();
    args.syncAuthState();
  },
  onCloseCreateMatch: () => {
    args.dashboardState.screen = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  },
  onCloseCreateTournament: () => {
    args.dashboardState.screen = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  },
  onCloseCreateSeason: () => {
    args.dashboardState.screen = "dashboard";
    args.syncAuthState();
    args.syncDashboardState();
  },
  onCloseFaq: () => {
    args.closeFaqScreen();
  },
  onClosePrivacy: () => {
    args.closePrivacyScreen();
  },
  onCloseScoreCard: () => {
    args.hideScoreCard();
  },
  onScoreCardOverlayClick: (event) => {
    if (event.target === event.currentTarget) {
      args.hideScoreCard();
    }
  },
  onSuggestMatch: () => {
    args.applyFairMatchSuggestion();
  },
  onSuggestTournament: () => {
    args.suggestTournamentBracket();
  },
});

export const createSelectionAndFormHandlers = (args: {
  dashboardState: {
    editingSeasonId: string;
    editingSeasonParticipantIds: string[];
    seasonFormError: string;
    seasonFormMessage: string;
    selectedSeasonId: string;
    selectedTournamentId: string;
    seasons: Array<{
      id: string;
      participantIds: string[];
      name: string;
      startDate: string;
      endDate: string | null;
      baseEloMode: string;
      isActive: boolean;
      isPublic: boolean;
    }>;
  };
  tournamentPlannerState: {
    tournamentId: string;
    name: string;
  };
  loadSeasonSelect: HTMLSelectElement;
  loadTournamentSelect: HTMLSelectElement;
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonIsActiveInput: HTMLInputElement;
  seasonIsPublicInput: HTMLInputElement;
  seasonSelect: HTMLSelectElement;
  tournamentSelect: HTMLSelectElement;
  tournamentNameInput: HTMLInputElement;
  renderTournamentDraftSummary: () => void;
  syncLoadControlsVisibility: () => void;
  syncDashboardState: () => void;
  renderSeasonEditor: () => void;
  setSeasonSharePanelTargetId: (seasonId: string) => void;
  refreshSegmentShareLink: (
    segmentType: SegmentType,
    targetId: string,
    elements: SharePanelElements | null,
  ) => Promise<void>;
  seasonSharePanelElements: SharePanelElements | null;
  saveTournament: () => Promise<void>;
  deleteTournament: () => Promise<void>;
  deleteSeason: () => Promise<void>;
  applySegmentMode: (mode: "global" | "season" | "tournament") => Promise<void>;
  loadMoreMatches: () => Promise<void>;
  populateMatchFormOptions: () => void;
  submitMatch: () => Promise<void>;
  submitSeason: () => Promise<void>;
  renderSeasonDraftSummary: () => void;
  loadTournamentBracket: () => Promise<void>;
  renderMatchDraftSummary: () => void;
}): {
  onLoadTournament: () => void;
  onTournamentSelectChange: () => void;
  onSeasonSelectChange: () => void;
  onLoadSeason: () => void;
  onTournamentNameInput: () => void;
  onSaveTournament: () => void;
  onDeleteTournament: () => void;
  onDeleteSeason: () => void;
  onApplyGlobalMode: () => void;
  onApplySeasonMode: () => void;
  onApplyTournamentMode: () => void;
  onLeaderboardSeasonChange: () => void;
  onLeaderboardTournamentChange: () => void;
  onLoadMoreMatches: () => void;
  onMatchInputChange: () => void;
  onMatchSubmit: (event: SubmitEvent) => void;
  onSeasonSubmit: (event: SubmitEvent) => void;
  onSeasonDraftChange: () => void;
  onTournamentDraftChange: () => void;
  onScoreInputChange: () => void;
} => ({
  onLoadTournament: () => {
    void args.loadTournamentBracket();
  },
  onTournamentSelectChange: () => {
    args.tournamentPlannerState.tournamentId = args.loadTournamentSelect.value;
    args.renderTournamentDraftSummary();
    args.syncLoadControlsVisibility();
    args.syncDashboardState();
  },
  onSeasonSelectChange: () => {
    args.dashboardState.editingSeasonId = args.loadSeasonSelect.value;
    args.syncLoadControlsVisibility();
    args.syncDashboardState();
  },
  onLoadSeason: () => {
    const season = args.dashboardState.seasons.find((entry) => entry.id === args.loadSeasonSelect.value);
    if (!season) {
      args.dashboardState.seasonFormError = "Select a saved season first.";
      args.dashboardState.seasonFormMessage = "";
      args.syncDashboardState();
      return;
    }

    args.dashboardState.editingSeasonId = season.id;
    args.dashboardState.editingSeasonParticipantIds = [...season.participantIds];
    args.seasonNameInput.value = season.name;
    args.seasonStartDateInput.value = season.startDate;
    args.seasonEndDateInput.value = season.endDate || "";
    args.seasonBaseEloSelect.value = season.baseEloMode;
    args.seasonIsActiveInput.checked = season.isActive;
    args.seasonIsPublicInput.checked = season.isPublic;
    args.dashboardState.seasonFormError = "";
    args.dashboardState.seasonFormMessage = "";
    args.renderSeasonEditor();
    args.syncDashboardState();
    args.setSeasonSharePanelTargetId(season.id);
    void args.refreshSegmentShareLink("season", season.id, args.seasonSharePanelElements);
  },
  onTournamentNameInput: () => {
    args.tournamentPlannerState.name = args.tournamentNameInput.value;
    args.renderTournamentDraftSummary();
  },
  onSaveTournament: () => {
    void args.saveTournament();
  },
  onDeleteTournament: () => {
    void args.deleteTournament();
  },
  onDeleteSeason: () => {
    void args.deleteSeason();
  },
  onApplyGlobalMode: () => {
    void args.applySegmentMode("global");
  },
  onApplySeasonMode: () => {
    void args.applySegmentMode("season");
  },
  onApplyTournamentMode: () => {
    void args.applySegmentMode("tournament");
  },
  onLeaderboardSeasonChange: () => {
    args.dashboardState.selectedSeasonId = args.seasonSelect.value;
    void args.applySegmentMode("season");
  },
  onLeaderboardTournamentChange: () => {
    args.dashboardState.selectedTournamentId = args.tournamentSelect.value;
    void args.applySegmentMode("tournament");
  },
  onLoadMoreMatches: () => {
    void args.loadMoreMatches();
  },
  onMatchInputChange: () => {
    args.populateMatchFormOptions();
    args.syncDashboardState();
  },
  onMatchSubmit: (event) => {
    event.preventDefault();
    void args.submitMatch();
  },
  onSeasonSubmit: (event) => {
    event.preventDefault();
    void args.submitSeason();
  },
  onSeasonDraftChange: () => {
    args.renderSeasonDraftSummary();
    args.syncDashboardState();
  },
  onTournamentDraftChange: () => {
    args.renderTournamentDraftSummary();
    args.syncDashboardState();
  },
  onScoreInputChange: () => {
    args.renderMatchDraftSummary();
  },
});

export const createSharePanelHandlers = (args: {
  segmentType: SegmentType;
  getTargetId: () => string;
  buildSegmentShareKey: (segmentType: SegmentType, targetId: string) => string;
  shareCache: Record<string, { url: string }>;
  showShareNotice: (message: string) => void;
  copyTextToClipboard: (value: string) => Promise<void>;
  showCopyFeedback: (segment: "season" | "tournament", copyFeedback: HTMLElement, message: string) => void;
  t: (key: "shareNoSegment" | "shareCopied" | "shareCopyFailure") => string;
  elements: SharePanelElements;
  refreshSegmentShareLink: (
    segmentType: SegmentType,
    targetId: string,
    elements: SharePanelElements,
  ) => Promise<void>;
}): {
  onCopy: () => Promise<void>;
  onCreate: () => void;
} => ({
  onCopy: async () => {
    const targetId = args.getTargetId();
    const key = args.buildSegmentShareKey(args.segmentType, targetId);
    const shareInfo = targetId ? args.shareCache[key] : null;
    if (!shareInfo?.url) {
      args.showShareNotice(args.t("shareNoSegment"));
      return;
    }
    try {
      await args.copyTextToClipboard(shareInfo.url);
      args.showCopyFeedback(
        args.segmentType === "season" ? "season" : "tournament",
        args.elements.copyFeedback,
        args.t("shareCopied"),
      );
    } catch {
      args.showShareNotice(args.t("shareCopyFailure"));
    }
  },
  onCreate: () => {
    const targetId = args.getTargetId();
    if (!targetId) {
      args.showShareNotice(args.t("shareNoSegment"));
      return;
    }
    void args.refreshSegmentShareLink(args.segmentType, targetId, args.elements);
  },
});
