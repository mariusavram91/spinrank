import type {
  CreateSeasonPayload,
  DeactivateEntityData,
  SeasonRecord,
} from "../../../api/contract";
import type { SharePanelElements } from "../../shared/types/app";
import type { RunAuthedAction } from "../../shared/types/actions";

export const createSeasonActions = (args: {
  dashboardState: {
    seasonSubmitting: boolean;
    seasonFormError: string;
    seasonFormMessage: string;
    selectedSeasonId: string;
    editingSeasonId: string;
    editingSeasonParticipantIds: string[];
    screen: "dashboard" | "createMatch" | "createTournament" | "createSeason" | "faq" | "privacy";
  };
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  collectSeasonPayload: () => CreateSeasonPayload;
  runAuthedAction: RunAuthedAction;
  syncDashboardState: () => void;
  syncAuthState: () => void;
  setGlobalLoading: (active: boolean, label?: string) => void;
  loadDashboard: () => Promise<void>;
  refreshSegmentShareLink: (
    segmentType: "season" | "tournament",
    segmentId: string,
    panel: SharePanelElements | null,
  ) => Promise<void>;
  getSeasonSharePanelElements: () => SharePanelElements | null;
  setSeasonSharePanelTargetId: (segmentId: string) => void;
  resetSeasonForm: () => void;
  getEditingSeason: () => SeasonRecord | undefined;
  promptDeleteWarning: (request: {
    context: "season";
    detail: () => string | null;
    confirmationValue: string;
  }) => Promise<boolean>;
  formatDate: (value: string) => string;
}) => ({
  submitSeason: async (): Promise<void> => {
    args.dashboardState.seasonSubmitting = true;
    args.dashboardState.seasonFormError = "";
    args.dashboardState.seasonFormMessage = "";
    args.syncDashboardState();

    try {
      if (!args.seasonNameInput.value.trim()) {
        throw new Error("Season name is required.");
      }
      if (!args.seasonStartDateInput.value) {
        throw new Error("Season start date is required.");
      }
      if (
        args.seasonEndDateInput.value &&
        args.seasonEndDateInput.value < args.seasonStartDateInput.value
      ) {
        throw new Error("Season end date cannot be earlier than the start date.");
      }
      args.setGlobalLoading(true, "Saving season...");
      const payload = args.collectSeasonPayload();
      const data = await args.runAuthedAction("createSeason", payload);
      args.dashboardState.seasonFormMessage = `${
        args.dashboardState.editingSeasonId ? "Season updated" : "Season created"
      } and added to the dashboard.`;
      args.dashboardState.selectedSeasonId = data.season.id;
      args.dashboardState.editingSeasonId = data.season.id;
      args.dashboardState.editingSeasonParticipantIds = [...payload.participantIds];
      args.dashboardState.screen = "createSeason";
      args.syncAuthState();
      args.setSeasonSharePanelTargetId(data.season.id);
      await args.loadDashboard();
      await args.refreshSegmentShareLink("season", data.season.id, args.getSeasonSharePanelElements());
    } catch (error) {
      args.dashboardState.seasonFormError =
        error instanceof Error ? error.message : "Failed to create season.";
    } finally {
      args.dashboardState.seasonSubmitting = false;
      args.setGlobalLoading(false);
      args.syncDashboardState();
    }
  },

  deleteSeason: async (): Promise<void> => {
    const season = args.getEditingSeason();
    if (!season) {
      return;
    }

    const confirmed = await args.promptDeleteWarning({
      context: "season",
      detail: () => {
        const rangeParts: string[] = [];
        if (season.startDate) {
          rangeParts.push(args.formatDate(season.startDate));
        }
        if (season.endDate) {
          rangeParts.push(args.formatDate(season.endDate));
        }
        const rangeLabel = rangeParts.join(" – ");
        return rangeLabel ? `${season.name} • ${rangeLabel}` : season.name;
      },
      confirmationValue: season.name,
    });

    if (!confirmed) {
      return;
    }

    try {
      args.setGlobalLoading(true, "Deleting season and recalculating rankings...");
      const data: DeactivateEntityData = await args.runAuthedAction("deactivateSeason", {
        id: season.id,
        reason: "Deleted from the web app",
      });
      args.dashboardState.seasonFormMessage = data.status === "deleted"
        ? "Season deleted and rankings recalculated."
        : "";
      args.dashboardState.screen = "dashboard";
      args.resetSeasonForm();
      await args.loadDashboard();
    } catch (error) {
      args.dashboardState.seasonFormError = error instanceof Error ? error.message : "Could not delete season.";
      args.syncDashboardState();
    } finally {
      args.setGlobalLoading(false);
    }
  },
});
