import type {
  LeaderboardEntry,
  MatchFeedFilter,
  SegmentType,
  SeasonRecord,
  TournamentRecord,
} from "../../../api/contract";
import type {
  DashboardState,
  SharePanelElements,
  TournamentPlannerState,
} from "../../shared/types/app";
import type { TextKey } from "../../shared/i18n/translations";
import { formatCount } from "../../shared/utils/format";

type TranslationFn = (key: TextKey) => string;

type DashboardSyncDom = {
  dashboardStatus: HTMLElement;
  shareAlert: HTMLElement;
  globalButton: HTMLButtonElement;
  seasonButton: HTMLButtonElement;
  tournamentButton: HTMLButtonElement;
  seasonSelect: HTMLSelectElement;
  tournamentSelect: HTMLSelectElement;
  refreshButton: HTMLButtonElement;
  createMenuButton: HTMLButtonElement;
  openCreateMatchButton: HTMLButtonElement;
  openCreateTournamentButton: HTMLButtonElement;
  openCreateSeasonButton: HTMLButtonElement;
  tournamentMeta: HTMLElement;
  seasonMeta: HTMLElement;
  closeCreateMatchButton: HTMLButtonElement;
  closeCreateSeasonButton: HTMLButtonElement;
  resetSeasonDraftButton: HTMLButtonElement;
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonIsActiveInput: HTMLInputElement;
  seasonIsPublicInput: HTMLInputElement;
  seasonSelectAllParticipantsInput: HTMLInputElement;
  suggestMatchButton: HTMLButtonElement;
  formTournamentSelect: HTMLSelectElement;
  matchTypeSelect: HTMLSelectElement;
  resetTournamentDraftButton: HTMLButtonElement;
  saveTournamentButton: HTMLButtonElement;
  suggestTournamentButton: HTMLButtonElement;
  loadMoreButton: HTMLButtonElement;
  matchFilterButtons: Map<MatchFeedFilter, HTMLButtonElement>;
  composerStatus: HTMLElement;
  seasonStatus: HTMLElement;
  submitSeasonButton: HTMLButtonElement;
  submitMatchButton: HTMLButtonElement;
  tournamentStatus: HTMLElement;
  deleteSeasonButton: HTMLButtonElement;
  deleteTournamentButton: HTMLButtonElement;
  seasonLockNotice: HTMLElement;
  tournamentLockNotice: HTMLElement;
  seasonBaseEloToggle: HTMLElement | null;
  seasonStateToggle: HTMLElement | null;
  seasonVisibilityToggle: HTMLElement | null;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  tournamentSeasonSelect: HTMLSelectElement;
  tournamentSelectAllParticipantsInput: HTMLInputElement;
  loadSeasonSelect: HTMLSelectElement;
  loadTournamentSelect: HTMLSelectElement;
  leaderboardStatsGroup: HTMLElement;
  leaderboardMatchesSummary: HTMLElement;
  leaderboardMatchesSummaryValue: HTMLElement;
  leaderboardStatMostActive: HTMLElement;
  leaderboardStatMostActivePlayer: HTMLElement;
  leaderboardStatMostActiveMeta: HTMLElement;
  leaderboardStatLongestStreak: HTMLElement;
  leaderboardStatLongestStreakLabel: HTMLElement;
  leaderboardStatLongestStreakPlayer: HTMLElement;
  leaderboardStatLongestStreakMeta: HTMLElement;
  leaderboardStatHighestPeak: HTMLElement;
  leaderboardStatHighestPeakLabel: HTMLElement;
  leaderboardStatHighestPeakPlayer: HTMLElement;
  leaderboardStatHighestPeakMeta: HTMLElement;
  leaderboardStatMostWins: HTMLElement;
  leaderboardStatMostWinsPlayer: HTMLElement;
  leaderboardStatMostWinsMeta: HTMLElement;
  leaderboardStatBestWinRate: HTMLElement;
  leaderboardStatBestWinRatePlayer: HTMLElement;
  leaderboardStatBestWinRateMeta: HTMLElement;
};

