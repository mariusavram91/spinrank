import type {
  ApiAction,
  ApiActionMap,
  AppSession,
  BootstrapUserData,
  CreateMatchPayload,
  CreateSeasonPayload,
  GetTournamentBracketData,
  GetUserProgressData,
  LeaderboardEntry,
  MatchBracketContext,
  MatchFeedFilter,
  MatchRecord,
  ParticipantSearchEntry,
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
import { renderProfileScreen } from "./features/profile/render";
import { createMatchActions } from "./features/matches/actions";
import {
  buildFairMatchSuggestionFromCandidates,
  buildUniquePlayerList,
  findPlayer,
  renderMatchScore,
  renderPlayerNames,
} from "./features/matches/utils";
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
import { getUnreadAchievementKeys, hasUnreadAchievements, markAchievementsAsSeen } from "./shared/utils/achievements";
import { setAvatarImage } from "./shared/utils/avatar";
import { formatCount, formatDate, formatDateTime, getTodayDateValue, toLocalDateTimeValue } from "./shared/utils/format";
import { createAppAuthRuntime } from "./features/app/authRuntime";
import { createAppDom } from "./features/app/dom";
import { createComposerActions } from "./features/app/composerActions";
import { createFormOrchestration } from "./features/app/formOrchestration";
import { createHelpNavigation } from "./features/app/navigation";
import { createLockHelpers } from "./features/app/locks";
import { createMatchPlayerSearchInputs } from "./features/app/matchPlayerSearchInputs";
import { createParticipantEditors } from "./features/app/participantEditors";
import { createScreenScrollReset } from "./features/app/scroll";
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
    authAvatarButton,
    authAvatar,
    authAvatarBadge,
    authMenuButton,
    createMenuButton,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    profileScreen,
    closeProfileButton,
    profileStatus,
    profileAchievementsSummary,
    profileAchievementsUnread,
    profileAchievementsToggle,
    profileAchievementsList,
    profileSeasonsList,
    profileTournamentsList,
    profileMatchesList,
    profileLoadMoreButton,
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
    matchBracketSelect,
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
    seasonInsights,
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
    seasonParticipantSearchInput,
    seasonParticipantResults,
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
    tournamentInsights,
    participantSection,
    participantLabel,
    participantList,
    participantSearchInput,
    participantSearchResults,
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
  const matchParticipantCache = new Map<string, ParticipantSearchEntry[]>();
  const rememberedMatchParticipants = new Map<string, ParticipantSearchEntry>();
  const rememberMatchParticipants = (participants: ParticipantSearchEntry[]): void => {
    participants.forEach((participant) => {
      rememberedMatchParticipants.set(participant.userId, participant);
    });
  };

  let activeTournamentBracketMatchId: string | null = null;
  const getMatchPlayerEntries = (): Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    elo: number;
    rank: number;
  }> => {
    const entries = new Map<
      string,
      {
        userId: string;
        displayName: string;
        avatarUrl: string | null;
        elo: number;
        rank: number;
      }
    >();
    const tournamentId = formTournamentSelect.value;
    if (tournamentId) {
      dashboardState.players.forEach((player) => {
        entries.set(player.userId, {
          userId: player.userId,
          displayName: player.displayName,
          avatarUrl: player.avatarUrl,
          elo: player.elo,
          rank: player.rank,
        });
      });
    }
    const bracketParticipants = tournamentId
      ? dashboardState.matchTournamentBracketCache[tournamentId]?.participants ?? []
      : [];
    const matchParticipantKey = formSeasonSelect.value ? `season:${formSeasonSelect.value}` : "open";
    const relatedParticipants = !tournamentId ? matchParticipantCache.get(matchParticipantKey) ?? [] : [];
    relatedParticipants.forEach((participant) => {
      if (!entries.has(participant.userId)) {
        entries.set(participant.userId, {
          userId: participant.userId,
          displayName: participant.displayName,
          avatarUrl: participant.avatarUrl,
          elo: participant.elo,
          rank: Number.MAX_SAFE_INTEGER,
        });
      }
    });
    rememberedMatchParticipants.forEach((participant) => {
      if (!entries.has(participant.userId)) {
        entries.set(participant.userId, {
          userId: participant.userId,
          displayName: participant.displayName,
          avatarUrl: participant.avatarUrl,
          elo: participant.elo,
          rank: Number.MAX_SAFE_INTEGER,
        });
      }
    });
    if (!tournamentId && isAuthedState(state.current)) {
      const currentUserId = state.current.session.user.id;
      const currentLeaderboardEntry = dashboardState.players.find((player) => player.userId === currentUserId);
      if (currentLeaderboardEntry) {
        entries.set(currentUserId, {
          userId: currentLeaderboardEntry.userId,
          displayName: currentLeaderboardEntry.displayName,
          avatarUrl: currentLeaderboardEntry.avatarUrl,
          elo: currentLeaderboardEntry.elo,
          rank: currentLeaderboardEntry.rank,
        });
      } else {
        entries.set(currentUserId, {
          userId: currentUserId,
          displayName: state.current.session.user.displayName,
          avatarUrl: state.current.session.user.avatarUrl,
          elo: 1200,
          rank: Number.MAX_SAFE_INTEGER,
        });
      }
    }
    bracketParticipants.forEach((participant) => {
      if (!entries.has(participant.userId)) {
        entries.set(participant.userId, {
          userId: participant.userId,
          displayName: participant.displayName,
          avatarUrl: participant.avatarUrl,
          elo: participant.elo,
          rank: Number.MAX_SAFE_INTEGER,
        });
      }
    });

    return [...entries.values()];
  };
  const refreshMatchPlayerPool = async (): Promise<void> => {
    if (!isAuthedState(state.current) || formTournamentSelect.value) {
      return;
    }
    const seasonId = formSeasonSelect.value || null;
    const cacheKey = seasonId ? `season:${seasonId}` : "open";
    const data = await runAuthedAction("searchParticipants", {
      segmentType: "season",
      seasonId,
      limit: 100,
    });
    matchParticipantCache.set(cacheKey, data.participants);
    rememberMatchParticipants(data.participants);
    populateMatchFormOptions();
    syncMatchPlayerSearchInputs();
    syncDashboardState();
  };
  const findMatchPlayer = (playerId: string | null | undefined) =>
    getMatchPlayerEntries().find((player) => player.userId === playerId);
  const getSuggestedMatchPlayers = async (): Promise<Array<{
    userId: string;
    displayName: string;
    elo: number;
    wins?: number;
    losses?: number;
  }>> => {
    const stateValue = state.current;
    const sessionUserId = getCurrentUserId(stateValue);
    const seasonId = formSeasonSelect.value || null;
    const relatedParticipants: ParticipantSearchEntry[] = formTournamentSelect.value
      ? []
      : (
          await runAuthedAction("searchParticipants", {
            segmentType: "season",
            seasonId,
            limit: 100,
          })
        ).participants;
    rememberMatchParticipants(relatedParticipants);

    const leaderboardById = new Map(
      dashboardState.players.map((player) => [
        player.userId,
        {
          userId: player.userId,
          displayName: player.displayName,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
        },
      ]),
    );

    const candidates = new Map<string, { userId: string; displayName: string; elo: number; wins?: number; losses?: number }>();
    relatedParticipants.forEach((participant) => {
      const leaderboardEntry = leaderboardById.get(participant.userId);
      candidates.set(participant.userId, leaderboardEntry ?? {
        userId: participant.userId,
        displayName: participant.displayName,
        elo: participant.elo,
      });
    });

    const selfEntry = leaderboardById.get(sessionUserId);
    if (selfEntry) {
      candidates.set(sessionUserId, selfEntry);
    } else if (isAuthedState(stateValue)) {
      candidates.set(sessionUserId, {
        userId: sessionUserId,
        displayName: stateValue.session.user.displayName,
        elo: 1200,
      });
    }

    return [...candidates.values()];
  };
  const getAllowedMatchPlayerIds = (): string[] | null => {
    const tournamentId = formTournamentSelect.value;
    if (tournamentId) {
      if (!activeTournamentBracketMatchId) {
        return [];
      }
      const bracketData = dashboardState.matchTournamentBracketCache[tournamentId];
      const bracketMatch = bracketData?.rounds
        .flatMap((round: GetTournamentBracketData["rounds"][number]) => round.matches)
        .find((match: GetTournamentBracketData["rounds"][number]["matches"][number]) => match.id === activeTournamentBracketMatchId);
      return bracketMatch ? [bracketMatch.leftPlayerId, bracketMatch.rightPlayerId].filter(Boolean) as string[] : [];
    }
    const seasonId = formSeasonSelect.value;
    if (seasonId) {
      return dashboardState.seasons.find((season) => season.id === seasonId)?.participantIds ?? [];
    }
    return null;
  };
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
    seasonInfoField: HTMLElement | null;
    seasonInfoValue: HTMLElement | null;
    tournamentField: HTMLElement | null;
    bracketField: HTMLElement | null;
  } = {
    teamA2Field: null,
    teamB2Field: null,
    scoreGrid: null,
    contextToggle: null,
    matchTypeToggle: null,
    formatTypeToggle: null,
    pointsToggle: null,
    seasonField: null,
    seasonInfoField: null,
    seasonInfoValue: null,
    tournamentField: null,
    bracketField: null,
  };
  let seasonBaseEloToggle: HTMLElement | null = null;
  let seasonStateToggle: HTMLElement | null = null;
  let seasonVisibilityToggle: HTMLElement | null = null;
  let tournamentActionsWrapper: HTMLElement;
  let seasonActionsWrapper: HTMLElement;
  let syncMatchPlayerSearchInputs = (): void => {};

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
    matchBracketSelect,
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
    suggestMatchButton,
    submitMatchButton,
    setSeasonSharePanelTargetId: (seasonId) => setSeasonSharePanelTargetId(seasonId),
    setTournamentSharePanelTargetId: (tournamentId) => setTournamentSharePanelTargetId(tournamentId),
    getMatchScreenRefs: () => matchScreenRefs,
    getAllowedMatchPlayerIds,
    getMatchPlayerEntries,
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

  const getEligibleTournamentBracketMatches = (tournamentId: string): Array<{
    id: string;
    label: string;
    leftPlayerId: string;
    rightPlayerId: string;
  }> => {
    const bracketData = dashboardState.matchTournamentBracketCache[tournamentId];
    const currentUserId = getCurrentUserId(state.current);
    if (!bracketData || !currentUserId) {
      return [];
    }
    return bracketData.rounds.flatMap((round: GetTournamentBracketData["rounds"][number]) =>
      round.matches
        .filter((match: GetTournamentBracketData["rounds"][number]["matches"][number]) =>
          Boolean(match.leftPlayerId) &&
          Boolean(match.rightPlayerId) &&
          !match.createdMatchId &&
          !match.winnerPlayerId &&
          !match.locked &&
          [match.leftPlayerId, match.rightPlayerId].includes(currentUserId),
        )
        .map((match: GetTournamentBracketData["rounds"][number]["matches"][number]) => {
          const leftName = findMatchPlayer(match.leftPlayerId)?.displayName || "Player 1";
          const rightName = findMatchPlayer(match.rightPlayerId)?.displayName || "Player 2";
          return {
            id: match.id,
            label: `${round.title}: ${leftName} vs ${rightName}`,
            leftPlayerId: match.leftPlayerId as string,
            rightPlayerId: match.rightPlayerId as string,
          };
        }),
    );
  };

  const syncMatchBracketOptions = async (): Promise<void> => {
    const tournamentId = formTournamentSelect.value;
    if (!tournamentId) {
      activeTournamentBracketMatchId = null;
      replaceOptions(
        matchBracketSelect,
        [{ value: "", label: t("matchBracketSelectPrompt") }],
        "",
        t("matchBracketSelectPrompt"),
      );
      matchBracketSelect.disabled = true;
      populateMatchFormOptions();
      syncMatchPlayerSearchInputs();
      syncDashboardState();
      return;
    }
    if (!dashboardState.matchTournamentBracketCache[tournamentId]) {
      const data: GetTournamentBracketData = await runAuthedAction("getTournamentBracket", { tournamentId });
      dashboardState.matchTournamentBracketCache[tournamentId] = data;
    }
    const options = getEligibleTournamentBracketMatches(tournamentId);
    if (!options.some((option) => option.id === activeTournamentBracketMatchId)) {
      activeTournamentBracketMatchId = options[0]?.id ?? null;
    }
    replaceOptions(
      matchBracketSelect,
      options.length > 0
        ? options.map((option) => ({ value: option.id, label: option.label }))
        : [
            {
              value: "",
              label: t("matchBracketNoEligible"),
            },
          ],
      activeTournamentBracketMatchId || "",
      options.length > 0 ? options[0]?.label ?? t("matchBracketSelectPrompt") : t("matchBracketNoEligible"),
    );
    matchBracketSelect.disabled = options.length === 0;
    if (activeTournamentBracketMatchId) {
      applySelectedTournamentBracketMatch();
      return;
    }
    teamA1Select.dataset.pendingValue = "";
    teamA2Select.dataset.pendingValue = "";
    teamB1Select.dataset.pendingValue = "";
    teamB2Select.dataset.pendingValue = "";
    teamA1Select.value = "";
    teamA2Select.value = "";
    teamB1Select.value = "";
    teamB2Select.value = "";
    populateMatchFormOptions();
    syncMatchPlayerSearchInputs();
    syncDashboardState();
  };

  const applySelectedTournamentBracketMatch = (): void => {
    const tournamentId = formTournamentSelect.value;
    const bracketMatch = tournamentId
      ? dashboardState.matchTournamentBracketCache[tournamentId]?.rounds
        .flatMap((round: GetTournamentBracketData["rounds"][number]) => round.matches)
        .find((match: GetTournamentBracketData["rounds"][number]["matches"][number]) => match.id === activeTournamentBracketMatchId)
      : null;
    if (!bracketMatch) {
      return;
    }
    teamA1Select.dataset.pendingValue = bracketMatch.leftPlayerId || "";
    teamA2Select.dataset.pendingValue = "";
    teamB1Select.dataset.pendingValue = bracketMatch.rightPlayerId || "";
    teamB2Select.dataset.pendingValue = "";
    teamA1Select.value = bracketMatch.leftPlayerId || "";
    teamA2Select.value = "";
    teamB1Select.value = bracketMatch.rightPlayerId || "";
    teamB2Select.value = "";
    matchTypeSelect.value = "singles";
    formatTypeSelect.value = "single_game";
    pointsToWinSelect.value = "11";
    winnerTeamSelect.value = "A";
    resetScoreInputs();
    populateMatchFormOptions();
    syncMatchPlayerSearchInputs();
    syncDashboardState();
  };

  const { syncAuthState } = createAppAuthRuntime({
    getViewState: () => state.current,
    isAuthedState,
    dashboardState,
    authAvatarButton,
    authAvatar,
    authAvatarBadge,
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
    profileScreen,
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
  const resetScrollForScreenChange = createScreenScrollReset(() => dashboardState.screen);

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
      formTournamentSelect,
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
    if (isAuthedState(state.current)) {
      const currentUserId = getCurrentUserId(state.current);
      renderProfileScreen({
        dashboardState,
        achievementsSummary: profileAchievementsSummary,
        achievementsUnread: profileAchievementsUnread,
        achievementsToggle: profileAchievementsToggle,
        achievementsList: profileAchievementsList,
        currentUserId,
        seasonsList: profileSeasonsList,
        tournamentsList: profileTournamentsList,
        matchesList: profileMatchesList,
        status: profileStatus,
        loadMoreButton: profileLoadMoreButton,
        t: (key) => t(key),
        renderMatchScore,
        renderPlayerNames,
        renderMatchContext: (match, seasons, tournaments, bracketContext, options) =>
          renderMatchContext(match, seasons, tournaments, bracketContext, t, options),
        formatDateTime,
        onOpenSeason: openSeasonEditor,
        onOpenTournament: openTournamentEditor,
        onLoadMoreMatches: () => {
          void loadProfileMatches(false);
        },
      });

      const renderSegmentInsights = (
        target: HTMLElement,
        segmentType: "season" | "tournament",
        segmentId: string,
      ): void => {
        if (!segmentId) {
          target.hidden = true;
          target.replaceChildren();
          return;
        }
        const summary = dashboardState.profileSegmentSummaries[buildProfileSummaryKey(segmentType, segmentId)];
        if (!summary) {
          target.hidden = true;
          target.replaceChildren();
          void ensureProfileSegmentSummary(segmentType, segmentId);
          return;
        }
        const chips = [
          `${t("leaderboardWins")} ${summary.wins}`,
          `${t("leaderboardLosses")} ${summary.losses}`,
          summary.rank ? `${t("progressRanked")} #${summary.rank}` : "",
          summary.placementLabelKey
            ? `${t("profilePlacement")} ${t(summary.placementLabelKey).replace(
                "{count}",
                String(summary.placementLabelCount ?? 0),
              )}`
            : "",
          `${t("profileParticipants")} ${summary.participantCount}`,
        ]
          .filter(Boolean)
          .map((label) => {
            const chip = document.createElement("span");
            chip.className = "profile-stat-chip";
            chip.textContent = label;
            return chip;
          });
        target.hidden = chips.length === 0;
        target.replaceChildren(...chips);
      };

      renderSegmentInsights(seasonInsights, "season", dashboardState.editingSeasonId);
      renderSegmentInsights(tournamentInsights, "tournament", tournamentPlannerState.tournamentId);
    }
    syncMatchPlayerSearchInputs();
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
    resetScrollForScreenChange();
  };

  const setShareAlertVisible = (visible: boolean): void => {
    if (!shareAlert) {
      return;
    }
    shareAlert.classList.toggle("share-alert--visible", visible);
  };

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

  const { renderSeasonEditor, renderTournamentPlanner } = createParticipantEditors({
    dashboardState,
    tournamentPlannerState,
    getEditingSeason,
    getEditingTournament,
    getSessionUserId: () => getCurrentUserId(state.current),
    isLockedSeason,
    isLockedTournament,
    seasonParticipantList,
    seasonParticipantSearchInput,
    seasonParticipantResults,
    participantList,
    participantSearchInput,
    participantSearchResults,
    bracketBoard,
    tournamentSeasonSelect,
    loadTournamentSelect,
    setTournamentSharePanelTargetId,
    syncDashboardState,
    runAuthedAction,
    renderPlayerNames,
    findPlayer: (playerId, players) => findPlayer(playerId ?? null, players) ?? undefined,
    advanceTournamentBye: (roundIndex, matchIndex) => advanceTournamentBye(roundIndex, matchIndex),
    prefillMatchFromTournamentPairing: (match) => prefillMatchFromTournamentPairing(match),
    assetsBaseUrl: import.meta.env.BASE_URL,
    t: (key) => t(key),
  });

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
    hasUnreadAchievements,
    syncAuthState,
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
    syncMatchBracketOptions: () => {
      void syncMatchBracketOptions();
    },
    applySelectedTournamentBracketMatch,
    renderTournamentPlanner,
    syncAuthState,
    syncDashboardState,
    saveTournament,
    setActiveTournamentBracketMatchId: (value) => {
      activeTournamentBracketMatchId = value;
    },
    getSuggestedMatchPlayers,
    buildFairMatchSuggestion: buildFairMatchSuggestionFromCandidates,
    buildTournamentSuggestion,
    applyTournamentWinnerLocally,
  });

  const buildProfileSummaryKey = (segmentType: "season" | "tournament", segmentId: string): string =>
    `${segmentType}:${segmentId}`;

  const ensureProfileSegmentSummary = async (segmentType: "season" | "tournament", segmentId: string): Promise<void> => {
    if (!segmentId || !isAuthedState(state.current)) {
      return;
    }
    const key = buildProfileSummaryKey(segmentType, segmentId);
    if (
      dashboardState.profileSegmentSummaries[key] ||
      dashboardState.profileSegmentSummaryLoadingKeys.includes(key)
    ) {
      return;
    }

    dashboardState.profileSegmentSummaryLoadingKeys = [...dashboardState.profileSegmentSummaryLoadingKeys, key];
    syncDashboardState();

    try {
      const data = await runAuthedAction("getSegmentLeaderboard", { segmentType, segmentId });
      const currentUserId = getCurrentUserId(state.current);
      const currentEntry = data.leaderboard.find((entry) => entry.userId === currentUserId);
      const participantCount =
        segmentType === "season"
          ? dashboardState.seasons.find((season) => season.id === segmentId)?.participantIds.length ?? data.leaderboard.length
          : dashboardState.tournaments.find((tournament) => tournament.id === segmentId)?.participantCount ??
            data.leaderboard.length;

      dashboardState.profileSegmentSummaries[key] = {
        segmentType,
        segmentId,
        wins: currentEntry?.wins ?? 0,
        losses: currentEntry?.losses ?? 0,
        rank: currentEntry?.rank ?? null,
        placementLabelKey: currentEntry?.placementLabelKey,
        placementLabelCount: currentEntry?.placementLabelCount ?? null,
        participantCount,
      };
    } catch {
      // Keep the card interactive even if segment stats fail to load.
    } finally {
      dashboardState.profileSegmentSummaryLoadingKeys = dashboardState.profileSegmentSummaryLoadingKeys.filter(
        (entry) => entry !== key,
      );
      syncDashboardState();
    }
  };

  const loadProfileMatches = async (reset = false): Promise<void> => {
    if (!isAuthedState(state.current)) {
      return;
    }

    dashboardState.profileMatchesLoading = true;
    syncDashboardState();

    try {
      const data = await runAuthedAction("getMatches", {
        filter: "mine",
        limit: 15,
        cursor: reset ? undefined : dashboardState.profileMatchesCursor ?? undefined,
      });
      const bracketContext = Object.fromEntries(
        data.matches
          .filter((match) => Boolean(match.bracketContext))
          .map((match) => [match.id, match.bracketContext as MatchBracketContext]),
      );
      dashboardState.profileMatches = reset ? data.matches : [...dashboardState.profileMatches, ...data.matches];
      dashboardState.players = [
        ...new Map(
          [...dashboardState.players, ...(data.players ?? [])].map((player) => [player.userId, player]),
        ).values(),
      ];
      dashboardState.profileMatchesCursor = data.nextCursor;
      dashboardState.matchBracketContextByMatchId = {
        ...dashboardState.matchBracketContextByMatchId,
        ...bracketContext,
      };
    } finally {
      dashboardState.profileMatchesLoading = false;
      syncDashboardState();
    }
  };

  const openSeasonEditor = (seasonId: string): void => {
    const season = dashboardState.seasons.find((entry) => entry.id === seasonId);
    if (!season || isLockedSeason(season)) {
      return;
    }
    dashboardState.screen = "createSeason";
    dashboardState.seasonFormError = "";
    dashboardState.seasonFormMessage = "";
    populateSeasonManagerLoadOptions();
    syncAuthState();
    syncDashboardState();
    loadSeasonSelect.value = seasonId;
    loadSeasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const openTournamentEditor = (tournamentId: string): void => {
    const tournament = dashboardState.tournaments.find((entry) => entry.id === tournamentId);
    if (!tournament || isLockedTournament(tournament)) {
      return;
    }
    dashboardState.screen = "createTournament";
    dashboardState.tournamentFormMessage = "";
    tournamentPlannerState.error = "";
    populateTournamentPlannerLoadOptions();
    syncAuthState();
    syncDashboardState();
    loadTournamentSelect.value = tournamentId;
    loadTournamentSelect.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const openProfileScreen = async (): Promise<void> => {
    if (!isAuthedState(state.current)) {
      return;
    }

    dashboardState.profileRecentlySeenAchievementKeys = getUnreadAchievementKeys(dashboardState.achievements);
    markAchievementsAsSeen(dashboardState.achievements);
    dashboardState.hasNewAchievements = false;
    dashboardState.screen = "profile";
    dashboardState.profileLoading = true;
    setGlobalLoading(true, t("loadingOverlay"));
    syncAuthState();
    syncDashboardState();

    const currentUserId = getCurrentUserId(state.current);
    const visibleSeasons = dashboardState.seasons.filter(
      (season) => season.status !== "deleted" && season.participantIds.includes(currentUserId),
    );
    const visibleTournaments = dashboardState.tournaments.filter(
      (tournament) => tournament.status !== "deleted" && tournament.participantIds.includes(currentUserId),
    );

    try {
      await Promise.all([
        loadProfileMatches(true),
        ...visibleSeasons.map((season) => ensureProfileSegmentSummary("season", season.id)),
        ...visibleTournaments.map((tournament) => ensureProfileSegmentSummary("tournament", tournament.id)),
      ]);
    } catch (error) {
      dashboardState.error = error instanceof Error ? error.message : "Failed to load profile.";
    } finally {
      dashboardState.profileLoading = false;
      setGlobalLoading(false);
      syncDashboardState();
    }
  };

  profileAchievementsToggle.addEventListener("click", () => {
    dashboardState.profileAchievementsExpanded = !dashboardState.profileAchievementsExpanded;
    syncDashboardState();
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
    openProfileScreen,
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
    authAvatarButton,
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
    closeProfileButton,
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
    ensureProfileSegmentSummary,
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
      matchBracketSelect,
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
    seasonInfoField,
    seasonInfoValue,
    tournamentField,
    bracketField,
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
    matchBracketSelect,
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
    tournamentInsights,
    participantSection,
    participantLabel,
    participantSearchInput,
    participantSearchResults,
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
    seasonInsights,
    seasonForm,
    seasonStatus,
    loadSeasonSelect,
    resetSeasonDraftButton,
    seasonNameInput,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonParticipantSection,
    seasonParticipantLabel,
    seasonParticipantSearchInput,
    seasonParticipantResults,
    seasonParticipantList,
    submitSeasonButton,
    deleteSeasonButton,
  });
  tournamentActionsWrapper = nextTournamentActionsWrapper;
  seasonActionsWrapper = nextSeasonActionsWrapper;
  seasonBaseEloToggle = nextSeasonBaseEloToggle;
  seasonStateToggle = nextSeasonStateToggle;
  seasonVisibilityToggle = nextSeasonVisibilityToggle;
  syncMatchPlayerSearchInputs = createMatchPlayerSearchInputs({
    dashboardState,
    t: (key) => t(key),
    getCurrentUserId: () => getCurrentUserId(state.current),
    getAllowedMatchPlayerIds,
    getMatchPlayerEntries,
    searchPlayers: async (query) => {
      if (!isAuthedState(state.current) || formTournamentSelect.value) {
        return [];
      }
      const data = await runAuthedAction("searchParticipants", {
        segmentType: "season",
        seasonId: formSeasonSelect.value || null,
        query,
        limit: 12,
      });
      rememberMatchParticipants(data.participants);
      return data.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
        elo: participant.elo,
        rank: Number.MAX_SAFE_INTEGER,
      }));
    },
    formSeasonSelect,
    formTournamentSelect,
    teamA1Field,
    teamA2Field,
    teamB1Field,
    teamB2Field,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
  }).sync;
  matchBracketSelect.disabled = true;
  formTournamentSelect.addEventListener("change", () => {
    activeTournamentBracketMatchId = null;
    if (!formTournamentSelect.value) {
      void refreshMatchPlayerPool();
    }
    void syncMatchBracketOptions();
  });
  formSeasonSelect.addEventListener("change", () => {
    if (!formTournamentSelect.value) {
      void refreshMatchPlayerPool();
    }
  });
  matchBracketSelect.addEventListener("change", () => {
    activeTournamentBracketMatchId = matchBracketSelect.value || null;
    applySelectedTournamentBracketMatch();
  });
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
  matchScreenRefs.seasonInfoField = seasonInfoField;
  matchScreenRefs.seasonInfoValue = seasonInfoValue;
  matchScreenRefs.tournamentField = tournamentField;
  matchScreenRefs.bracketField = bracketField;

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
    void initAuthenticatedDashboard().then(() => {
      void refreshMatchPlayerPool();
    });
  }

  return container;
};
