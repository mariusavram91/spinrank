import type { SegmentType } from "../../../api/contract";
import type { SharePanelElements } from "../../shared/types/app";

export const createDashboardSelectors = <TSeason, TTournament>(args: {
  dashboardState: {
    selectedSeasonId: string;
    selectedTournamentId: string;
    editingSeasonId: string;
    seasons: TSeason[];
    tournaments: TTournament[];
  };
  tournamentPlannerState: {
    tournamentId: string;
  };
  getSeasonId: (season: TSeason) => string;
  getTournamentId: (tournament: TTournament) => string;
  setGlobalLoadingDom: (active: boolean, label: string) => void;
  t: (key: "loadingOverlay") => string;
}) => ({
  setGlobalLoading: (active: boolean, label = args.t("loadingOverlay")): void => {
    args.setGlobalLoadingDom(active, label);
  },
  getSelectedSeason: (): TSeason | undefined =>
    args.dashboardState.seasons.find((season) => args.getSeasonId(season) === args.dashboardState.selectedSeasonId),
  getSelectedTournament: (): TTournament | undefined =>
    args.dashboardState.tournaments.find(
      (tournament) => args.getTournamentId(tournament) === args.dashboardState.selectedTournamentId,
    ),
  getEditingSeason: (): TSeason | undefined =>
    args.dashboardState.seasons.find((season) => args.getSeasonId(season) === args.dashboardState.editingSeasonId),
  getEditingTournament: (): TTournament | undefined =>
    args.dashboardState.tournaments.find(
      (tournament) => args.getTournamentId(tournament) === args.tournamentPlannerState.tournamentId,
    ),
});

export const createFormStatusOrchestration = (args: {
  dashboardState: {
    profileFormMessage: string;
    matchFormError: string;
    matchFormMessage: string;
    seasonFormError: string;
    seasonFormMessage: string;
    tournamentFormMessage: string;
  };
  tournamentPlannerState: {
    error: string;
  };
  syncDashboardState: () => void;
}) => {
  const statusHideTimers: Record<"profile" | "match" | "season" | "tournament", number | null> = {
    profile: null,
    match: null,
    season: null,
    tournament: null,
  };

  const clearFormStatus = (target: "profile" | "match" | "season" | "tournament"): void => {
    if (target === "profile") {
      args.dashboardState.profileFormMessage = "";
      return;
    }
    if (target === "match") {
      args.dashboardState.matchFormError = "";
      args.dashboardState.matchFormMessage = "";
      return;
    }
    if (target === "season") {
      args.dashboardState.seasonFormError = "";
      args.dashboardState.seasonFormMessage = "";
      return;
    }
    args.dashboardState.tournamentFormMessage = "";
    args.tournamentPlannerState.error = "";
  };

  const scheduleFormStatusHide = (target: "profile" | "match" | "season" | "tournament", visible: boolean): void => {
    if (statusHideTimers[target]) {
      window.clearTimeout(statusHideTimers[target]!);
      statusHideTimers[target] = null;
    }

    if (!visible) {
      return;
    }

    statusHideTimers[target] = window.setTimeout(() => {
      clearFormStatus(target);
      statusHideTimers[target] = null;
      args.syncDashboardState();
    }, 5000);
  };

  return {
    clearFormStatus,
    scheduleFormStatusHide,
  };
};