type SharePanelSyncData = {
  season: SharePanelElements | null;
  tournament: SharePanelElements | null;
  getSeasonShareTargetId: () => string;
  getTournamentShareTargetId: () => string;
  getSeasonSharePanelRenderedUrl: () => string;
  setSeasonSharePanelRenderedUrl: (value: string) => void;
  getTournamentSharePanelRenderedUrl: () => string;
  setTournamentSharePanelRenderedUrl: (value: string) => void;
  updateSharePanelElements: (
    elements: SharePanelElements,
    segmentType: SegmentType,
    targetId: string,
    renderedUrl: string,
    setRenderedUrl: (value: string) => void,
  ) => void;
  updateSeasonSharePanelVisibility: () => void;
  updateTournamentSharePanelVisibility: () => void;
};

type DashboardSyncHelpers = {
  renderSeasonDraftSummary: () => void;
  renderTournamentDraftSummary: () => void;
  renderMatchDraftSummary: () => void;
  syncMatchFormLockState: () => void;
  scheduleFormStatusHide: (target: "match" | "season" | "tournament", visible: boolean) => void;
  getEditingSeason: () => SeasonRecord | undefined;
  getEditingTournament: () => TournamentRecord | undefined;
  hasTournamentProgress: () => boolean;
  isLockedSeason: (season: SeasonRecord | undefined) => boolean;
  isLockedTournament: (tournament: TournamentRecord | undefined) => boolean;
  canSoftDelete: (resource: { createdByUserId?: string | null }, sessionUserId: string) => boolean;
  getCurrentUserId: () => string;
};

type RendererSet = {
  leaderboard: { render: () => void };
  matches: { render: () => void };
  progress: { render: () => void };
};

