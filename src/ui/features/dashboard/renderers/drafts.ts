import type { DashboardState, TournamentPlannerState } from "../../../shared/types/app";
import type { TournamentRecord, SeasonRecord } from "../../../../api/contract";
import type { TextKey } from "../../../shared/i18n/translations";
import { formatDate } from "../../../shared/utils/format";

type TranslationFn = (key: TextKey) => string;

const getWinnerLabel = (winnerTeam: "A" | "B", teamA: string, teamB: string): string =>
  winnerTeam === "A" ? teamA : teamB;

export type DraftRendererArgs = {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  matchOutcome: HTMLElement;
  seasonSummary: HTMLElement;
  tournamentSummary: HTMLElement;
  seasonStartDateInput: HTMLInputElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonIsPublicInput: HTMLInputElement;
  seasonIsActiveInput: HTMLInputElement;
  tournamentSeasonSelect: HTMLSelectElement;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  matchTypeSelect: HTMLSelectElement;
  formatTypeSelect: HTMLSelectElement;
  pointsToWinSelect: HTMLSelectElement;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  winnerTeamSelect: HTMLSelectElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
  scoreInputs: Array<{
    teamA: HTMLInputElement;
    teamB: HTMLInputElement;
    teamALabel: HTMLSpanElement;
    teamBLabel: HTMLSpanElement;
  }>;
  renderPlayerNames: (playerIds: string[], players: DashboardState["players"]) => string;
  buildUniquePlayerList: (values: string[]) => string[];
  getMatchFeedContextLabel: (
    season: SeasonRecord | undefined,
    tournament: TournamentRecord | undefined,
  ) => string;
  t: TranslationFn;
};

export type DraftRenderers = {
  renderSeasonDraftSummary: () => void;
  renderTournamentDraftSummary: () => void;
  renderMatchDraftSummary: () => void;
  updateScoreLabelsAndPlaceholders: (teamALabel: string, teamBLabel: string) => void;
};

export const createDraftRenderers = (args: DraftRendererArgs): DraftRenderers => {
  const getSelectOptionLabel = (select: HTMLSelectElement, playerId: string): string => {
    const option = Array.from(select.options).find((entry) => entry.value === playerId);
    return option?.textContent?.trim() || "";
  };

  const getTeamLabel = (playerIds: string[], selects: HTMLSelectElement[], fallbackKey: TextKey): string => {
    const labelFromPlayers = args.renderPlayerNames(playerIds, args.dashboardState.players);
    if (labelFromPlayers && labelFromPlayers !== playerIds.join(" / ")) {
      return labelFromPlayers;
    }
    const labels = playerIds
      .map((playerId, index) => getSelectOptionLabel(selects[index] ?? selects[0], playerId))
      .filter(Boolean)
      .map((label) => label.replace(/\s+\(\d+\)(?:\s+\([^)]*\))?$/, ""));
    return labels.join(" / ") || args.t(fallbackKey);
  };

  const updateScoreLabelsAndPlaceholders = (teamALabel: string, teamBLabel: string): void => {
    const aLabel = teamALabel || args.t("teamALabel");
    const bLabel = teamBLabel || args.t("teamBLabel");
    args.scoreInputs.forEach((game) => {
      game.teamALabel.textContent = aLabel;
      game.teamBLabel.textContent = bLabel;
      game.teamA.placeholder = "0";
      game.teamB.placeholder = "0";
    });
  };

  const deriveMatchWinnerFromInputs = (): "A" | "B" | null => {
    const visibleGames = args.formatTypeSelect.value === "best_of_3" ? 3 : 1;
    const scoreEntries = args.scoreInputs
      .slice(0, visibleGames)
      .map((game) => ({
        teamA: Number(game.teamA.value),
        teamB: Number(game.teamB.value),
      }))
      .filter((game) => !Number.isNaN(game.teamA) && !Number.isNaN(game.teamB));

    if (scoreEntries.length === 0) {
      return null;
    }

    if (scoreEntries.some((game) => game.teamA === game.teamB)) {
      return null;
    }

    const teamAWins = scoreEntries.filter((game) => game.teamA > game.teamB).length;
    const teamBWins = scoreEntries.filter((game) => game.teamB > game.teamA).length;
    const requiredWins = args.formatTypeSelect.value === "single_game" ? 1 : 2;

    if (Math.max(teamAWins, teamBWins) < requiredWins || teamAWins === teamBWins) {
      return null;
    }

    return teamAWins > teamBWins ? "A" : "B";
  };

  const renderSeasonDraftSummary = (): void => {
    args.seasonSummary.textContent = [
      `${args.dashboardState.editingSeasonParticipantIds.length} participants`,
      args.seasonStartDateInput.value
        ? `Starts ${formatDate(args.seasonStartDateInput.value)}`
        : "No start date",
      `Base Elo: ${args.seasonBaseEloSelect.value.replace("_", " ")}`,
      args.seasonIsPublicInput.checked ? "Visibility: public" : "Visibility: private",
    ].join(" • ");
  };

  const renderTournamentDraftSummary = (): void => {
    const season = args.dashboardState.seasons.find((entry) => entry.id === args.tournamentSeasonSelect.value);
    args.tournamentSummary.textContent = [
      args.tournamentNameInput.value.trim() || "Untitled tournament",
      season ? season.name : "No season",
      `${args.tournamentPlannerState.participantIds.length} players`,
      args.tournamentDateInput.value ? formatDate(args.tournamentDateInput.value) : "No date",
    ].join(" • ");
  };

  const renderMatchDraftSummary = (): void => {
    const teamAPlayerIds = args.buildUniquePlayerList(
      args.matchTypeSelect.value === "singles"
        ? [args.teamA1Select.value]
        : [args.teamA1Select.value, args.teamA2Select.value],
    );
    const teamBPlayerIds = args.buildUniquePlayerList(
      args.matchTypeSelect.value === "singles"
        ? [args.teamB1Select.value]
        : [args.teamB1Select.value, args.teamB2Select.value],
    );
    const teamALabel = getTeamLabel(
      teamAPlayerIds,
      args.matchTypeSelect.value === "singles" ? [args.teamA1Select] : [args.teamA1Select, args.teamA2Select],
      "teamALabel",
    );
    const teamBLabel = getTeamLabel(
      teamBPlayerIds,
      args.matchTypeSelect.value === "singles" ? [args.teamB1Select] : [args.teamB1Select, args.teamB2Select],
      "teamBLabel",
    );
    updateScoreLabelsAndPlaceholders(teamALabel, teamBLabel);
    const derivedWinner = deriveMatchWinnerFromInputs();
    if (derivedWinner) {
      args.winnerTeamSelect.value = derivedWinner;
    }
    args.matchOutcome.dataset.state = derivedWinner ? "winner" : "pending";
    args.matchOutcome.textContent = derivedWinner
      ? `${args.t("matchSummaryWinnerPrefix")} ${getWinnerLabel(derivedWinner, teamALabel, teamBLabel)}`
      : args.t("matchOutcomePending");
  };

  return {
    renderSeasonDraftSummary,
    renderTournamentDraftSummary,
    renderMatchDraftSummary,
    updateScoreLabelsAndPlaceholders,
  };
};