export const createShareOrchestration = (args: {
  dashboardState: {
    sharePanelSeasonTargetId: string;
    sharePanelTournamentTargetId: string;
    shareErrors: Record<string, string>;
    shareLoadingSegmentKey: string;
    shareCache: Record<string, { url: string }>;
    shareNotice: string;
    shareAlertMessage: string;
  };
  syncDashboardState: () => void;
  renderShareQr: (canvas: HTMLCanvasElement, value: string) => Promise<void>;
  t: (
    key:
      | "shareExpired"
      | "shareExpiresInDays"
      | "shareExpiresInHours"
      | "shareExpiresInMinutes"
      | "shareNoSegment",
  ) => string;
  setShareAlertVisible: (visible: boolean) => void;
}) => {
  let shareNoticeTimer: number | null = null;
  let shareAlertTimer: number | null = null;

  const buildSegmentShareKey = (segmentType: SegmentType, segmentId: string): string =>
    `${segmentType}:${segmentId}`;

  const getSeasonShareTargetId = (): string => args.dashboardState.sharePanelSeasonTargetId || "";
  const getTournamentShareTargetId = (): string => args.dashboardState.sharePanelTournamentTargetId || "";

  const setSeasonSharePanelTargetId = (segmentId: string): void => {
    args.dashboardState.sharePanelSeasonTargetId = segmentId;
    args.syncDashboardState();
  };

  const setTournamentSharePanelTargetId = (segmentId: string): void => {
    args.dashboardState.sharePanelTournamentTargetId = segmentId;
    args.syncDashboardState();
  };

  const formatShareExpiration = (expiresAt: string): string => {
    if (!expiresAt) {
      return "";
    }
    const expires = Date.parse(expiresAt);
    if (Number.isNaN(expires)) {
      return "";
    }
    const diffMs = expires - Date.now();
    if (diffMs <= 0) {
      return args.t("shareExpired");
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days >= 1) {
      return args.t("shareExpiresInDays").replace("{days}", String(days));
    }
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 1) {
      return args.t("shareExpiresInHours").replace("{hours}", String(hours));
    }
    const minutes = Math.ceil(diffMs / (1000 * 60));
    return args.t("shareExpiresInMinutes").replace("{minutes}", String(minutes));
  };

  const animateSharePanel = (panel: SharePanelElements): void => {
    panel.section.classList.add("share-panel--pulse");
    if (panel.animationTimer) {
      window.clearTimeout(panel.animationTimer);
    }
    panel.animationTimer = window.setTimeout(() => {
      panel.section.classList.remove("share-panel--pulse");
      panel.animationTimer = null;
    }, 700);
  };

  const updateSharePanelElements = (
    elements: SharePanelElements,
    segmentType: SegmentType,
    targetId: string,
    renderedUrl: string,
    setRenderedUrl: (value: string) => void,
  ): void => {
    const key = buildSegmentShareKey(segmentType, targetId);
    const shareInfo = targetId ? args.dashboardState.shareCache[key] : null;
    const error = args.dashboardState.shareErrors[key];
    const isLoading = args.dashboardState.shareLoadingSegmentKey === key;
    elements.createButton.disabled = !targetId || isLoading;
    elements.copyButton.disabled = !Boolean(shareInfo?.url);
    const statusMessage = error || (targetId ? "" : args.t("shareNoSegment"));
    elements.status.textContent = statusMessage;
    elements.status.dataset.status = error ? "error" : "ready";
    elements.qrWrapper.hidden = !Boolean(shareInfo?.url);
    if (shareInfo && shareInfo.url && (shareInfo.url !== renderedUrl || elements.qrCanvas.hidden)) {
      setRenderedUrl(shareInfo.url);
      void args.renderShareQr(elements.qrCanvas, shareInfo.url);
    } else if (!shareInfo) {
      setRenderedUrl("");
      elements.qrCanvas.hidden = true;
    }
  };

  const showShareNotice = (message: string): void => {
    args.dashboardState.shareNotice = message;
    if (shareNoticeTimer) {
      window.clearTimeout(shareNoticeTimer);
      shareNoticeTimer = null;
    }
    if (message) {
      shareNoticeTimer = window.setTimeout(() => {
        args.dashboardState.shareNotice = "";
        shareNoticeTimer = null;
        args.syncDashboardState();
      }, 5000);
    }
    args.syncDashboardState();
  };

  const showShareAlert = (message: string): void => {
    args.dashboardState.shareAlertMessage = message;
    args.setShareAlertVisible(Boolean(message));
    if (shareAlertTimer) {
      window.clearTimeout(shareAlertTimer);
      shareAlertTimer = null;
    }
    if (message) {
      shareAlertTimer = window.setTimeout(() => {
        args.dashboardState.shareAlertMessage = "";
        shareAlertTimer = null;
        args.setShareAlertVisible(false);
        args.syncDashboardState();
      }, 6000);
    }
    showShareNotice(message);
    args.syncDashboardState();
  };

  return {
    buildSegmentShareKey,
    getSeasonShareTargetId,
    getTournamentShareTargetId,
    setSeasonSharePanelTargetId,
    setTournamentSharePanelTargetId,
    formatShareExpiration,
    animateSharePanel,
    updateSharePanelElements,
    showShareNotice,
    showShareAlert,
  };
};