export const createDashboardSync = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  dom: DashboardSyncDom;
  sharePanels: SharePanelSyncData;
  renderers: RendererSet;
  helpers: DashboardSyncHelpers;
  t: TranslationFn;
}) => {
  const getBestWinRatePlayer = (): { entry: LeaderboardEntry; rate: number; matches: number } | null => {
    const minimumMatches = args.dashboardState.segmentMode === "season" ? 10 : 20;
    return args.dashboardState.leaderboard.reduce<{ entry: LeaderboardEntry; rate: number; matches: number } | null>(
      (best, entry) => {
        const matches = entry.wins + entry.losses;
        if (matches < minimumMatches) {
          return best;
        }

        const rate = matches > 0 ? entry.wins / matches : 0;
        if (!best) {
          return { entry, rate, matches };
        }

        if (rate !== best.rate) {
          return rate > best.rate ? { entry, rate, matches } : best;
        }
        if (matches !== best.matches) {
          return matches > best.matches ? { entry, rate, matches } : best;
        }
        if (entry.wins !== best.entry.wins) {
          return entry.wins > best.entry.wins ? { entry, rate, matches } : best;
        }

        return entry.displayName.localeCompare(best.entry.displayName) < 0 ? { entry, rate, matches } : best;
      },
      null,
    );
  };

  const getLongestStreakPlayer = (): LeaderboardEntry | null =>
    args.dashboardState.leaderboard.reduce<LeaderboardEntry | null>((best, entry) => {
      const bestWinStreak = entry.bestWinStreak ?? 0;
      if (bestWinStreak > 0 && (!best || bestWinStreak > (best.bestWinStreak ?? 0))) {
        return entry;
      }
      return best;
    }, null);

  const getHighestPeakPlayer = (): LeaderboardEntry | null =>
    args.dashboardState.leaderboard.reduce<LeaderboardEntry | null>((best, entry) => {
      const matches = entry.wins + entry.losses;
      if (matches <= 0) {
        return best;
      }

      const peakValue =
        args.dashboardState.segmentMode === "season" ? Number(entry.highestScore ?? 0) : Number(entry.highestElo ?? 0);
      if (peakValue <= 0) {
        return best;
      }
      if (!best) {
        return entry;
      }

      const bestPeakValue =
        args.dashboardState.segmentMode === "season"
          ? Number(best.highestScore ?? 0)
          : Number(best.highestElo ?? 0);
      if (peakValue !== bestPeakValue) {
        return peakValue > bestPeakValue ? entry : best;
      }

      const bestMatches = best.wins + best.losses;
      if (matches !== bestMatches) {
        return matches > bestMatches ? entry : best;
      }
      if (entry.wins !== best.wins) {
        return entry.wins > best.wins ? entry : best;
      }

      return entry.displayName.localeCompare(best.displayName) < 0 ? entry : best;
    }, null);

  return {
    syncDashboardState: (): void => {
      const statusMessage = args.dashboardState.error
        ? args.dashboardState.error
        : args.dashboardState.shareNotice || "";
      args.dom.dashboardStatus.textContent = statusMessage;
      args.dom.dashboardStatus.dataset.status = args.dashboardState.error ? "error" : "ready";
      args.dom.shareAlert.textContent = args.dashboardState.shareAlertMessage;
      args.dom.shareAlert.hidden = !Boolean(args.dashboardState.shareAlertMessage);

      args.dom.globalButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "global"));
      args.dom.seasonButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "season"));
      args.dom.tournamentButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "tournament"));
      args.dom.seasonButton.disabled = args.dashboardState.loading || args.dashboardState.seasons.length === 0;
      args.dom.tournamentButton.disabled = args.dashboardState.loading || args.dashboardState.tournaments.length === 0;

      args.dom.seasonSelect.hidden = args.dashboardState.segmentMode !== "season";
      args.dom.tournamentSelect.hidden = args.dashboardState.segmentMode !== "tournament";
      args.dom.seasonSelect.disabled = args.dashboardState.loading || args.dashboardState.seasons.length === 0;
      args.dom.tournamentSelect.disabled =
        args.dashboardState.loading || args.dashboardState.tournaments.length === 0;
      args.dom.refreshButton.disabled = args.dashboardState.loading || args.dashboardState.matchesLoading;
      args.dom.createMenuButton.disabled =
        args.dashboardState.loading || args.dashboardState.matchesLoading;
      args.dom.openCreateMatchButton.disabled =
        args.dashboardState.loading || args.dashboardState.matchesLoading;
      args.dom.openCreateTournamentButton.disabled =
        args.dashboardState.loading || args.dashboardState.matchesLoading;
      args.dom.openCreateSeasonButton.disabled =
        args.dashboardState.loading || args.dashboardState.matchesLoading;
      args.dom.tournamentMeta.textContent = args.t(
        args.tournamentPlannerState.tournamentId ? "tournamentMetaEditing" : "tournamentMeta",
      );
      const isSeasonEditingDraft = args.dashboardState.seasonDraftMode === "edit";
      args.dom.seasonMeta.textContent = args.t(isSeasonEditingDraft ? "seasonMetaEditing" : "seasonMeta");
      args.dom.closeCreateMatchButton.disabled = args.dashboardState.matchSubmitting;
      args.dom.closeCreateSeasonButton.disabled = args.dashboardState.seasonSubmitting;
      const seasonResetAction = args.dom.resetSeasonDraftButton.parentElement as HTMLElement | null;
      if (seasonResetAction) {
        seasonResetAction.hidden = !isSeasonEditingDraft;
      }
      args.dom.resetSeasonDraftButton.disabled = args.dashboardState.loading || args.dashboardState.seasonSubmitting;
      const isTournamentMatchDraft = Boolean(args.dom.formTournamentSelect.value);
      args.dom.suggestMatchButton.hidden = isTournamentMatchDraft;
      args.dom.suggestMatchButton.disabled =
        isTournamentMatchDraft || args.dashboardState.loading || args.dashboardState.matchSubmitting;
      args.dom.suggestMatchButton.textContent = args.t(
        args.dom.matchTypeSelect.value === "doubles" ? "suggestFairMatchDoubles" : "suggestFairMatchSingles",
      );
      const tournamentResetAction = args.dom.resetTournamentDraftButton.parentElement as HTMLElement | null;
      if (tournamentResetAction) {
        tournamentResetAction.hidden = !args.tournamentPlannerState.tournamentId;
      }
      args.dom.resetTournamentDraftButton.disabled =
        args.dashboardState.loading || args.dashboardState.tournamentSubmitting;
      args.dom.saveTournamentButton.disabled =
        args.dashboardState.loading ||
        args.dashboardState.tournamentSubmitting ||
        args.tournamentPlannerState.rounds.length === 0;
      args.dom.suggestTournamentButton.disabled =
        args.dashboardState.loading ||
        args.tournamentPlannerState.participantIds.length < 2 ||
        args.helpers.hasTournamentProgress();
      args.dom.loadMoreButton.disabled = args.dashboardState.matchesLoading;
      args.dom.loadMoreButton.hidden = !args.dashboardState.matchesCursor;

      args.dom.matchFilterButtons.forEach((button, filter) => {
        button.setAttribute("aria-pressed", String(args.dashboardState.matchesFilter === filter));
      });

      args.dom.composerStatus.textContent =
        args.dashboardState.matchFormError || args.dashboardState.matchFormMessage;
      args.dom.composerStatus.dataset.status = args.dashboardState.matchFormError ? "error" : "ready";
      const hasComposerStatus = Boolean(args.dashboardState.matchFormError || args.dashboardState.matchFormMessage);
      args.dom.composerStatus.hidden = !hasComposerStatus;
      args.dom.composerStatus.classList.toggle("share-alert--visible", hasComposerStatus);
      args.dom.seasonStatus.textContent = args.dashboardState.seasonFormError || args.dashboardState.seasonFormMessage;
      args.dom.seasonStatus.dataset.status = args.dashboardState.seasonFormError ? "error" : "ready";
      const hasSeasonStatus = Boolean(args.dashboardState.seasonFormError || args.dashboardState.seasonFormMessage);
      args.dom.seasonStatus.hidden = !hasSeasonStatus;
      args.dom.seasonStatus.classList.toggle("share-alert--visible", hasSeasonStatus);
      args.dom.submitSeasonButton.textContent = args.dashboardState.seasonSubmitting
        ? `${args.t("saveButtonLabel")}...`
        : isSeasonEditingDraft
          ? args.t("saveButtonLabel")
          : args.t("createSeason");
      args.dom.submitMatchButton.textContent =
        args.dashboardState.matchSubmitting ? `${args.t("saveButtonLabel")}...` : args.t("createMatch");
      args.dom.saveTournamentButton.textContent = args.dashboardState.tournamentSubmitting
        ? `${args.t("saveButtonLabel")}...`
        : args.tournamentPlannerState.tournamentId
          ? args.t("saveButtonLabel")
          : args.t("saveTournament");
      args.dom.tournamentStatus.textContent =
        args.tournamentPlannerState.error || args.dashboardState.tournamentFormMessage;
      args.dom.tournamentStatus.dataset.status = args.tournamentPlannerState.error ? "error" : "ready";
      const hasTournamentStatus = Boolean(args.tournamentPlannerState.error || args.dashboardState.tournamentFormMessage);
      args.dom.tournamentStatus.hidden = !hasTournamentStatus;
      args.dom.tournamentStatus.classList.toggle("share-alert--visible", hasTournamentStatus);
      const currentUserId = args.helpers.getCurrentUserId();
      const editingSeason = args.helpers.getEditingSeason();
      const seasonLocked = args.helpers.isLockedSeason(editingSeason);
      args.dom.deleteSeasonButton.hidden =
        !args.helpers.canSoftDelete(editingSeason ?? {}, currentUserId) || seasonLocked;
      args.dom.deleteTournamentButton.hidden = !args.helpers.canSoftDelete(
        args.helpers.getEditingTournament() ?? {},
        currentUserId,
      );

      args.helpers.scheduleFormStatusHide(
        "match",
        Boolean(args.dashboardState.matchFormError || args.dashboardState.matchFormMessage),
      );
      args.helpers.scheduleFormStatusHide(
        "season",
        Boolean(args.dashboardState.seasonFormError || args.dashboardState.seasonFormMessage),
      );
      args.helpers.scheduleFormStatusHide(
        "tournament",
        Boolean(args.tournamentPlannerState.error || args.dashboardState.tournamentFormMessage),
      );

      const seasonEditable = !seasonLocked;
      const seasonEndDateEditable = !seasonLocked;
      args.dom.seasonLockNotice.hidden = !seasonLocked;
      if (editingSeason) {
        args.dom.seasonLockNotice.textContent =
          editingSeason.status === "deleted" ? args.t("seasonLockDeleted") : args.t("seasonLockCompleted");
      }
      const setButtonsDisabled = (toggle: HTMLElement | null, disabled: boolean): void => {
        if (!toggle) {
          return;
        }
        toggle.querySelectorAll<HTMLButtonElement>("button[data-value]").forEach((button) => {
          button.disabled = disabled;
        });
      };
      args.dom.seasonNameInput.disabled = !seasonEditable;
      args.dom.seasonStartDateInput.disabled = !seasonEditable;
      args.dom.seasonEndDateInput.disabled = !seasonEndDateEditable;
      args.dom.seasonBaseEloSelect.disabled = !seasonEditable;
      args.dom.seasonIsActiveInput.disabled = !seasonEditable;
      args.dom.seasonIsPublicInput.disabled = !seasonEditable;
      args.dom.seasonSelectAllParticipantsInput.disabled = !seasonEditable;
      args.dom.loadSeasonSelect.disabled = args.dashboardState.loading;
      args.dom.resetSeasonDraftButton.disabled = args.dashboardState.loading || args.dashboardState.seasonSubmitting;
      args.dom.submitSeasonButton.disabled = args.dashboardState.loading || args.dashboardState.seasonSubmitting || seasonLocked;
      setButtonsDisabled(args.dom.seasonStateToggle, !seasonEditable);
      setButtonsDisabled(args.dom.seasonBaseEloToggle, !seasonEditable);
      setButtonsDisabled(args.dom.seasonVisibilityToggle, !seasonEditable);
      args.dom.deleteSeasonButton.disabled = seasonLocked;

      const editingTournament = args.helpers.getEditingTournament();
      const tournamentLocked = args.helpers.isLockedTournament(editingTournament);
      args.dom.deleteTournamentButton.hidden =
        !args.helpers.canSoftDelete(editingTournament ?? {}, currentUserId) || tournamentLocked;
      args.dom.tournamentLockNotice.hidden = !args.helpers.isLockedTournament(editingTournament);
      if (editingTournament) {
        args.dom.tournamentLockNotice.textContent =
          editingTournament.status === "deleted"
            ? args.t("tournamentLockDeleted")
            : args.t("tournamentLockCompleted");
      }
      args.dom.tournamentNameInput.disabled = tournamentLocked;
      args.dom.tournamentDateInput.disabled = tournamentLocked;
      args.dom.tournamentSeasonSelect.disabled = tournamentLocked;
      args.dom.tournamentSelectAllParticipantsInput.disabled = tournamentLocked;
      args.dom.loadTournamentSelect.disabled = args.dashboardState.loading;
      args.dom.resetTournamentDraftButton.disabled =
        args.dashboardState.loading || args.dashboardState.tournamentSubmitting;
      args.dom.saveTournamentButton.disabled =
        args.dashboardState.loading ||
        args.dashboardState.tournamentSubmitting ||
        args.tournamentPlannerState.rounds.length === 0 ||
        tournamentLocked;
      args.dom.suggestTournamentButton.disabled =
        args.dashboardState.loading ||
        args.tournamentPlannerState.participantIds.length < 2 ||
        args.helpers.hasTournamentProgress() ||
        tournamentLocked;
      args.dom.deleteTournamentButton.disabled = tournamentLocked;

      args.renderers.leaderboard.render();

      const leaderboardStats = args.dashboardState.leaderboardStats;
      const isTournamentMode = args.dashboardState.segmentMode === "tournament";
      const busiestPlayer = !isTournamentMode ? leaderboardStats?.mostMatchesPlayer ?? null : null;
      const mostWinsPlayer = !isTournamentMode ? leaderboardStats?.mostWinsPlayer ?? null : null;
      const bestWinRatePlayer = !isTournamentMode ? getBestWinRatePlayer() : null;
      const longestStreakPlayer = !isTournamentMode ? getLongestStreakPlayer() : null;
      const highestPeakPlayer = !isTournamentMode ? getHighestPeakPlayer() : null;

      const showStats =
        Boolean(leaderboardStats?.totalMatches) ||
        Boolean(busiestPlayer) ||
        Boolean(mostWinsPlayer) ||
        Boolean(highestPeakPlayer) ||
        Boolean(bestWinRatePlayer) ||
        Boolean(longestStreakPlayer);
      args.dom.leaderboardStatsGroup.hidden = !showStats;

      if (leaderboardStats?.totalMatches !== undefined) {
        args.dom.leaderboardMatchesSummaryValue.textContent = formatCount(leaderboardStats.totalMatches);
        args.dom.leaderboardMatchesSummary.hidden = false;
      } else {
        args.dom.leaderboardMatchesSummary.hidden = true;
      }

      if (!isTournamentMode && busiestPlayer && busiestPlayer.matchesPlayed > 0) {
        args.dom.leaderboardStatMostActivePlayer.textContent = busiestPlayer.displayName;
        args.dom.leaderboardStatMostActiveMeta.textContent = ` • 👏 ${formatCount(
          busiestPlayer.matchesPlayed,
        )} ${args.t("progressMatchesLabel")}`;
        args.dom.leaderboardStatMostActive.hidden = false;
      } else {
        args.dom.leaderboardStatMostActive.hidden = true;
      }

      if (longestStreakPlayer) {
        args.dom.leaderboardStatLongestStreakLabel.textContent = args.t("leaderboardLongestStreakLabel");
        args.dom.leaderboardStatLongestStreakPlayer.textContent = longestStreakPlayer.displayName;
        args.dom.leaderboardStatLongestStreakMeta.textContent = ` • 🏆 ${longestStreakPlayer.bestWinStreak ?? 0} ${args.t(
          "leaderboardWins",
        )} streak`;
        args.dom.leaderboardStatLongestStreak.hidden = false;
      } else {
        args.dom.leaderboardStatLongestStreak.hidden = true;
      }

      if (highestPeakPlayer) {
        const isSeasonMode = args.dashboardState.segmentMode === "season";
        const peakValue = isSeasonMode
          ? Number(highestPeakPlayer.highestScore ?? 0)
          : Number(highestPeakPlayer.highestElo ?? 0);
        args.dom.leaderboardStatHighestPeakLabel.textContent = args.t(
          isSeasonMode ? "leaderboardHighestScoreLabel" : "leaderboardHighestEloLabel",
        );
        args.dom.leaderboardStatHighestPeakPlayer.textContent = highestPeakPlayer.displayName;
        args.dom.leaderboardStatHighestPeakMeta.textContent = ` • 📈 ${formatCount(peakValue)} ${args.t(
          isSeasonMode ? "leaderboardSeasonScore" : "progressElo",
        )}`;
        args.dom.leaderboardStatHighestPeak.hidden = false;
      } else {
        args.dom.leaderboardStatHighestPeak.hidden = true;
      }

      if (!isTournamentMode && mostWinsPlayer && mostWinsPlayer.wins > 0) {
        args.dom.leaderboardStatMostWinsPlayer.textContent = mostWinsPlayer.displayName;
        args.dom.leaderboardStatMostWinsMeta.textContent = ` • 🔥 ${formatCount(
          mostWinsPlayer.wins,
        )} ${args.t("leaderboardWins")}`;
        args.dom.leaderboardStatMostWins.hidden = false;
      } else {
        args.dom.leaderboardStatMostWins.hidden = true;
      }

      if (bestWinRatePlayer) {
        args.dom.leaderboardStatBestWinRatePlayer.textContent = bestWinRatePlayer.entry.displayName;
        args.dom.leaderboardStatBestWinRateMeta.textContent = ` • 🎯 ${(bestWinRatePlayer.rate * 100).toFixed(1)}% • ${formatCount(
          bestWinRatePlayer.matches,
        )} ${args.t("progressMatchesLabel")}`;
        args.dom.leaderboardStatBestWinRate.hidden = false;
      } else {
        args.dom.leaderboardStatBestWinRate.hidden = true;
      }

      args.renderers.matches.render();
      args.renderers.progress.render();

      args.sharePanels.updateSeasonSharePanelVisibility();
      if (args.sharePanels.season) {
        args.sharePanels.updateSharePanelElements(
          args.sharePanels.season,
          "season",
          args.sharePanels.getSeasonShareTargetId(),
          args.sharePanels.getSeasonSharePanelRenderedUrl(),
          args.sharePanels.setSeasonSharePanelRenderedUrl,
        );
      }

      args.sharePanels.updateTournamentSharePanelVisibility();
      if (args.sharePanels.tournament) {
        args.sharePanels.updateSharePanelElements(
          args.sharePanels.tournament,
          "tournament",
          args.sharePanels.getTournamentShareTargetId(),
          args.sharePanels.getTournamentSharePanelRenderedUrl(),
          args.sharePanels.setTournamentSharePanelRenderedUrl,
        );
      }

      args.helpers.renderSeasonDraftSummary();
      args.helpers.renderTournamentDraftSummary();
      args.helpers.renderMatchDraftSummary();
      args.helpers.syncMatchFormLockState();
    },
  };
};
