import type {
  ApiAction,
  ApiActionMap,
  AppSession,
  BootstrapUserData,
  CreateMatchPayload,
  CreateSeasonPayload,
  GetUserProgressData,
  LeaderboardEntry,
  MatchFeedFilter,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
  SegmentLeaderboardStats,
} from "../api/contract";
import { postAction } from "../api/client";
import { isProviderConfigured, renderGoogleButton } from "../auth/providers";
import { clearSession, isExpiredSession, loadSession, saveSession } from "../auth/session";
import { hasBackendConfig } from "../config/env";
import {
  createSelectionAndFormHandlers,
  createSharePanelHandlers,
  createTopLevelUiHandlers,
} from "./features/app/controllers";
import {
  createDashboardSelectors,
  createFormStatusOrchestration,
  createShareOrchestration,
} from "./features/app/orchestration";
import { createDashboardActions } from "./features/dashboard/actions";
import {
  bindSelectionAndFormHandlers,
  bindSharePanelHandlers,
  bindTopLevelUiHandlers,
  bindWindowLifecycleHandlers,
} from "./features/app/eventBindings";
import { buildDashboardOverview } from "./features/dashboard/overview";
import { buildMatchesPanel } from "./features/dashboard/shell";
import { createLeaderboardRenderer } from "./features/dashboard/renderers/leaderboard";
import { createMatchesRenderer } from "./features/dashboard/renderers/matches";
import { createProgressRenderer } from "./features/dashboard/renderers/progress";
import { createDraftRenderers } from "./features/dashboard/renderers/drafts";
import { createDashboardSync } from "./features/dashboard/sync";
import { createMatchActions } from "./features/matches/actions";
import { buildFairMatchSuggestion, buildUniquePlayerList, findPlayer, renderMatchScore, renderPlayerNames } from "./features/matches/utils";
import { buildHelpScreens } from "./features/help/screens";
import { createSeasonActions } from "./features/seasons/actions";
import { createTournamentActions } from "./features/tournaments/actions";
import { applyTournamentWinnerLocally, buildTournamentSuggestion, getTournamentRoundTitle } from "./features/tournaments/planner";
import { buildDeleteWarning } from "./shared/components/deleteWarning";
import { buildFooter } from "./shared/components/footer";
import { buildLanguageSwitch } from "./shared/components/languageSwitch";
import { buildLoginView } from "./shared/components/loginView";
import { buildScoreCard } from "./shared/components/scoreCard";
import {
  bindLocalizedText,
  onLanguageChange,
  t,
} from "./shared/i18n/runtime";
import type { TextKey } from "./shared/i18n/translations";
import type {
  DashboardState,
  SegmentMode,
  SharePanelElements,
  TournamentPlannerMatch,
  TournamentPlannerRound,
  TournamentPlannerState,
  ViewState,
} from "./shared/types/app";
import { setAvatarImage } from "./shared/utils/avatar";
import { formatCount, formatDate, formatDateTime, getTodayDateValue, toLocalDateTimeValue } from "./shared/utils/format";
import { createAppAuthRuntime } from "./features/app/authRuntime";
import { createAppDom } from "./features/app/dom";
import { createComposerActions } from "./features/app/composerActions";
import { createFormOrchestration } from "./features/app/formOrchestration";
import { createHelpNavigation } from "./features/app/navigation";
import { createLockHelpers } from "./features/app/locks";
import { createParticipantEditors } from "./features/app/participantEditors";
import { assembleAppScreens } from "./features/app/screenAssembly";
import { createShareRuntime } from "./features/app/shareRuntime";
import { createSessionActions } from "./features/app/sessionActions";
import {
  captureShareTokenFromUrl,
  createDashboardState,
  createTournamentPlannerState,
  createViewState,
} from "./features/app/state";
import {
  buildSessionFromBootstrap,
  canSoftDelete,
  getCurrentUserId,
  getMatchFeedContextLabel,
  getMatchLimitForFilter,
  getWinnerLabel,
  isAuthedState,
  isLockedSeason,
  isLockedTournament,
  matchFilterLabels,
  renderMatchContext,
} from "./features/app/helpers";

