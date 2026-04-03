import type { DashboardState, SharePanelElements } from "../../shared/types/app";

export const createShareRuntime = (args: {
  dashboardState: DashboardState;
  seasonForm: HTMLFormElement;
  tournamentPanel: HTMLElement;
  getSeasonActionsWrapper: () => HTMLElement;
  getTournamentActionsWrapper: () => HTMLElement;
}) => {
  let seasonSharePanelMounted = false;
  let tournamentSharePanelMounted = false;
  let seasonCopyFeedbackTimer: number | null = null;
  let tournamentCopyFeedbackTimer: number | null = null;

  const renderShareQr = async (canvas: HTMLCanvasElement, value: string): Promise<void> => {
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    if (!value) {
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("QR canvas context unavailable."));
            return;
          }
          context.clearRect(0, 0, size, size);
          context.drawImage(image, 0, 0, size, size);
          resolve();
        };
        image.onerror = () => {
          reject(new Error("QR image failed to load."));
        };
        image.src =
          `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(value)}`;
      });
    } catch {
      canvas.hidden = true;
    }
  };

  const copyTextToClipboard = async (text: string): Promise<void> => {
    if (!text) {
      throw new Error("Nothing to copy.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const showCopyFeedback = (
    panel: "season" | "tournament",
    element: HTMLSpanElement,
    message: string,
  ): void => {
    if (panel === "season") {
      if (seasonCopyFeedbackTimer) {
        window.clearTimeout(seasonCopyFeedbackTimer);
      }
    } else if (panel === "tournament") {
      if (tournamentCopyFeedbackTimer) {
        window.clearTimeout(tournamentCopyFeedbackTimer);
      }
    }
    element.textContent = message;
    const timer = window.setTimeout(() => {
      element.textContent = "";
      if (panel === "season") {
        seasonCopyFeedbackTimer = null;
      } else {
        tournamentCopyFeedbackTimer = null;
      }
    }, 2000);
    if (panel === "season") {
      seasonCopyFeedbackTimer = timer;
    } else {
      tournamentCopyFeedbackTimer = timer;
    }
  };

  const updateSeasonSharePanelVisibility = (seasonSharePanelElements: SharePanelElements | null): void => {
    if (!seasonSharePanelElements) {
      return;
    }
    const hasSegment = Boolean(args.dashboardState.sharePanelSeasonTargetId);
    if (hasSegment && !seasonSharePanelMounted) {
      args.seasonForm.insertBefore(seasonSharePanelElements.section, args.getSeasonActionsWrapper());
      seasonSharePanelMounted = true;
    } else if (!hasSegment && seasonSharePanelMounted) {
      args.seasonForm.removeChild(seasonSharePanelElements.section);
      seasonSharePanelMounted = false;
    }
  };

  const updateTournamentSharePanelVisibility = (
    tournamentSharePanelElements: SharePanelElements | null,
  ): void => {
    if (!tournamentSharePanelElements) {
      return;
    }
    const hasSegment = Boolean(args.dashboardState.sharePanelTournamentTargetId);
    if (hasSegment && !tournamentSharePanelMounted) {
      args.tournamentPanel.insertBefore(tournamentSharePanelElements.section, args.getTournamentActionsWrapper());
      tournamentSharePanelMounted = true;
    } else if (!hasSegment && tournamentSharePanelMounted) {
      args.tournamentPanel.removeChild(tournamentSharePanelElements.section);
      tournamentSharePanelMounted = false;
    }
  };

  return {
    renderShareQr,
    copyTextToClipboard,
    showCopyFeedback,
    updateSeasonSharePanelVisibility,
    updateTournamentSharePanelVisibility,
  };
};
