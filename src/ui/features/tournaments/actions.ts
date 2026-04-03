import type {
  CreateTournamentPayload,
  DeactivateEntityData,
  GetTournamentBracketData,
  TournamentBracketRound,
  TournamentRecord,
} from "../../../api/contract";
import type { DashboardState, SharePanelElements, TournamentPlannerState } from "../../shared/types/app";
import type { RunAuthedAction } from "../../shared/types/actions";

export const createTournamentActions = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  tournamentSeasonSelect: HTMLSelectElement;
  loadTournamentSelect: HTMLSelectElement;
  runAuthedAction: RunAuthedAction;
  syncDashboardState: () => void;
  renderTournamentPlanner: () => void;
  setGlobalLoading: (active: boolean, label?: string) => void;
  loadDashboard: () => Promise<void>;
  refreshSegmentShareLink: (
    segmentType: "season" | "tournament",
    segmentId: string,
    panel: SharePanelElements | null,
  ) => Promise<void>;
  getTournamentSharePanelElements: () => SharePanelElements | null;
  setTournamentSharePanelTargetId: (segmentId: string) => void;
  getEditingTournament: () => TournamentRecord | undefined;
  populateTournamentPlannerLoadOptions: () => void;
  promptDeleteWarning: (request: {
    context: "tournament";
    detail: () => string | null;
  }) => Promise<boolean>;
  formatDate: (value: string) => string;
}) => ({
  loadTournamentBracket: async (): Promise<void> => {
    if (!args.tournamentPlannerState.tournamentId) {
      args.tournamentPlannerState.error = "Select a saved tournament first.";
      args.renderTournamentPlanner();
      args.syncDashboardState();
      return;
    }

    try {
      const data: GetTournamentBracketData = await args.runAuthedAction("getTournamentBracket", {
        tournamentId: args.tournamentPlannerState.tournamentId,
      });

      args.tournamentPlannerState.name = data.tournament.name;
      args.tournamentNameInput.value = data.tournament.name;
      args.tournamentDateInput.value = data.tournament.date;
      args.tournamentSeasonSelect.value = data.tournament.seasonId || "";
      args.tournamentPlannerState.participantIds = data.participantIds;
      args.tournamentPlannerState.rounds = data.rounds.map((round) => ({
        title: round.title,
        matches: round.matches.map((match) => ({
          id: match.id,
          leftPlayerId: match.leftPlayerId,
          rightPlayerId: match.rightPlayerId,
          createdMatchId: match.createdMatchId,
          winnerPlayerId: match.winnerPlayerId,
          locked: match.locked,
          isFinal: match.isFinal,
        })),
      }));
      args.tournamentPlannerState.firstRoundMatches = args.tournamentPlannerState.rounds[0]
        ? args.tournamentPlannerState.rounds[0].matches
        : [];
      args.tournamentPlannerState.error = "";
      args.renderTournamentPlanner();
      args.syncDashboardState();
      args.setTournamentSharePanelTargetId(data.tournament.id);
      void args.refreshSegmentShareLink("tournament", data.tournament.id, args.getTournamentSharePanelElements());
    } catch (error) {
      args.tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to load tournament.";
      args.renderTournamentPlanner();
      args.syncDashboardState();
    }
  },

  saveTournament: async (): Promise<void> => {
    args.dashboardState.tournamentSubmitting = true;
    args.dashboardState.tournamentFormMessage = "";
    args.syncDashboardState();
    try {
      if (args.tournamentPlannerState.participantIds.length < 2) {
        throw new Error("Select at least 2 participants.");
      }
      args.setGlobalLoading(true, "Saving tournament...");
      const payload: CreateTournamentPayload = {
        tournamentId: args.tournamentPlannerState.tournamentId || null,
        name: args.tournamentNameInput.value.trim() || "New tournament",
        date: args.tournamentDateInput.value || null,
        seasonId: args.tournamentSeasonSelect.value || null,
        participantIds: args.tournamentPlannerState.participantIds,
        rounds: args.tournamentPlannerState.rounds.map((round, roundIndex) => ({
          title: round.title,
          matches: round.matches.map((match) => ({
            id: match.id,
            leftPlayerId: match.leftPlayerId,
            rightPlayerId: match.rightPlayerId,
            createdMatchId: match.createdMatchId || null,
            winnerPlayerId: match.winnerPlayerId || null,
            locked: Boolean(match.locked),
            isFinal: Boolean(
              match.isFinal ?? roundIndex === args.tournamentPlannerState.rounds.length - 1,
            ),
          })),
        })) as TournamentBracketRound[],
      };
      const data = await args.runAuthedAction("createTournament", payload);
      args.tournamentPlannerState.tournamentId = data.tournament.id;
      args.tournamentPlannerState.name = data.tournament.name;
      args.dashboardState.tournamentFormMessage = "Tournament created";
      args.tournamentPlannerState.error = "";
      args.setTournamentSharePanelTargetId(data.tournament.id);
      await args.loadDashboard();
      await args.refreshSegmentShareLink("tournament", data.tournament.id, args.getTournamentSharePanelElements());
      args.populateTournamentPlannerLoadOptions();
      args.loadTournamentSelect.value = data.tournament.id;
      args.renderTournamentPlanner();
      args.syncDashboardState();
    } catch (error) {
      args.tournamentPlannerState.error =
        error instanceof Error ? error.message : "Failed to save tournament.";
      args.renderTournamentPlanner();
      args.syncDashboardState();
    } finally {
      args.dashboardState.tournamentSubmitting = false;
      args.setGlobalLoading(false);
    }
  },

  deleteTournament: async (): Promise<void> => {
    const tournament = args.getEditingTournament();
    if (!tournament) {
      return;
    }

    const confirmed = await args.promptDeleteWarning({
      context: "tournament",
      detail: () => {
        const dateLabel = tournament.date ? args.formatDate(tournament.date) : "";
        const detailParts = [tournament.name, dateLabel].filter(Boolean);
        return detailParts.join(" • ");
      },
    });

    if (!confirmed) {
      return;
    }

    try {
      args.setGlobalLoading(true, "Deleting tournament and recalculating rankings...");
      const data: DeactivateEntityData = await args.runAuthedAction("deactivateTournament", {
        id: tournament.id,
        reason: "Deleted from the web app",
      });
      args.dashboardState.tournamentFormMessage = data.status === "deleted"
        ? "Tournament deleted and rankings recalculated."
        : "";
      args.dashboardState.screen = "dashboard";
      args.tournamentPlannerState.tournamentId = "";
      args.setTournamentSharePanelTargetId("");
      args.tournamentPlannerState.rounds = [];
      args.tournamentPlannerState.firstRoundMatches = [];
      await args.loadDashboard();
    } catch (error) {
      args.tournamentPlannerState.error =
        error instanceof Error ? error.message : "Could not delete tournament.";
      args.syncDashboardState();
    } finally {
      args.setGlobalLoading(false);
    }
  },
});