export const buildApp = (): HTMLElement => {
  let scoreCardPlayersGetter: () => LeaderboardEntry[] = () => [];
  let scoreCardUserGetter: () => string = () => "";
  let dashboardState: DashboardState = createDashboardState();
  const {
    container,
    loadingOverlay,
    loadingOverlayLabel,
    providerStack,
    authActions,
    authMenu,
    createMenu,
    authAvatar,
    authMenuButton,
    createMenuButton,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    faqScreen,
    faqBackButton,
    privacyScreen,
    privacyBackButton,
    footer,
    footerFaqButton,
    footerPrivacyButton,
    loginView,
    googleSlot,
    welcomeTitle,
    welcomeText,
    logoutButton,
    faqMenuButton,
    refreshButton,
    openCreateMatchButton,
    openCreateTournamentButton,
    openCreateSeasonButton,
    openScoreCardButton,
    scoreCardOverlay,
    closeScoreCardButton,
    showScoreCard,
    hideScoreCard,
    isScoreCardVisible,
    deleteWarningOverlay,
    promptDeleteWarning,
    dashboardStatus,
    shareAlert,
    viewGrid,
    progressPanel,
    progressSubtitle,
    progressSubtitleRankLabel,
    progressSubtitleRankValue,
    progressSubtitleElo,
    progressSummary,
    progressBody,
    leaderboardPanel,
    globalButton,
    seasonButton,
    tournamentButton,
    seasonSelect,
    seasonStats,
    seasonStatsMatches,
    seasonStatsActive,
    tournamentSelect,
    leaderboardStatsGroup,
    leaderboardMatchesSummary,
    leaderboardMatchesSummaryValue,
    leaderboardStatMostActive,
    leaderboardStatMostActivePlayer,
    leaderboardStatMostActiveMeta,
    leaderboardStatMostWins,
    leaderboardStatMostWinsPlayer,
    leaderboardStatMostWinsMeta,
    leaderboardStatLongestStreak,
    leaderboardStatLongestStreakLabel,
    leaderboardStatLongestStreakPlayer,
    leaderboardStatLongestStreakMeta,
    leaderboardList,
    leaderboardAvatarFallback,
    composerPanel,
    composerTop,
    closeCreateMatchButton,
    composerHeading,
    composerTitle,
    composerMeta,
    composerStatus,
    matchOutcome,
    matchLockNotice,
    matchQuickBar,
    suggestMatchButton,
    matchForm,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    formSeasonSelect,
    formTournamentSelect,
    tournamentDateInput,
    tournamentSeasonSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    winnerTeamSelect,
    scoreInputs,
    resetScoreInputs,
    submitMatchButton,
    matchesMeta,
    matchesPanel,
    matchFilterButtons,
    matchesList,
    loadMoreButton,
    tournamentPanel,
    seasonPanel,
    tournamentTop,
    tournamentHeading,
    tournamentTitle,
    tournamentMeta,
    closeCreateTournamentButton,
    seasonTop,
    seasonHeading,
    seasonTitle,
    seasonMeta,
    closeCreateSeasonButton,
    seasonStatus,
    seasonSummary,
    seasonLockNotice,
    seasonQuickBar,
    seasonForm,
    seasonNameInput,
    loadSeasonSelect,
    resetSeasonDraftButton,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonBaseEloSelect,
    seasonParticipantSection,
    seasonParticipantLabel,
    seasonParticipantList,
    seasonSelectAllParticipantsField,
    seasonSelectAllParticipantsInput,
    seasonIsActiveInput,
    seasonIsPublicInput,
    submitSeasonButton,
    deleteSeasonButton,
    tournamentNameInput,
    loadTournamentSelect,
    resetTournamentDraftButton,
    tournamentStatus,
    tournamentSummary,
    tournamentLockNotice,
    tournamentQuickBar,
    participantSection,
    participantLabel,
    participantList,
    tournamentSelectAllParticipantsField,
    tournamentSelectAllParticipantsInput,
    suggestTournamentButton,
    saveTournamentButton,
    deleteTournamentButton,
    bracketBoard,
    closeLanguageSwitchIfOutside,
    languageSwitch,
    syncScoreCard,
    setScoreCardSaveMatchHandler,
  } = createAppDom({
    assetsBaseUrl: import.meta.env.BASE_URL,
    getPlayers: () => scoreCardPlayersGetter(),
    getCurrentUserId: () => scoreCardUserGetter(),
    getSeasons: () => dashboardState.seasons,
    getSelectedSeasonId: () => dashboardState.selectedSeasonId,
    buildMatchesPanel,
    matchFilterLabels,
    onMatchFilterClick: (filter) => {
      void applyMatchFilter(filter);
    },
  });

  const state: { current: ViewState } = createViewState();
  scoreCardPlayersGetter = () => dashboardState.players;
  scoreCardUserGetter = () => getCurrentUserId(state.current);
  captureShareTokenFromUrl(dashboardState);

  const tournamentPlannerState: TournamentPlannerState = createTournamentPlannerState();

  let activeTournamentBracketMatchId: string | null = null;
  let authMenuOpen = false;
  let createMenuOpen = false;
  let seasonSharePanelElements: SharePanelElements | null = null;
  let tournamentSharePanelElements: SharePanelElements | null = null;
  let seasonSharePanelRenderedUrl = "";
  let tournamentSharePanelRenderedUrl = "";
  const leaderboardRenderer = createLeaderboardRenderer({
    dashboardState,
    leaderboardList,
    getCurrentUserId: () => getCurrentUserId(state.current),
    t: (key) => t(key),
    avatarBaseUrl: import.meta.env.BASE_URL,
  });
  const markLeaderboardDirty = (): void => {
    leaderboardRenderer.markDirty();
  };

  const matchesRenderer = createMatchesRenderer({
    dashboardState,
    matchesList,
    matchesMeta,
    t: (key) => t(key),
    renderMatchScore,
    renderPlayerNames,
    renderMatchContext: (match, seasons, tournaments, bracketContext, options) =>
      renderMatchContext(match, seasons, tournaments, bracketContext, t, options),
    formatDateTime,
    getCurrentUserId: () => getCurrentUserId(state.current),
    canSoftDelete,
    onDeleteMatch: (match) => {
      void deleteMatch(match);
    },
  });

  const progressRenderer = createProgressRenderer({
    dashboardState,
    progressSummary,
    progressSubtitleRankLabel,
    progressSubtitleRankValue,
    progressSubtitleElo,
    progressBody,
    t: (key) => t(key),
  });

  const draftRenderers = createDraftRenderers({
    dashboardState,
    tournamentPlannerState,
    matchOutcome,
    seasonSummary,
    tournamentSummary,
    seasonStartDateInput,
    seasonBaseEloSelect,
    seasonIsPublicInput,
    seasonIsActiveInput,
    tournamentSeasonSelect,
    tournamentNameInput,
    tournamentDateInput,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    formSeasonSelect,
    formTournamentSelect,
    winnerTeamSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    scoreInputs,
    renderPlayerNames,
    buildUniquePlayerList,
    getMatchFeedContextLabel: (season, tournament) => getMatchFeedContextLabel(season, tournament, t),
    t: (key) => t(key),
  });

  const {
    renderSeasonDraftSummary,
    renderTournamentDraftSummary,
    renderMatchDraftSummary,
    updateScoreLabelsAndPlaceholders,
  } = draftRenderers;
  updateScoreLabelsAndPlaceholders(t("teamALabel"), t("teamBLabel"));

  const {
    setGlobalLoading,
    getSelectedSeason,
    getSelectedTournament,
    getEditingSeason,
    getEditingTournament,
  } = createDashboardSelectors({
    dashboardState,
    tournamentPlannerState,
    getSeasonId: (season) => season.id,
    getTournamentId: (tournament) => tournament.id,
    setGlobalLoadingDom: (active, label) => {
      loadingOverlay.hidden = !active;
      loadingOverlayLabel.textContent = label;
      document.body.classList.toggle("app-busy", active);
    },
    t,
  });

  const matchScreenRefs: {
    teamA2Field: HTMLElement | null;
    teamB2Field: HTMLElement | null;
    scoreGrid: HTMLElement | null;
    contextToggle: HTMLElement | null;
    matchTypeToggle: HTMLElement | null;
    formatTypeToggle: HTMLElement | null;
    pointsToggle: HTMLElement | null;
    seasonField: HTMLElement | null;
    tournamentField: HTMLElement | null;
  } = {
    teamA2Field: null,
    teamB2Field: null,
    scoreGrid: null,
    contextToggle: null,
    matchTypeToggle: null,
    formatTypeToggle: null,
    pointsToggle: null,
    seasonField: null,
    tournamentField: null,
  };
  let seasonBaseEloToggle: HTMLElement | null = null;
  let seasonStateToggle: HTMLElement | null = null;
  let seasonVisibilityToggle: HTMLElement | null = null;
  let tournamentActionsWrapper: HTMLElement;
  let seasonActionsWrapper: HTMLElement;

  const {
    replaceOptions,
    syncLoadControlsVisibility,
    populateSeasonOptions,
    populateTournamentOptions,
    populateTournamentPlannerLoadOptions,
    populateSeasonManagerLoadOptions,
    populateMatchFormOptions,
    collectMatchPayload,
    collectSeasonPayload,
    resetSeasonForm,
    resetTournamentForm,
  } = createFormOrchestration({
    dashboardState,
    tournamentPlannerState,
    getViewState: () => state.current,
    getCurrentUserId: () => getCurrentUserId(state.current),
    isAuthedState,
    getActiveTournamentBracketMatchId: () => activeTournamentBracketMatchId,
    loadSeasonSelect,
    loadTournamentSelect,
    seasonSelect,
    tournamentSelect,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    formSeasonSelect,
    formTournamentSelect,
    tournamentSeasonSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    winnerTeamSelect,
    scoreInputs,
    seasonNameInput,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonBaseEloSelect,
    seasonIsActiveInput,
    seasonIsPublicInput,
    tournamentNameInput,
    tournamentDateInput,
    setSeasonSharePanelTargetId: (seasonId) => setSeasonSharePanelTargetId(seasonId),
    setTournamentSharePanelTargetId: (tournamentId) => setTournamentSharePanelTargetId(tournamentId),
    getMatchScreenRefs: () => matchScreenRefs,
    formatDate,
    t,
  });

  const { syncMatchFormLockState, hasTournamentProgress } = createLockHelpers({
    dashboardState,
    tournamentPlannerState,
    formSeasonSelect,
    formTournamentSelect,
    submitMatchButton,
    matchLockNotice,
    getActiveTournamentBracketMatchId: () => activeTournamentBracketMatchId,
    isLockedSeason,
    isLockedTournament,
    t,
  });

  const { syncAuthState } = createAppAuthRuntime({
    getViewState: () => state.current,
    isAuthedState,
    dashboardState,
    authAvatar,
    authMenu,
    createMenu,
    authActions,
    providerStack,
    languageSwitch,
    container,
    authMenuButton,
    createMenuButton,
    openCreateMatchButton,
    openCreateTournamentButton,
    openCreateSeasonButton,
    openScoreCardButton,
    faqMenuButton,
    logoutButton,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    faqScreen,
    privacyScreen,
    loginView,
    welcomeText,
    scoreCardOverlay,
    assetsBaseUrl: import.meta.env.BASE_URL,
    isScoreCardVisible,
    hideScoreCard,
    getAuthMenuOpen: () => authMenuOpen,
    getCreateMenuOpen: () => createMenuOpen,
    setAuthMenuOpen: (value) => {
      authMenuOpen = value;
    },
    setCreateMenuOpen: (value) => {
      createMenuOpen = value;
    },
  });

  const { openFaqScreen, closeFaqScreen, openPrivacyScreen, closePrivacyScreen } = createHelpNavigation({
    dashboardState,
    setAuthMenuOpen: (value) => {
      authMenuOpen = value;
    },
    setCreateMenuOpen: (value) => {
      createMenuOpen = value;
    },
    syncAuthState,
    syncDashboardState: () => syncDashboardState(),
  });

  const { clearFormStatus, scheduleFormStatusHide } = createFormStatusOrchestration({
    dashboardState,
    tournamentPlannerState,
    syncDashboardState: () => syncDashboardState(),
  });

  const {
    renderShareQr,
    copyTextToClipboard,
    showCopyFeedback,
    updateSeasonSharePanelVisibility,
    updateTournamentSharePanelVisibility,
  } = createShareRuntime({
    dashboardState,
    seasonForm,
    tournamentPanel,
    getSeasonActionsWrapper: () => seasonActionsWrapper,
    getTournamentActionsWrapper: () => tournamentActionsWrapper,
    getEditingSeason,
    getEditingTournament,
    isLockedSeason,
    isLockedTournament,
  });

  const {
    buildSegmentShareKey,
    getSeasonShareTargetId,
    getTournamentShareTargetId,
    setSeasonSharePanelTargetId: baseSetSeasonSharePanelTargetId,
    setTournamentSharePanelTargetId: baseSetTournamentSharePanelTargetId,
    formatShareExpiration,
    animateSharePanel,
    updateSharePanelElements,
    showShareNotice,
    showShareAlert,
  } = createShareOrchestration({
    dashboardState,
    syncDashboardState: () => syncDashboardState(),
    renderShareQr,
    t,
    setShareAlertVisible: (visible) => setShareAlertVisible(visible),
  });

  const setSeasonSharePanelTargetId = (segmentId: string): void => {
    baseSetSeasonSharePanelTargetId(segmentId);
    seasonSharePanelRenderedUrl = "";
  };

  const setTournamentSharePanelTargetId = (segmentId: string): void => {
    baseSetTournamentSharePanelTargetId(segmentId);
    tournamentSharePanelRenderedUrl = "";
  };



  const dashboardSync = createDashboardSync({
    dashboardState,
    tournamentPlannerState,
    dom: {
      dashboardStatus,
      shareAlert,
      globalButton,
      seasonButton,
      tournamentButton,
      seasonSelect,
      tournamentSelect,
      refreshButton,
      createMenuButton,
      openCreateMatchButton,
      openCreateTournamentButton,
      openCreateSeasonButton,
      tournamentMeta,
      seasonMeta,
      closeCreateMatchButton,
      closeCreateSeasonButton,
      resetSeasonDraftButton,
      seasonNameInput,
      seasonStartDateInput,
      seasonEndDateInput,
      seasonBaseEloSelect,
      seasonIsActiveInput,
      seasonIsPublicInput,
      seasonSelectAllParticipantsInput,
      suggestMatchButton,
      matchTypeSelect,
      resetTournamentDraftButton,
      saveTournamentButton,
      suggestTournamentButton,
      loadMoreButton,
      matchFilterButtons,
      composerStatus,
      seasonStatus,
      submitSeasonButton,
      submitMatchButton,
      tournamentStatus,
      deleteSeasonButton,
      deleteTournamentButton,
      seasonLockNotice,
      tournamentLockNotice,
      seasonBaseEloToggle,
      seasonStateToggle,
      seasonVisibilityToggle,
      tournamentNameInput,
      tournamentDateInput,
      tournamentSeasonSelect,
      tournamentSelectAllParticipantsInput,
      loadSeasonSelect,
      loadTournamentSelect,
      leaderboardStatsGroup,
      leaderboardMatchesSummary,
      leaderboardMatchesSummaryValue,
      leaderboardStatMostActive,
      leaderboardStatMostActivePlayer,
      leaderboardStatMostActiveMeta,
      leaderboardStatLongestStreak,
      leaderboardStatLongestStreakLabel,
      leaderboardStatLongestStreakPlayer,
      leaderboardStatLongestStreakMeta,
      leaderboardStatMostWins,
      leaderboardStatMostWinsPlayer,
      leaderboardStatMostWinsMeta,
    },
    sharePanels: {
      get season() {
        return seasonSharePanelElements;
      },
      get tournament() {
        return tournamentSharePanelElements;
      },
      getSeasonShareTargetId,
      getTournamentShareTargetId,
      getSeasonSharePanelRenderedUrl: () => seasonSharePanelRenderedUrl,
      setSeasonSharePanelRenderedUrl: (value: string) => {
        seasonSharePanelRenderedUrl = value;
      },
      getTournamentSharePanelRenderedUrl: () => tournamentSharePanelRenderedUrl,
      setTournamentSharePanelRenderedUrl: (value: string) => {
        tournamentSharePanelRenderedUrl = value;
      },
      updateSharePanelElements,
      updateSeasonSharePanelVisibility: () => updateSeasonSharePanelVisibility(seasonSharePanelElements),
      updateTournamentSharePanelVisibility: () => updateTournamentSharePanelVisibility(tournamentSharePanelElements),
    },
    renderers: {
      leaderboard: leaderboardRenderer,
      matches: matchesRenderer,
      progress: progressRenderer,
    },
    helpers: {
      renderSeasonDraftSummary,
      renderTournamentDraftSummary,
      renderMatchDraftSummary,
      syncMatchFormLockState,
      scheduleFormStatusHide,
      getEditingSeason,
      getEditingTournament,
      hasTournamentProgress,
      isLockedSeason,
      isLockedTournament,
      canSoftDelete,
      getCurrentUserId: () => getCurrentUserId(state.current),
    },
    t: (key) => t(key),
  });

  const syncDashboardState = (): void => {
    dashboardSync.syncDashboardState();
    syncScoreCard();
    const syncSegmentedToggle = (toggle: HTMLElement | null, value: string): void => {
      if (!toggle) {
        return;
      }
      Array.from(toggle.querySelectorAll<HTMLButtonElement>("button[data-value]")).forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.value === value));
      });
    };
    syncSegmentedToggle(seasonBaseEloToggle, seasonBaseEloSelect.value || "carry_over");
    syncSegmentedToggle(seasonStateToggle, seasonIsActiveInput.checked ? "active" : "inactive");
    syncSegmentedToggle(seasonVisibilityToggle, seasonIsPublicInput.checked ? "public" : "private");
  };

  const setShareAlertVisible = (visible: boolean): void => {
    if (!shareAlert) {
      return;
    }
    shareAlert.classList.toggle("share-alert--visible", visible);
  };

  const {
    renderSeasonEditor,
    renderTournamentPlanner,
    onSeasonSelectAllChange,
    onTournamentSelectAllChange,
  } = createParticipantEditors({
    dashboardState,
    tournamentPlannerState,
    getEditingSeason,
    getEditingTournament,
    getSessionUserId: () => getCurrentUserId(state.current),
    isLockedSeason,
    isLockedTournament,
    seasonParticipantList,
    seasonSelectAllParticipantsInput,
    participantList,
    tournamentSelectAllParticipantsInput,
    bracketBoard,
    tournamentSeasonSelect,
    loadTournamentSelect,
    setTournamentSharePanelTargetId,
    syncDashboardState,
    renderPlayerNames,
    findPlayer: (playerId, players) => findPlayer(playerId ?? null, players) ?? undefined,
    advanceTournamentBye: (roundIndex, matchIndex) => advanceTournamentBye(roundIndex, matchIndex),
    prefillMatchFromTournamentPairing: (match) => prefillMatchFromTournamentPairing(match),
    assetsBaseUrl: import.meta.env.BASE_URL,
    t: (key) => t(key),
  });

  if (dashboardState.pendingShareToken && !isAuthedState(state.current)) {
    showShareAlert(t("shareSignInPrompt"));
  }

  onLanguageChange(() => {
    populateSeasonOptions();
    populateTournamentOptions();
    populateTournamentPlannerLoadOptions();
    populateSeasonManagerLoadOptions();
    populateMatchFormOptions();
    renderMatchDraftSummary();
    leaderboardRenderer.markDirty();
    leaderboardRenderer.render();
    syncDashboardState();
  });

  const { setIdleState, runAuthedAction, handleBootstrap } = createSessionActions({
    state,
    dashboardState,
    hasBackendConfig,
    clearSession,
    saveSession,
    syncAuthState,
    syncDashboardState,
    initAuthenticatedDashboard: async () => {
      await initAuthenticatedDashboard();
    },
    buildSessionFromBootstrap,
    isAuthedState,
  });

  seasonSelectAllParticipantsInput.addEventListener("change", onSeasonSelectAllChange);
  tournamentSelectAllParticipantsInput.addEventListener("change", onTournamentSelectAllChange);

  const {
    loadDashboard,
    applyMatchFilter,
    loadMoreMatches,
    applySegmentMode,
    refreshSegmentShareLink,
    initAuthenticatedDashboard,
  } = createDashboardActions({
    dashboardState,
    runAuthedAction,
    syncDashboardState,
    setGlobalLoading,
    markLeaderboardDirty,
    populateSeasonOptions,
    populateSeasonManagerLoadOptions,
    populateTournamentOptions,
    populateTournamentPlannerLoadOptions,
    populateMatchFormOptions,
    renderSeasonEditor,
    renderTournamentPlanner,
    buildSegmentShareKey,
    animateSharePanel,
    showShareAlert,
    isAuthenticated: () => isAuthedState(state.current),
    t: (key) => t(key),
    getMatchLimitForFilter,
  });

  const { submitMatch, deleteMatch } = createMatchActions({
    dashboardState,
    tournamentPlannerState,
    runAuthedAction,
    syncDashboardState,
    syncAuthState,
    setGlobalLoading,
    loadDashboard,
    loadTournamentBracket: async () => {
      await loadTournamentBracket();
    },
    collectMatchPayload,
    resetScoreInputs,
    clearActiveTournamentBracketMatchId: () => {
      activeTournamentBracketMatchId = null;
    },
    setTournamentPlannerTournamentId: (tournamentId: string) => {
      tournamentPlannerState.tournamentId = tournamentId;
    },
    setLoadTournamentSelectValue: (value: string) => {
      loadTournamentSelect.value = value;
    },
    promptDeleteWarning: async (request) => promptDeleteWarning(request),
    renderMatchContext: (match, seasons, tournaments, bracketContext, options) =>
      renderMatchContext(match, seasons, tournaments, bracketContext, t, options),
    renderMatchScore,
    formatDateTime,
  });

  setScoreCardSaveMatchHandler(async (payload) => {
    setGlobalLoading(true, "Saving match...");
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `match_${Date.now()}`;
    try {
      await runAuthedAction("createMatch", payload, requestId);
      await loadDashboard();
    } finally {
      setGlobalLoading(false);
    }
  });

  const { submitSeason, deleteSeason } = createSeasonActions({
    dashboardState,
    seasonNameInput,
    seasonStartDateInput,
    seasonEndDateInput,
    collectSeasonPayload,
    runAuthedAction,
    syncDashboardState,
    syncAuthState,
    setGlobalLoading,
    loadDashboard,
    refreshSegmentShareLink,
    getSeasonSharePanelElements: () => seasonSharePanelElements,
    setSeasonSharePanelTargetId,
    resetSeasonForm,
    getEditingSeason,
    promptDeleteWarning: async (request) => promptDeleteWarning(request),
    formatDate,
  });

  const { loadTournamentBracket, saveTournament, deleteTournament } = createTournamentActions({
    dashboardState,
    tournamentPlannerState,
    tournamentNameInput,
    tournamentDateInput,
    tournamentSeasonSelect,
    loadTournamentSelect,
    runAuthedAction,
    syncDashboardState,
    renderTournamentPlanner,
    setGlobalLoading,
    loadDashboard,
    refreshSegmentShareLink,
    getTournamentSharePanelElements: () => tournamentSharePanelElements,
    setTournamentSharePanelTargetId,
    getEditingTournament,
    populateTournamentPlannerLoadOptions,
    promptDeleteWarning: async (request) => promptDeleteWarning(request),
    formatDate,
  });

  const {
    applyFairMatchSuggestion,
    suggestTournamentBracket,
    advanceTournamentBye,
    prefillMatchFromTournamentPairing,
  } = createComposerActions({
    dashboardState,
    tournamentPlannerState,
    getViewState: () => state.current,
    isAuthedState,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    formSeasonSelect,
    formTournamentSelect,
    winnerTeamSelect,
    resetScoreInputs,
    populateMatchFormOptions,
    renderTournamentPlanner,
    syncAuthState,
    syncDashboardState,
    saveTournament,
    setActiveTournamentBracketMatchId: (value) => {
      activeTournamentBracketMatchId = value;
    },
    buildFairMatchSuggestion,
    buildTournamentSuggestion,
    applyTournamentWinnerLocally,
  });

  const topLevelUiHandlers = createTopLevelUiHandlers({
    authActions,
    createMenu,
    createMenuButton,
    closeLanguageSwitchIfOutside,
    clearSession,
    setIdleState,
    openFaqScreen,
    openPrivacyScreen,
    syncAuthState,
    syncDashboardState,
    loadDashboard,
    resetScoreInputs,
    showScoreCard,
    hideScoreCard,
    populateTournamentPlannerLoadOptions,
    renderTournamentPlanner,
    resetTournamentForm,
    resetSeasonForm,
    populateSeasonManagerLoadOptions,
    renderSeasonEditor,
    closeFaqScreen,
    closePrivacyScreen,
    applyFairMatchSuggestion,
    suggestTournamentBracket,
    dashboardState,
    tournamentPlannerState,
    menuState: {
      get authMenuOpen() {
        return authMenuOpen;
      },
      set authMenuOpen(value: boolean) {
        authMenuOpen = value;
      },
      get createMenuOpen() {
        return createMenuOpen;
      },
      set createMenuOpen(value: boolean) {
        createMenuOpen = value;
      },
    },
  });

  bindTopLevelUiHandlers({
    logoutButton,
    faqMenuButton,
    footerFaqButton,
    footerPrivacyButton,
    authMenuButton,
    createMenuButton,
    refreshButton,
    openCreateMatchButton,
    openCreateTournamentButton,
    openCreateSeasonButton,
    openScoreCardButton,
    closeCreateMatchButton,
    closeCreateTournamentButton,
    closeCreateSeasonButton,
    faqBackButton,
    privacyBackButton,
    closeScoreCardButton,
    scoreCardOverlay,
    suggestMatchButton,
    suggestTournamentButton,
    ...topLevelUiHandlers,
  });

  const selectionAndFormHandlers = createSelectionAndFormHandlers({
    dashboardState,
    tournamentPlannerState,
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
    renderTournamentDraftSummary,
    syncLoadControlsVisibility,
    syncDashboardState,
    renderSeasonEditor,
    renderTournamentPlanner,
    resetSeasonForm,
    resetTournamentForm,
    setSeasonSharePanelTargetId,
    refreshSegmentShareLink,
    seasonSharePanelElements,
    saveTournament,
    deleteTournament,
    deleteSeason,
    applySegmentMode,
    loadMoreMatches,
    populateMatchFormOptions,
    submitMatch,
    submitSeason,
    renderSeasonDraftSummary,
    loadTournamentBracket,
    renderMatchDraftSummary,
  });

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
    matchInputs: [
      matchTypeSelect,
      formatTypeSelect,
      formSeasonSelect,
      formTournamentSelect,
      winnerTeamSelect,
      pointsToWinSelect,
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
    ],
    seasonDraftInputs: [
      seasonNameInput,
      seasonStartDateInput,
      seasonEndDateInput,
      seasonBaseEloSelect,
      seasonIsActiveInput,
      seasonIsPublicInput,
    ],
    tournamentDraftInputs: [tournamentNameInput, tournamentDateInput, tournamentSeasonSelect],
    scoreInputs,
    ...selectionAndFormHandlers,
  });

  const sessionTicker = window.setInterval(() => {
    if (!isAuthedState(state.current)) {
      return;
    }

    if (isExpiredSession(state.current.session)) {
      clearSession();
      state.current = { status: "error", message: "Your session expired. Sign in again." };
      syncAuthState();
      return;
    }

    syncAuthState();
  }, 30_000);

  bindWindowLifecycleHandlers({ sessionId: sessionTicker });

  const {
    seasonSharePanelInstance,
    tournamentSharePanelInstance,
    teamA1Field,
    teamA2Field,
    teamB1Field,
    teamB2Field,
    scoreGrid,
    contextToggle,
    matchTypeToggle,
    formatTypeToggle,
    pointsToggle,
    seasonField,
    tournamentField,
    seasonBaseEloToggle: nextSeasonBaseEloToggle,
    seasonStateToggle: nextSeasonStateToggle,
    seasonVisibilityToggle: nextSeasonVisibilityToggle,
    tournamentActionsWrapper: nextTournamentActionsWrapper,
    seasonActionsWrapper: nextSeasonActionsWrapper,
  } = assembleAppScreens({
    replaceOptions,
    t,
    welcomeTitle,
    refreshButton,
    welcomeText,
    dashboard,
    progressPanel,
    dashboardStatus,
    viewGrid,
    leaderboardPanel,
    matchesPanel,
    seasonBaseEloSelect,
    seasonIsActiveInput,
    seasonIsPublicInput,
    createMatchScreen,
    composerPanel,
    composerTop,
    composerHeading,
    composerTitle,
    composerMeta,
    closeCreateMatchButton,
    matchQuickBar,
    matchOutcome,
    matchLockNotice,
    matchForm,
    composerStatus,
    suggestMatchButton,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    formSeasonSelect,
    formTournamentSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    winnerTeamSelect,
    scoreInputs,
    submitMatchButton,
    createTournamentScreen,
    tournamentPanel,
    tournamentTop,
    tournamentHeading,
    tournamentTitle,
    tournamentMeta,
    closeCreateTournamentButton,
    tournamentQuickBar,
    participantSection,
    participantLabel,
    tournamentSelectAllParticipantsField,
    participantList,
    suggestTournamentButton,
    saveTournamentButton,
    deleteTournamentButton,
    tournamentStatus,
    loadTournamentSelect,
    resetTournamentDraftButton,
    tournamentSeasonSelect,
    tournamentNameInput,
    tournamentDateInput,
    bracketBoard,
    createSeasonScreen,
    seasonPanel,
    seasonTop,
    seasonHeading,
    seasonTitle,
    seasonMeta,
    closeCreateSeasonButton,
    seasonQuickBar,
    seasonForm,
    seasonStatus,
    loadSeasonSelect,
    resetSeasonDraftButton,
    seasonNameInput,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonParticipantSection,
    seasonParticipantLabel,
    seasonSelectAllParticipantsField,
    seasonParticipantList,
    submitSeasonButton,
    deleteSeasonButton,
  });
  tournamentActionsWrapper = nextTournamentActionsWrapper;
  seasonActionsWrapper = nextSeasonActionsWrapper;
  seasonBaseEloToggle = nextSeasonBaseEloToggle;
  seasonStateToggle = nextSeasonStateToggle;
  seasonVisibilityToggle = nextSeasonVisibilityToggle;
  seasonSharePanelElements = seasonSharePanelInstance;
  tournamentSharePanelElements = tournamentSharePanelInstance;
  bindSharePanelHandlers({
    segmentType: "season",
    elements: seasonSharePanelInstance,
    ...createSharePanelHandlers({
      segmentType: "season",
      getTargetId: getSeasonShareTargetId,
      buildSegmentShareKey,
      shareCache: dashboardState.shareCache,
      showShareNotice,
      copyTextToClipboard,
      showCopyFeedback,
      t: (key) => t(key),
      elements: seasonSharePanelInstance,
      refreshSegmentShareLink,
    }),
  });
  bindSharePanelHandlers({
    segmentType: "tournament",
    elements: tournamentSharePanelInstance,
    ...createSharePanelHandlers({
      segmentType: "tournament",
      getTargetId: getTournamentShareTargetId,
      buildSegmentShareKey,
      shareCache: dashboardState.shareCache,
      showShareNotice,
      copyTextToClipboard,
      showCopyFeedback,
      t: (key) => t(key),
      elements: tournamentSharePanelInstance,
      refreshSegmentShareLink,
    }),
  });
  matchScreenRefs.teamA2Field = teamA2Field;
  matchScreenRefs.teamB2Field = teamB2Field;
  matchScreenRefs.scoreGrid = scoreGrid;
  matchScreenRefs.contextToggle = contextToggle;
  matchScreenRefs.matchTypeToggle = matchTypeToggle;
  matchScreenRefs.formatTypeToggle = formatTypeToggle;
  matchScreenRefs.pointsToggle = pointsToggle;
  matchScreenRefs.seasonField = seasonField;
  matchScreenRefs.tournamentField = tournamentField;

  googleSlot.classList.toggle("provider-disabled", !isProviderConfigured());
  populateMatchFormOptions();
  renderTournamentPlanner();

  if (hasBackendConfig && isProviderConfigured()) {
    void renderGoogleButton(googleSlot, handleBootstrap).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Google sign in failed to initialize.";
      state.current = { status: "error", message };
      syncAuthState();
    });
  } else {
    googleSlot.textContent = hasBackendConfig
      ? "Configure VITE_GOOGLE_CLIENT_ID to enable Google sign in."
      : "Configure VITE_API_BASE_URL to enable sign in.";
  }

  syncAuthState();
  syncDashboardState();

  if (isAuthedState(state.current)) {
    void initAuthenticatedDashboard();
  }

  return container;
};
