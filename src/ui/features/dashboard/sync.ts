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
  suggestMatchButton: HTMLButtonElement;
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
  seasonStartDateInput: HTMLInputElement;
  seasonLockNotice: HTMLElement;
  tournamentLockNotice: HTMLElement;
  leaderboardStatsGroup: HTMLElement;
  leaderboardMatchesSummary: HTMLElement;
  leaderboardMatchesSummaryValue: HTMLElement;
  leaderboardStatMostActive: HTMLElement;
  leaderboardStatMostActivePlayer: HTMLElement;
  leaderboardStatMostActiveMeta: HTMLElement;
  leaderboardStatLongestStreak: HTMLElement;
  leaderboardStatLongestStreakPlayer: HTMLElement;
  leaderboardStatLongestStreakMeta: HTMLElement;
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
  const getLongestStreakPlayer = (): LeaderboardEntry | null =>
    args.dashboardState.leaderboard.reduce<LeaderboardEntry | null>((best, entry) => {
      if (entry.streak > 0 && (!best || entry.streak > best.streak)) {
        return entry;
      }
      return best;
    }, null);

  return {
    syncDashboardState: (): void => {
      const statusMessage = args.dashboardState.error
        ? args.dashboardState.error
        : args.dashboardState.loading
          ? "Refreshing..."
          : args.dashboardState.shareNotice || "";
      args.dom.dashboardStatus.textContent = statusMessage;
      args.dom.dashboardStatus.dataset.status = args.dashboardState.error ? "error" : "ready";
      args.dom.shareAlert.textContent = args.dashboardState.shareAlertMessage;
      args.dom.shareAlert.hidden = !Boolean(args.dashboardState.shareAlertMessage);

      args.dom.globalButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "global"));
      args.dom.seasonButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "season"));
      args.dom.tournamentButton.setAttribute("aria-pressed", String(args.dashboardState.segmentMode === "tournament"));

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
      args.dom.seasonMeta.textContent = args.t(
        args.dashboardState.editingSeasonId ? "seasonMetaEditing" : "seasonMeta",
      );
      args.dom.closeCreateMatchButton.disabled = args.dashboardState.matchSubmitting;
      args.dom.closeCreateSeasonButton.disabled = args.dashboardState.seasonSubmitting;
      const seasonResetAction = args.dom.resetSeasonDraftButton.parentElement as HTMLElement | null;
      if (seasonResetAction) {
        seasonResetAction.hidden = !args.dashboardState.editingSeasonId;
      }
      args.dom.resetSeasonDraftButton.disabled = args.dashboardState.loading || args.dashboardState.seasonSubmitting;
      args.dom.suggestMatchButton.disabled =
        args.dashboardState.loading || args.dashboardState.matchSubmitting;
      const tournamentResetAction = args.dom.resetTournamentDraftButton.parentElement as HTMLElement | null;
      if (tournamentResetAction) {
        tournamentResetAction.hidden = !args.tournamentPlannerState.tournamentId;
      }
      args.dom.resetTournamentDraftButton.disabled =
        args.dashboardState.loading || args.dashboardState.tournamentSubmitting;
      args.dom.saveTournamentButton.disabled =
        args.dashboardState.loading ||
        args.dashboardState.tournamentSubmitting ||
        args.tournamentPlannerState.rounds.length === 0 ||
        args.helpers.isLockedTournament(args.helpers.getEditingTournament());
      args.dom.suggestTournamentButton.disabled =
        args.dashboardState.loading ||
        args.tournamentPlannerState.participantIds.length < 2 ||
        args.helpers.hasTournamentProgress() ||
        args.helpers.isLockedTournament(args.helpers.getEditingTournament());
      args.dom.loadMoreButton.disabled = args.dashboardState.matchesLoading;
      args.dom.loadMoreButton.hidden = !args.dashboardState.matchesCursor;

      args.dom.matchFilterButtons.forEach((button, filter) => {
        button.setAttribute("aria-pressed", String(args.dashboardState.matchesFilter === filter));
      });

      args.dom.composerStatus.textContent =
        args.dashboardState.matchFormError || args.dashboardState.matchFormMessage;
      args.dom.composerStatus.dataset.status = args.dashboardState.matchFormError ? "error" : "ready";
      args.dom.seasonStatus.textContent = args.dashboardState.seasonFormError || args.dashboardState.seasonFormMessage;
      args.dom.seasonStatus.dataset.status = args.dashboardState.seasonFormError ? "error" : "ready";
      args.dom.submitSeasonButton.textContent = args.dashboardState.seasonSubmitting
        ? "Saving season..."
        : args.dashboardState.editingSeasonId
          ? args.t("saveButtonLabel")
          : args.t("createSeason");
      args.dom.submitMatchButton.textContent =
        args.dashboardState.matchSubmitting ? "Saving match..." : "Create match";
      args.dom.saveTournamentButton.textContent = args.dashboardState.tournamentSubmitting
        ? "Saving tournament..."
        : args.tournamentPlannerState.tournamentId
          ? args.t("saveButtonLabel")
          : args.t("saveTournament");
      args.dom.tournamentStatus.textContent =
        args.tournamentPlannerState.error || args.dashboardState.tournamentFormMessage;
      args.dom.tournamentStatus.dataset.status = args.tournamentPlannerState.error ? "error" : "ready";
      args.dom.seasonStartDateInput.disabled = Boolean(args.dashboardState.editingSeasonId);
      const currentUserId = args.helpers.getCurrentUserId();
      args.dom.deleteSeasonButton.hidden = !args.helpers.canSoftDelete(
        args.helpers.getEditingSeason() ?? {},
        currentUserId,
      );
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

      const editingSeason = args.helpers.getEditingSeason();
      args.dom.seasonLockNotice.hidden = !args.helpers.isLockedSeason(editingSeason);
      if (editingSeason) {
        args.dom.seasonLockNotice.textContent =
          editingSeason.status === "completed"
            ? args.t("seasonLockCompleted")
            : args.t("seasonLockDeleted");
      }

      const editingTournament = args.helpers.getEditingTournament();
      args.dom.tournamentLockNotice.hidden = !args.helpers.isLockedTournament(editingTournament);
      if (editingTournament) {
        args.dom.tournamentLockNotice.textContent =
          editingTournament.status === "completed"
            ? args.t("tournamentLockCompleted")
            : args.t("tournamentLockDeleted");
      }

      args.renderers.leaderboard.render();

      const leaderboardStats = args.dashboardState.leaderboardStats;
      const busiestPlayer = leaderboardStats?.mostMatchesPlayer ?? null;
      const longestStreakPlayer = getLongestStreakPlayer();

      const showStats =
        Boolean(leaderboardStats?.totalMatches) ||
        Boolean(busiestPlayer) ||
        Boolean(longestStreakPlayer);
      args.dom.leaderboardStatsGroup.hidden = !showStats;

      if (leaderboardStats?.totalMatches !== undefined) {
        args.dom.leaderboardMatchesSummaryValue.textContent = formatCount(leaderboardStats.totalMatches);
        args.dom.leaderboardMatchesSummary.hidden = false;
      } else {
        args.dom.leaderboardMatchesSummary.hidden = true;
      }

      if (busiestPlayer && busiestPlayer.matchesPlayed > 0) {
        args.dom.leaderboardStatMostActivePlayer.textContent = busiestPlayer.displayName;
        args.dom.leaderboardStatMostActiveMeta.textContent = ` • 🔥 ${formatCount(
          busiestPlayer.matchesPlayed,
        )} ${args.t("progressMatchesLabel")}`;
        args.dom.leaderboardStatMostActive.hidden = false;
      } else {
        args.dom.leaderboardStatMostActive.hidden = true;
      }

      if (longestStreakPlayer) {
        args.dom.leaderboardStatLongestStreakPlayer.textContent = longestStreakPlayer.displayName;
        args.dom.leaderboardStatLongestStreakMeta.textContent = ` • 🏆 ${longestStreakPlayer.streak} ${args.t(
          "leaderboardWins",
        )} streak`;
        args.dom.leaderboardStatLongestStreak.hidden = false;
      } else {
        args.dom.leaderboardStatLongestStreak.hidden = true;
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
