import type {
  CreateMatchPayload,
  DeactivateEntityData,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
} from "../../../api/contract";
import type { RunAuthedAction } from "../../shared/types/actions";

export const createMatchActions = (args: {
  dashboardState: {
    matchSubmitting: boolean;
    matchFormError: string;
    matchFormMessage: string;
    pendingCreateRequestId: string;
    screen:
      | "dashboard"
      | "createMatch"
      | "createTournament"
      | "createSeason"
      | "profile"
      | "userProfile"
      | "faq"
      | "privacy";
    error: string;
    seasons: SeasonRecord[];
    tournaments: TournamentRecord[];
    matchBracketContextByMatchId: Record<string, { roundTitle: string; isFinal: boolean }>;
  };
  tournamentPlannerState: {
    tournamentId: string;
  };
  runAuthedAction: RunAuthedAction;
  syncDashboardState: () => void;
  syncAuthState: () => void;
  setGlobalLoading: (active: boolean, label?: string) => void;
  loadDashboard: () => Promise<void>;
  loadTournamentBracket: () => Promise<void>;
  collectMatchPayload: () => CreateMatchPayload;
  resetScoreInputs: () => void;
  clearActiveTournamentBracketMatchId: () => void;
  setTournamentPlannerTournamentId: (tournamentId: string) => void;
  setLoadTournamentSelectValue: (value: string) => void;
  promptDeleteWarning: (request: {
    context: "match";
    detail: () => string | null;
  }) => Promise<boolean>;
  renderMatchContext: (
    match: MatchRecord,
    seasons: SeasonRecord[],
    tournaments: TournamentRecord[],
    bracketContext: { roundTitle: string; isFinal: boolean } | null,
    options?: { includeRound?: boolean },
  ) => string;
  renderMatchScore: (match: MatchRecord) => string;
  formatDateTime: (value: string) => string;
}) => ({
  submitMatch: async (): Promise<void> => {
    args.dashboardState.matchSubmitting = true;
    args.dashboardState.matchFormError = "";
    args.dashboardState.matchFormMessage = "";
    if (!args.dashboardState.pendingCreateRequestId) {
      args.dashboardState.pendingCreateRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `match_${Date.now()}`;
    }
    args.syncDashboardState();

    try {
      args.setGlobalLoading(true, "Saving match...");
      const payload = args.collectMatchPayload();
      const returnToTournamentId = payload.tournamentId || null;
      const returnToTournament = Boolean(payload.tournamentBracketMatchId && returnToTournamentId);
      const data = await args.runAuthedAction(
        "createMatch",
        payload,
        args.dashboardState.pendingCreateRequestId,
      );
      args.dashboardState.matchFormMessage = `Match created for ${args.formatDateTime(data.match.playedAt)}.`;
      args.dashboardState.pendingCreateRequestId = "";
      args.resetScoreInputs();
      args.clearActiveTournamentBracketMatchId();
      args.dashboardState.screen = returnToTournament ? "createTournament" : "dashboard";
      args.syncAuthState();
      await args.loadDashboard();
      if (returnToTournamentId) {
        args.setTournamentPlannerTournamentId(returnToTournamentId);
        args.setLoadTournamentSelectValue(returnToTournamentId);
      }
      if (returnToTournament) {
        await args.loadTournamentBracket();
      }
    } catch (error) {
      args.dashboardState.matchFormError =
        error instanceof Error ? error.message : "Failed to create match.";
    } finally {
      args.dashboardState.matchSubmitting = false;
      args.setGlobalLoading(false);
      args.syncDashboardState();
    }
  },

  deleteMatch: async (match: MatchRecord): Promise<void> => {
    const confirmed = await args.promptDeleteWarning({
      context: "match",
      detail: () => {
        const contextLabel = args.renderMatchContext(
          match,
          args.dashboardState.seasons,
          args.dashboardState.tournaments,
          args.dashboardState.matchBracketContextByMatchId[match.id] ?? null,
        );
        const playedAtLabel = args.formatDateTime(match.playedAt);
        const scoreLabel = match.score.length > 0 ? args.renderMatchScore(match) : "";
        const detailParts = [scoreLabel, contextLabel, playedAtLabel].filter(Boolean);
        return detailParts.join(" • ");
      },
    });

    if (!confirmed) {
      return;
    }

    try {
      args.setGlobalLoading(true, "Deleting match and recalculating rankings...");
      const data: DeactivateEntityData = await args.runAuthedAction("deactivateMatch", {
        id: match.id,
        reason: "Deleted from the web app",
      });
      args.dashboardState.matchFormMessage = data.status === "deleted"
        ? "Match deleted and rankings recalculated."
        : "";
      await args.loadDashboard();
    } catch (error) {
      args.dashboardState.error = error instanceof Error ? error.message : "Could not delete match.";
      args.syncDashboardState();
    } finally {
      args.setGlobalLoading(false);
    }
  },
});
