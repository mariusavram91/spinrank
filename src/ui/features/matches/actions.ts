import type {
  CreateMatchDisputeData,
  CreateMatchPayload,
  DeactivateEntityData,
  MatchRecord,
  RemoveMatchDisputeData,
  SeasonRecord,
  TournamentRecord,
  LeaderboardEntry,
} from "../../../api/contract";
import type { RunAuthedAction } from "../../shared/types/actions";
import type { MatchDraft } from "../../shared/types/app";

export const createMatchActions = (args: {
  dashboardState: {
    matchSubmitting: boolean;
    matchFormError: string;
    matchFormMessage: string;
    pendingCreateRequestId: string;
    matchDraft: MatchDraft | null;
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
    highlightedMatchId: string;
    highlightedMatchIds: string[];
    pendingHighlightedMatchIds: string[];
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
  captureMatchDraft: () => MatchDraft;
  resetScoreInputs: () => void;
  clearActiveTournamentBracketMatchId: () => void;
  setTournamentPlannerTournamentId: (tournamentId: string) => void;
  setLoadTournamentSelectValue: (value: string) => void;
  promptDeleteWarning: (request: {
    context: "match";
    detail: () => string | null;
  }) => Promise<boolean>;
  promptMatchDuplicateWarning: (items: Array<{
    players: string;
    score: string;
    context: string;
    playedAt: string;
    createdBy: string;
  }>) => Promise<"cancel" | "review" | "confirm">;
  promptMatchDisputeReason: (request: { title: string; detail?: string; initialComment?: string }) => Promise<string | null>;
  applyMatchFilter: (
    filter: "recent" | "mine" | "all",
    options?: { force?: boolean; ensureMatchIds?: string[] },
  ) => Promise<void>;
  renderMatchContext: (
    match: MatchRecord,
    seasons: SeasonRecord[],
    tournaments: TournamentRecord[],
    bracketContext: { roundTitle: string; isFinal: boolean } | null,
    options?: { includeRound?: boolean },
  ) => string;
  renderMatchScore: (match: MatchRecord) => string;
  renderPlayerNames: (playerIds: string[], players: LeaderboardEntry[]) => string;
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
      let payload = args.collectMatchPayload();
      const duplicateMatches = await args.runAuthedAction("checkMatchDuplicate", payload);
      if (duplicateMatches.matches.length > 0) {
        const decision = await args.promptMatchDuplicateWarning(
          duplicateMatches.matches.map((match) => {
            const contextLabel = args.renderMatchContext(
              match,
              args.dashboardState.seasons,
              args.dashboardState.tournaments,
              args.dashboardState.matchBracketContextByMatchId[match.id] ?? match.bracketContext ?? null,
            );
            return {
              players: `${args.renderPlayerNames(match.teamAPlayerIds, duplicateMatches.players ?? [])} vs ${args.renderPlayerNames(match.teamBPlayerIds, duplicateMatches.players ?? [])}`,
              score: args.renderMatchScore(match),
              context: contextLabel || "Open play",
              playedAt: args.formatDateTime(match.playedAt),
              createdBy: match.createdByDisplayName,
            };
          }),
        );
        if (decision === "cancel") {
          return;
        }
        if (decision === "review") {
          args.dashboardState.matchDraft = args.captureMatchDraft();
          const highlightedMatchIds = duplicateMatches.matches.map((match) => match.id);
          args.dashboardState.highlightedMatchIds = highlightedMatchIds;
          args.dashboardState.highlightedMatchId = highlightedMatchIds[0] || "";
          args.dashboardState.pendingHighlightedMatchIds = highlightedMatchIds;
          args.dashboardState.screen = "dashboard";
          args.dashboardState.matchFormMessage = "Unsaved draft kept while you review the possible duplicate.";
          args.syncDashboardState();
          void args.applyMatchFilter("mine", {
            force: true,
            ensureMatchIds: highlightedMatchIds,
          }).then(() => {
            args.syncDashboardState();
          });
          return;
        }
        payload = {
          ...payload,
          ignoreDuplicateWarning: true,
        };
      }

      args.setGlobalLoading(true, "Saving match...");
      const returnToTournamentId = payload.tournamentId || null;
      const returnToTournament = Boolean(payload.tournamentBracketMatchId && returnToTournamentId);
      const data = await args.runAuthedAction(
        "createMatch",
        payload,
        args.dashboardState.pendingCreateRequestId,
      );
      args.dashboardState.matchFormMessage = `Match created for ${args.formatDateTime(data.match.playedAt)}.`;
      args.dashboardState.pendingCreateRequestId = "";
      args.dashboardState.matchDraft = null;
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

  disputeMatch: async (match: MatchRecord): Promise<void> => {
    const comment = await args.promptMatchDisputeReason({
      title: "Dispute match",
      detail: [args.renderMatchScore(match), args.formatDateTime(match.playedAt)].filter(Boolean).join(" • "),
      initialComment: match.currentUserDispute?.comment || "",
    });
    if (!comment) {
      return;
    }

    try {
      args.setGlobalLoading(true, "Saving dispute...");
      const data: CreateMatchDisputeData = await args.runAuthedAction("createMatchDispute", {
        matchId: match.id,
        comment: comment.trim(),
      });
      args.dashboardState.matchFormMessage = data.dispute.status === "active" ? "Match disputed." : "";
      await args.loadDashboard();
    } catch (error) {
      args.dashboardState.error = error instanceof Error ? error.message : "Could not dispute match.";
      args.syncDashboardState();
    } finally {
      args.setGlobalLoading(false);
    }
  },

  removeMatchDispute: async (match: MatchRecord): Promise<void> => {
    try {
      args.setGlobalLoading(true, "Removing dispute...");
      const data: RemoveMatchDisputeData = await args.runAuthedAction("removeMatchDispute", {
        matchId: match.id,
      });
      args.dashboardState.matchFormMessage = data.removed ? "Match dispute removed." : "";
      await args.loadDashboard();
    } catch (error) {
      args.dashboardState.error = error instanceof Error ? error.message : "Could not remove dispute.";
      args.syncDashboardState();
    } finally {
      args.setGlobalLoading(false);
    }
  },
});
