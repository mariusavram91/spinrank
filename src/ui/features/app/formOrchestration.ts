import type { CreateMatchPayload, CreateSeasonPayload } from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";
import type { DashboardState, TournamentPlannerState, ViewState } from "../../shared/types/app";
import { getTodayDateValue } from "../../shared/utils/format";

type SelectOption = { value: string; label: string };

type MatchScreenRefs = {
  teamA2Field: HTMLElement | null;
  teamB2Field: HTMLElement | null;
  scoreGrid: HTMLElement | null;
};

export const createFormOrchestration = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  getViewState: () => ViewState;
  isAuthedState: (state: ViewState) => state is Extract<ViewState, { status: "authenticated" }>;
  getActiveTournamentBracketMatchId: () => string | null;
  loadSeasonSelect: HTMLSelectElement;
  loadTournamentSelect: HTMLSelectElement;
  seasonSelect: HTMLSelectElement;
  tournamentSelect: HTMLSelectElement;
  matchTypeSelect: HTMLSelectElement;
  formatTypeSelect: HTMLSelectElement;
  pointsToWinSelect: HTMLSelectElement;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  tournamentSeasonSelect: HTMLSelectElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
  winnerTeamSelect: HTMLSelectElement;
  scoreInputs: Array<{ teamA: HTMLInputElement; teamB: HTMLInputElement }>;
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonIsActiveInput: HTMLInputElement;
  seasonIsPublicInput: HTMLInputElement;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  setSeasonSharePanelTargetId: (seasonId: string) => void;
  setTournamentSharePanelTargetId: (tournamentId: string) => void;
  getMatchScreenRefs: () => MatchScreenRefs;
  formatDate: (value: string) => string;
  t: (key: TextKey) => string;
}) => {
  const replaceOptions = (
    select: HTMLSelectElement,
    options: SelectOption[],
    selectedValue: string,
    emptyLabel: string,
  ): void => {
    const nextOptions =
      options.length > 0
        ? options
        : [
            {
              value: "",
              label: emptyLabel,
            },
          ];

    select.replaceChildren(
      ...nextOptions.map((option) => {
        const node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === selectedValue;
        return node;
      }),
    );
  };

  const replacePlayerOptions = (
    select: HTMLSelectElement,
    options: SelectOption[],
    selectedValue: string,
    blockedValues: string[],
    emptyLabel: string,
  ): void => {
    const nextOptions =
      options.length > 0
        ? options
        : [
            {
              value: "",
              label: emptyLabel,
            },
          ];

    select.replaceChildren(
      ...nextOptions.map((option) => {
        const node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === selectedValue;
        node.disabled = option.value !== selectedValue && blockedValues.indexOf(option.value) !== -1;
        return node;
      }),
    );
  };

  const syncLoadControlsVisibility = (): void => {};

  const populateSeasonOptions = (): void => {
    const options = args.dashboardState.seasons.map((season) => {
      const option = document.createElement("option");
      option.value = season.id;
      option.textContent = `${season.name} (${args.formatDate(season.startDate)})${season.status === "completed" ? " • Completed" : ""}`;
      option.selected = season.id === args.dashboardState.selectedSeasonId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = args.t("noSeasonsAvailable");
      options.push(option);
    }

    args.seasonSelect.replaceChildren(...options);
  };

  const populateTournamentOptions = (): void => {
    const options = args.dashboardState.tournaments.map((tournament) => {
      const option = document.createElement("option");
      option.value = tournament.id;
      option.textContent = `${tournament.name} • ${tournament.seasonName || "Open"} • ${args.formatDate(tournament.date)}`;
      option.selected = tournament.id === args.dashboardState.selectedTournamentId;
      return option;
    });

    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = args.t("noTournamentsAvailable");
      options.push(option);
    }

    args.tournamentSelect.replaceChildren(...options);
  };

  const populateTournamentPlannerLoadOptions = (): void => {
    replaceOptions(
      args.loadTournamentSelect,
      [
        { value: "", label: args.t("savedTournaments") },
        ...args.dashboardState.tournaments.map((tournament) => ({
          value: tournament.id,
          label: `${tournament.name} • ${tournament.participantCount} players`,
        })),
      ],
      args.tournamentPlannerState.tournamentId,
      args.t("savedTournaments"),
    );
    syncLoadControlsVisibility();
  };

  const populateSeasonManagerLoadOptions = (): void => {
    replaceOptions(
      args.loadSeasonSelect,
      [
        { value: "", label: args.t("savedSeasons") },
        ...args.dashboardState.seasons.map((season) => ({
          value: season.id,
          label: `${season.name}${season.status === "completed" ? " • Completed" : ""}`,
        })),
      ],
      args.dashboardState.editingSeasonId,
      args.t("savedSeasons"),
    );
    syncLoadControlsVisibility();
  };

  const populateMatchFormOptions = (): void => {
    const state = args.getViewState();
    const sessionUserId = args.isAuthedState(state) ? state.session.user.id : "";
    const teamA1Value = args.teamA1Select.value || sessionUserId;

    if (args.matchTypeSelect.value === "singles") {
      args.teamA2Select.value = "";
      args.teamB2Select.value = "";
    }

    replaceOptions(
      args.matchTypeSelect,
      [
        { value: "singles", label: "Singles" },
        { value: "doubles", label: "Doubles" },
      ],
      args.matchTypeSelect.value || "singles",
      "No match type",
    );

    replaceOptions(
      args.formatTypeSelect,
      [
        { value: "single_game", label: "Single game" },
        { value: "best_of_3", label: "Best of 3" },
      ],
      args.formatTypeSelect.value || "single_game",
      "No format",
    );

    replaceOptions(
      args.pointsToWinSelect,
      [
        { value: "11", label: "11 points" },
        { value: "21", label: "21 points" },
      ],
      args.pointsToWinSelect.value || "11",
      "No points",
    );

    replaceOptions(
      args.winnerTeamSelect,
      [
        { value: "A", label: "Team A" },
        { value: "B", label: "Team B" },
      ],
      args.winnerTeamSelect.value || "A",
      "No winner",
    );

    const playerOptions = args.dashboardState.players.map((player) => ({
      value: player.userId,
      label: `${player.displayName} (${player.elo})`,
    }));
    const isDoubles = args.matchTypeSelect.value === "doubles";
    const nextTeamA1Value = teamA1Value;
    const nextTeamB1Value = args.teamB1Select.value;

    const getNextAvailablePlayer = (excluded: string[]): string => {
      const taken = new Set(excluded.filter(Boolean));
      const next = playerOptions.find((player) => !taken.has(player.value));
      return next ? next.value : "";
    };

    const resolveAvailablePlayer = (currentValue: string, excluded: string[]): string => {
      if (currentValue && excluded.indexOf(currentValue) === -1) {
        return currentValue;
      }
      return getNextAvailablePlayer(excluded);
    };

    const nextTeamA2Value = isDoubles
      ? resolveAvailablePlayer(args.teamA2Select.value, [nextTeamA1Value, nextTeamB1Value, args.teamB2Select.value])
      : "";
    const nextTeamB2Value = isDoubles
      ? resolveAvailablePlayer(args.teamB2Select.value, [nextTeamA1Value, nextTeamB1Value, nextTeamA2Value])
      : "";

    const selectedValues = [nextTeamA1Value, nextTeamA2Value, nextTeamB1Value, nextTeamB2Value].filter(Boolean);
    [
      { select: args.teamA1Select, selectedValue: nextTeamA1Value, emptyLabel: "Player 1 unavailable" },
      { select: args.teamA2Select, selectedValue: nextTeamA2Value, emptyLabel: "Player 2 unavailable" },
      { select: args.teamB1Select, selectedValue: nextTeamB1Value, emptyLabel: "Player 3 unavailable" },
      { select: args.teamB2Select, selectedValue: nextTeamB2Value, emptyLabel: "Player 4 unavailable" },
    ].forEach(({ select, selectedValue, emptyLabel }) => {
      replacePlayerOptions(
        select,
        playerOptions,
        selectedValue || select.value,
        selectedValues.filter((value) => value !== (selectedValue || select.value)),
        emptyLabel,
      );
    });

    replaceOptions(
      args.formSeasonSelect,
      [
        { value: "", label: "No season" },
        ...args.dashboardState.seasons.map((season) => ({
          value: season.id,
          label: `${season.name}${season.status === "completed" ? " • Completed" : ""}`,
        })),
      ],
      args.formSeasonSelect.value,
      "No season",
    );

    const filteredTournaments = args.dashboardState.tournaments.filter((tournament) => {
      return !args.formSeasonSelect.value || tournament.seasonId === args.formSeasonSelect.value;
    });

    replaceOptions(
      args.formTournamentSelect,
      [
        { value: "", label: "No tournament" },
        ...filteredTournaments.map((tournament) => ({
          value: tournament.id,
          label: `${tournament.name}${tournament.status === "completed" ? " • Completed" : ""}`,
        })),
      ],
      args.formTournamentSelect.value,
      "No tournament",
    );

    replaceOptions(
      args.tournamentSeasonSelect,
      [
        { value: "", label: "No season" },
        ...args.dashboardState.seasons.map((season) => ({
          value: season.id,
          label: season.name,
        })),
      ],
      args.tournamentSeasonSelect.value,
      "No season",
    );

    const { teamA2Field, teamB2Field, scoreGrid } = args.getMatchScreenRefs();
    if (teamA2Field) {
      teamA2Field.hidden = !isDoubles;
    }
    if (teamB2Field) {
      teamB2Field.hidden = !isDoubles;
    }

    const visibleGames = args.formatTypeSelect.value === "best_of_3" ? 3 : 1;
    args.scoreInputs.forEach((game, index) => {
      const row = scoreGrid?.children[index] as HTMLElement | undefined;
      if (row) {
        row.hidden = index >= visibleGames;
      }
    });
  };

  const collectMatchPayload = (): CreateMatchPayload => {
    const playerIdsA = [args.teamA1Select.value];
    const playerIdsB = [args.teamB1Select.value];

    if (args.matchTypeSelect.value === "doubles") {
      playerIdsA.push(args.teamA2Select.value);
      playerIdsB.push(args.teamB2Select.value);
    }

    const allPlayerIds = [...playerIdsA, ...playerIdsB].filter(Boolean);
    if (new Set(allPlayerIds).size !== allPlayerIds.length) {
      throw new Error("Each selected player must be unique across both teams.");
    }

    const visibleGames = args.formatTypeSelect.value === "best_of_3" ? 3 : 1;
    const score = args.scoreInputs
      .slice(0, visibleGames)
      .filter((game) => game.teamA.value !== "" && game.teamB.value !== "")
      .map((game) => ({
        teamA: Number(game.teamA.value),
        teamB: Number(game.teamB.value),
      }));

    if (score.length === 0) {
      throw new Error("Enter at least one game score.");
    }
    if (score.some((game) => game.teamA === game.teamB)) {
      throw new Error("A ranked match must have a winner.");
    }

    const teamAWins = score.filter((game) => game.teamA > game.teamB).length;
    const teamBWins = score.filter((game) => game.teamB > game.teamA).length;
    const requiredWins = args.formatTypeSelect.value === "single_game" ? 1 : 2;

    if (Math.max(teamAWins, teamBWins) < requiredWins) {
      throw new Error("The match must include enough decisive games.");
    }
    if (teamAWins === teamBWins) {
      throw new Error("A ranked match must have a winner.");
    }

    const actualWinner = teamAWins > teamBWins ? "A" : "B";
    const selectedWinner = args.winnerTeamSelect.value as CreateMatchPayload["winnerTeam"];
    if (selectedWinner !== actualWinner) {
      throw new Error("The selected winner does not match the submitted score.");
    }

    return {
      matchType: args.matchTypeSelect.value as CreateMatchPayload["matchType"],
      formatType: args.formatTypeSelect.value as CreateMatchPayload["formatType"],
      pointsToWin: Number(args.pointsToWinSelect.value) as 11 | 21,
      teamAPlayerIds: playerIdsA,
      teamBPlayerIds: playerIdsB,
      score,
      winnerTeam: selectedWinner,
      playedAt: new Date().toISOString(),
      seasonId: args.formSeasonSelect.value || null,
      tournamentId: args.formTournamentSelect.value || null,
      tournamentBracketMatchId: args.getActiveTournamentBracketMatchId(),
    };
  };

  const collectSeasonPayload = (): CreateSeasonPayload => ({
    seasonId: args.dashboardState.editingSeasonId || null,
    name: args.seasonNameInput.value.trim(),
    startDate: args.seasonStartDateInput.value,
    endDate: args.seasonEndDateInput.value || null,
    isActive: args.seasonIsActiveInput.checked,
    baseEloMode: args.seasonBaseEloSelect.value as CreateSeasonPayload["baseEloMode"],
    participantIds: args.dashboardState.editingSeasonParticipantIds,
    isPublic: args.seasonIsPublicInput.checked,
  });

  const resetSeasonForm = (): void => {
    const state = args.getViewState();
    args.dashboardState.editingSeasonId = "";
    args.dashboardState.editingSeasonParticipantIds = args.isAuthedState(state) ? [state.session.user.id] : [];
    args.seasonNameInput.value = "";
    args.seasonStartDateInput.value = getTodayDateValue();
    args.seasonEndDateInput.value = "";
    args.seasonBaseEloSelect.value = "carry_over";
    args.seasonIsActiveInput.checked = true;
    args.seasonIsPublicInput.checked = false;
    args.loadSeasonSelect.value = "";
    syncLoadControlsVisibility();
    args.setSeasonSharePanelTargetId("");
  };

  const resetTournamentForm = (): void => {
    args.tournamentPlannerState.name = "";
    args.tournamentPlannerState.tournamentId = "";
    args.tournamentPlannerState.participantIds = [];
    args.tournamentPlannerState.firstRoundMatches = [];
    args.tournamentPlannerState.rounds = [];
    args.tournamentPlannerState.error = "";
    args.tournamentNameInput.value = "";
    args.tournamentDateInput.value = getTodayDateValue();
    args.tournamentSeasonSelect.value = "";
    args.loadTournamentSelect.value = "";
    syncLoadControlsVisibility();
    args.setTournamentSharePanelTargetId("");
  };

  return {
    replaceOptions,
    syncLoadControlsVisibility,
    populateSeasonOptions,
    populateTournamentOptions,
    populateTournamentPlannerLoadOptions,
    populateSeasonManagerLoadOptions,
    populateMatchFormOptions,
    collectMatchPayload,
    collectSeasonPayload,
    resetSeasonForm,
    resetTournamentForm,
  };
};
