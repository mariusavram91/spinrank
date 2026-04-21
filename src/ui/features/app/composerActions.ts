import type { DashboardState, TournamentPlannerMatch, TournamentPlannerState, ViewState } from "../../shared/types/app";
import type { MatchType } from "../../../api/contract";
import type { FairMatchCandidate } from "../matches/utils";

export const createComposerActions = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  getViewState: () => ViewState;
  isAuthedState: (state: ViewState) => state is Extract<ViewState, { status: "authenticated" }>;
  matchTypeSelect: HTMLSelectElement;
  formatTypeSelect: HTMLSelectElement;
  pointsToWinSelect: HTMLSelectElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  winnerTeamSelect: HTMLSelectElement;
  resetScoreInputs: () => void;
  populateMatchFormOptions: () => void;
  syncMatchBracketOptions: () => void;
  applySelectedTournamentBracketMatch: () => void;
  renderTournamentPlanner: () => void;
  syncAuthState: () => void;
  syncDashboardState: () => void;
  saveTournament: () => Promise<void>;
  setActiveTournamentBracketMatchId: (value: string | null) => void;
  getSuggestedMatchPlayers: () => Promise<FairMatchCandidate[]>;
  buildFairMatchSuggestion: (
    players: FairMatchCandidate[],
    sessionUserId: string,
    matchType: MatchType,
  ) => { teamAPlayerIds: string[]; teamBPlayerIds: string[] } | null;
  buildTournamentSuggestion: (
    players: DashboardState["players"],
    participantIds: string[],
  ) => { firstRoundMatches: TournamentPlannerState["firstRoundMatches"]; rounds: TournamentPlannerState["rounds"] } | null;
  applyTournamentWinnerLocally: (
    rounds: TournamentPlannerState["rounds"],
    roundIndex: number,
    matchIndex: number,
    winnerPlayerId: string,
  ) => TournamentPlannerState["rounds"];
}) => {
  const invalidateTournamentBracketCache = (tournamentId: string): void => {
    if (!tournamentId) {
      return;
    }
    delete args.dashboardState.matchTournamentBracketCache[tournamentId];
  };

  const applyFairMatchSuggestion = async (): Promise<void> => {
    const state = args.getViewState();
    if (!args.isAuthedState(state)) {
      return;
    }

    const suggestion = args.buildFairMatchSuggestion(
      await args.getSuggestedMatchPlayers(),
      state.session.user.id,
      args.matchTypeSelect.value as MatchType,
    );

    if (!suggestion) {
      args.dashboardState.matchFormError = "Not enough available players to suggest a fair matchup.";
      args.dashboardState.matchFormMessage = "";
      args.syncDashboardState();
      return;
    }

    args.teamA1Select.dataset.pendingValue = suggestion.teamAPlayerIds[0] || "";
    args.teamA2Select.dataset.pendingValue = suggestion.teamAPlayerIds[1] || "";
    args.teamB1Select.dataset.pendingValue = suggestion.teamBPlayerIds[0] || "";
    args.teamB2Select.dataset.pendingValue = suggestion.teamBPlayerIds[1] || "";
    args.teamA1Select.value = suggestion.teamAPlayerIds[0] || "";
    args.teamA2Select.value = suggestion.teamAPlayerIds[1] || "";
    args.teamB1Select.value = suggestion.teamBPlayerIds[0] || "";
    args.teamB2Select.value = suggestion.teamBPlayerIds[1] || "";
    args.dashboardState.matchFormError = "";
    args.dashboardState.matchFormMessage = "Suggested matchup ready.";
    args.populateMatchFormOptions();
    args.syncDashboardState();
  };

  const suggestTournamentBracket = (): void => {
    if (args.tournamentPlannerState.participantIds.length < 2) {
      args.tournamentPlannerState.error = "Select at least 2 participants.";
      args.tournamentPlannerState.rounds = [];
      args.tournamentPlannerState.firstRoundMatches = [];
      args.renderTournamentPlanner();
      args.syncDashboardState();
      return;
    }

    const suggestion = args.buildTournamentSuggestion(
      args.dashboardState.players,
      args.tournamentPlannerState.participantIds,
    );
    if (!suggestion) {
      args.tournamentPlannerState.error = "Unable to build a bracket from the selected players.";
      args.renderTournamentPlanner();
      args.syncDashboardState();
      return;
    }

    args.tournamentPlannerState.firstRoundMatches = suggestion.firstRoundMatches.map((match) => ({ ...match }));
    args.tournamentPlannerState.rounds = suggestion.rounds.map((round, roundIndex) => ({
      title: round.title,
      matches:
        roundIndex === 0
          ? args.tournamentPlannerState.firstRoundMatches
          : round.matches.map((match) => ({ ...match })),
    }));
    args.tournamentPlannerState.error = "";
    args.renderTournamentPlanner();
    args.syncDashboardState();
  };

  const advanceTournamentBye = async (roundIndex: number, matchIndex: number): Promise<void> => {
    const match = args.tournamentPlannerState.rounds[roundIndex]?.matches[matchIndex];
    if (!match) {
      return;
    }

    const winnerPlayerId = match.leftPlayerId || match.rightPlayerId;
    if (!winnerPlayerId || match.winnerPlayerId) {
      return;
    }

    args.tournamentPlannerState.rounds = args.applyTournamentWinnerLocally(
      args.tournamentPlannerState.rounds,
      roundIndex,
      matchIndex,
      winnerPlayerId,
    );
    args.tournamentPlannerState.firstRoundMatches = args.tournamentPlannerState.rounds[0]
      ? args.tournamentPlannerState.rounds[0].matches
      : [];
    args.tournamentPlannerState.error = "";
    args.renderTournamentPlanner();
    args.syncDashboardState();

    if (args.tournamentPlannerState.tournamentId) {
      await args.saveTournament();
      invalidateTournamentBracketCache(args.tournamentPlannerState.tournamentId);
    }
  };

  const prefillMatchFromTournamentPairing = (match: TournamentPlannerMatch): void => {
    const tournament = args.dashboardState.tournaments.find(
      (entry) => entry.id === args.tournamentPlannerState.tournamentId,
    );

    args.matchTypeSelect.value = "singles";
    args.formatTypeSelect.value = "single_game";
    args.pointsToWinSelect.value = "11";
    args.teamA1Select.dataset.pendingValue = match.leftPlayerId || "";
    args.teamA2Select.dataset.pendingValue = "";
    args.teamB1Select.dataset.pendingValue = match.rightPlayerId || "";
    args.teamB2Select.dataset.pendingValue = "";
    args.teamA1Select.value = match.leftPlayerId || "";
    args.teamA2Select.value = "";
    args.teamB1Select.value = match.rightPlayerId || "";
    args.teamB2Select.value = "";
    args.formSeasonSelect.value = tournament?.seasonId || "";
    args.formTournamentSelect.value = args.tournamentPlannerState.tournamentId || "";
    args.winnerTeamSelect.value = "A";
    args.resetScoreInputs();
    args.setActiveTournamentBracketMatchId(match.id);
    args.dashboardState.screen = "createMatch";
    args.populateMatchFormOptions();
    invalidateTournamentBracketCache(args.tournamentPlannerState.tournamentId);
    args.syncMatchBracketOptions();
    args.applySelectedTournamentBracketMatch();
    args.syncAuthState();
    args.syncDashboardState();
  };

  return {
    applyFairMatchSuggestion,
    suggestTournamentBracket,
    advanceTournamentBye,
    prefillMatchFromTournamentPairing,
  };
};
