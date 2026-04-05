import type { CreateMatchPayload, CreateSeasonPayload } from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";
import type { DashboardState, TournamentPlannerState, ViewState } from "../../shared/types/app";
import {
  shouldShowSeasonInDropdown,
  shouldShowTournamentInDropdown,
  isCompletedSeason,
  isCompletedTournament,
} from "./helpers";
import { getTodayDateValue } from "../../shared/utils/format";

type SelectOption = { value: string; label: string };
type MatchPlayerEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elo: number;
  rank: number;
};

type MatchScreenRefs = {
  teamA2Field: HTMLElement | null;
  teamB2Field: HTMLElement | null;
  scoreGrid: HTMLElement | null;
  contextToggle: HTMLElement | null;
  matchTypeToggle: HTMLElement | null;
  formatTypeToggle: HTMLElement | null;
  pointsToggle: HTMLElement | null;
  seasonField: HTMLElement | null;
  seasonInfoField: HTMLElement | null;
  seasonInfoValue: HTMLElement | null;
  tournamentField: HTMLElement | null;
  bracketField: HTMLElement | null;
};

export const createFormOrchestration = (args: {
  dashboardState: DashboardState;
  tournamentPlannerState: TournamentPlannerState;
  getViewState: () => ViewState;
  getCurrentUserId: () => string;
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
  matchBracketSelect: HTMLSelectElement;
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
  suggestMatchButton: HTMLButtonElement;
  submitMatchButton: HTMLButtonElement;
  setSeasonSharePanelTargetId: (seasonId: string) => void;
  setTournamentSharePanelTargetId: (tournamentId: string) => void;
  getMatchScreenRefs: () => MatchScreenRefs;
  getAllowedMatchPlayerIds: () => string[] | null;
  getMatchPlayerEntries: () => MatchPlayerEntry[];
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
    const nextOptions = [
      {
        value: "",
        label: emptyLabel,
      },
      ...options,
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

  const getPendingOrCurrentValue = (select: HTMLSelectElement): string =>
    select.dataset.pendingValue ?? select.value;

  const syncLoadControlsVisibility = (): void => {};

  const syncSegmentedToggle = (toggle: HTMLElement | null, value: string): void => {
    if (!toggle) {
      return;
    }
    Array.from(toggle.querySelectorAll<HTMLButtonElement>("button[data-value]")).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
  };

  const setSegmentedToggleDisabled = (toggle: HTMLElement | null, disabled: boolean): void => {
    if (!toggle) {
      return;
    }
    toggle.querySelectorAll<HTMLButtonElement>("button[data-value]").forEach((button) => {
      button.disabled = disabled;
    });
  };

  const resolveMatchContextMode = (contextToggle: HTMLElement | null): "open" | "season" | "tournament" => {
    const explicitMode = contextToggle?.dataset.mode;
    if (args.formTournamentSelect.value || explicitMode === "tournament") {
      return "tournament";
    }
    if (args.formSeasonSelect.value || explicitMode === "season") {
      return "season";
    }
    return "open";
  };

  const populateSeasonOptions = (): void => {
    const currentUserId = args.getCurrentUserId();
    const options = args.dashboardState.seasons.filter((season) => shouldShowSeasonInDropdown(season, currentUserId)).map((season) => {
      const option = document.createElement("option");
      option.value = season.id;
      option.textContent = `${season.name} (${args.formatDate(season.startDate)})${isCompletedSeason(season) ? " • Completed" : ""}`;
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
    const currentUserId = args.getCurrentUserId();
    const options = args.dashboardState.tournaments
      .filter((tournament) => shouldShowTournamentInDropdown(tournament, currentUserId))
      .map((tournament) => {
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
    const currentUserId = args.getCurrentUserId();
    replaceOptions(
      args.loadTournamentSelect,
      [
        { value: "", label: args.t("savedTournaments") },
        ...args.dashboardState.tournaments
          .filter((tournament) => shouldShowTournamentInDropdown(tournament, currentUserId))
          .map((tournament) => ({
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
    const currentUserId = args.getCurrentUserId();
    replaceOptions(
      args.loadSeasonSelect,
      [
        { value: "", label: args.t("savedSeasons") },
        ...args.dashboardState.seasons.filter((season) => shouldShowSeasonInDropdown(season, currentUserId)).map((season) => ({
          value: season.id,
          label: `${season.name}${isCompletedSeason(season) ? " • Completed" : ""}`,
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
    const selectedPlayerIds = [
      getPendingOrCurrentValue(args.teamA1Select),
      getPendingOrCurrentValue(args.teamA2Select),
      getPendingOrCurrentValue(args.teamB1Select),
      getPendingOrCurrentValue(args.teamB2Select),
    ].filter(Boolean);
    const teamA1Value = getPendingOrCurrentValue(args.teamA1Select) || (selectedPlayerIds.length === 0 ? sessionUserId : "");
    const {
      teamA2Field,
      teamB2Field,
      scoreGrid,
      contextToggle,
      matchTypeToggle,
      formatTypeToggle,
      pointsToggle,
      seasonField,
      seasonInfoField,
      seasonInfoValue,
      tournamentField,
      bracketField,
    } = args.getMatchScreenRefs();
    const contextMode = resolveMatchContextMode(contextToggle);
    const isTournamentContext = Boolean(args.formTournamentSelect.value) || contextMode === "tournament";
    const hasActiveTournamentBracket = !isTournamentContext || Boolean(args.getActiveTournamentBracketMatchId());

    if (args.matchTypeSelect.value === "singles") {
      args.teamA2Select.value = "";
      args.teamB2Select.value = "";
      delete args.teamA2Select.dataset.pendingValue;
      delete args.teamB2Select.dataset.pendingValue;
    }
    if (isTournamentContext) {
      args.matchTypeSelect.value = "singles";
      args.teamA2Select.value = "";
      args.teamB2Select.value = "";
      delete args.teamA2Select.dataset.pendingValue;
      delete args.teamB2Select.dataset.pendingValue;
    }
    if (contextMode === "open") {
      args.formSeasonSelect.value = "";
      args.formTournamentSelect.value = "";
    } else if (contextMode === "season") {
      args.formTournamentSelect.value = "";
    } else if (!args.formTournamentSelect.value) {
      args.formSeasonSelect.value = "";
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

    const selectedTournament = args.dashboardState.tournaments.find(
      (tournament) => tournament.id === args.formTournamentSelect.value,
    );
    const availablePlayerIds = new Set(
      args.getAllowedMatchPlayerIds() ?? args.dashboardState.players.map((player) => player.userId),
    );

    const playerOptions = args.getMatchPlayerEntries()
      .filter((player) => availablePlayerIds.has(player.userId))
      .map((player) => ({
        value: player.userId,
        label: `${player.displayName} (${player.elo})`,
      }));
    const isDoubles = args.matchTypeSelect.value === "doubles";
    const nextTeamA1Value = teamA1Value;
    const nextTeamB1Value = getPendingOrCurrentValue(args.teamB1Select);

    const getNextAvailablePlayer = (excluded: string[]): string => {
      const taken = new Set(excluded.filter(Boolean));
      const next = playerOptions.find((player) => !taken.has(player.value));
      return next ? next.value : "";
    };

    const resolveAvailablePlayer = (currentValue: string, excluded: string[]): string => {
      if (!currentValue) {
        return "";
      }
      if (excluded.indexOf(currentValue) === -1) {
        return currentValue;
      }
      return getNextAvailablePlayer(excluded);
    };

    const nextTeamA2Value = isDoubles
      ? resolveAvailablePlayer(getPendingOrCurrentValue(args.teamA2Select), [
          nextTeamA1Value,
          nextTeamB1Value,
          getPendingOrCurrentValue(args.teamB2Select),
        ])
      : "";
    const nextTeamB2Value = isDoubles
      ? resolveAvailablePlayer(getPendingOrCurrentValue(args.teamB2Select), [
          nextTeamA1Value,
          nextTeamB1Value,
          nextTeamA2Value,
        ])
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
      delete select.dataset.pendingValue;
    });

    const disableTournamentMatchPlayers = isTournamentContext;
    args.teamA1Select.disabled = disableTournamentMatchPlayers || !hasActiveTournamentBracket;
    args.teamA2Select.disabled = true;
    args.teamB1Select.disabled = disableTournamentMatchPlayers || !hasActiveTournamentBracket;
    args.teamB2Select.disabled = true;

    const disableTournamentSetup = isTournamentContext && !hasActiveTournamentBracket;
    args.formatTypeSelect.disabled = disableTournamentSetup;
    args.pointsToWinSelect.disabled = disableTournamentSetup;
    args.winnerTeamSelect.disabled = disableTournamentSetup;
    args.scoreInputs.forEach((game) => {
      game.teamA.disabled = disableTournamentSetup;
      game.teamB.disabled = disableTournamentSetup;
    });
    args.suggestMatchButton.hidden = isTournamentContext;
    args.suggestMatchButton.disabled = isTournamentContext;
    args.submitMatchButton.disabled = disableTournamentSetup;

    const lockedSeasonId = selectedTournament?.seasonId || "";
    const selectedSeasonValue = lockedSeasonId || args.formSeasonSelect.value;

    replaceOptions(
      args.formSeasonSelect,
      [
        { value: "", label: "No season" },
        ...args.dashboardState.seasons.filter((season) => shouldShowSeasonInDropdown(season, sessionUserId)).map((season) => ({
          value: season.id,
          label: `${season.name}${isCompletedSeason(season) ? " • Completed" : ""}`,
        })),
      ],
      selectedSeasonValue,
      "No season",
    );
    args.formSeasonSelect.value = selectedSeasonValue;
    args.formSeasonSelect.disabled = Boolean(lockedSeasonId);
    if (seasonInfoValue) {
      const linkedSeason = args.dashboardState.seasons.find((season) => season.id === lockedSeasonId);
      seasonInfoValue.textContent = linkedSeason
        ? `${linkedSeason.name}${isCompletedSeason(linkedSeason) ? " • Completed" : ""}`
        : args.t("noSeason");
    }

    const filteredTournaments =
      contextMode === "season" && !lockedSeasonId
        ? args.dashboardState.tournaments.filter((tournament) => {
            if (!shouldShowTournamentInDropdown(tournament, sessionUserId)) {
              return false;
            }
            return !args.formSeasonSelect.value || tournament.seasonId === args.formSeasonSelect.value;
          })
        : args.dashboardState.tournaments.filter((tournament) => shouldShowTournamentInDropdown(tournament, sessionUserId));

    replaceOptions(
      args.formTournamentSelect,
      [
        { value: "", label: "No tournament" },
        ...filteredTournaments.map((tournament) => ({
          value: tournament.id,
          label: `${tournament.name}${isCompletedTournament(tournament) ? " • Completed" : ""}`,
        })),
      ],
      args.formTournamentSelect.value,
      "No tournament",
    );

    replaceOptions(
      args.tournamentSeasonSelect,
      [
        { value: "", label: "No season" },
        ...args.dashboardState.seasons.filter((season) => shouldShowSeasonInDropdown(season, sessionUserId)).map((season) => ({
          value: season.id,
          label: season.name,
        })),
      ],
      args.tournamentSeasonSelect.value,
      "No season",
    );

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

    if (contextToggle) {
      contextToggle.dataset.mode = contextMode;
    }
    if (seasonField) {
      seasonField.hidden = contextMode !== "season";
    }
    if (seasonInfoField) {
      seasonInfoField.hidden = contextMode !== "tournament";
    }
    if (tournamentField) {
      tournamentField.hidden = contextMode !== "tournament";
    }
    if (bracketField) {
      bracketField.hidden = contextMode !== "tournament";
    }
    syncSegmentedToggle(contextToggle, contextMode);
    syncSegmentedToggle(matchTypeToggle, args.matchTypeSelect.value || "singles");
    syncSegmentedToggle(formatTypeToggle, args.formatTypeSelect.value || "single_game");
    syncSegmentedToggle(pointsToggle, args.pointsToWinSelect.value || "11");
    setSegmentedToggleDisabled(matchTypeToggle, isTournamentContext);
    setSegmentedToggleDisabled(formatTypeToggle, disableTournamentSetup);
    setSegmentedToggleDisabled(pointsToggle, disableTournamentSetup);
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
    if (!allPlayerIds.includes(args.getCurrentUserId())) {
      throw new Error("You can only create a match if you are one of the participants.");
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
    const tournament = args.dashboardState.tournaments.find(
      (entry) => entry.id === args.formTournamentSelect.value,
    );
    if (tournament && !args.getActiveTournamentBracketMatchId()) {
      throw new Error("Select a tournament bracket match.");
    }

    return {
      matchType: args.matchTypeSelect.value as CreateMatchPayload["matchType"],
      formatType: args.formatTypeSelect.value as CreateMatchPayload["formatType"],
      pointsToWin: Number(args.pointsToWinSelect.value) as 11 | 21,
      teamAPlayerIds: playerIdsA,
      teamBPlayerIds: playerIdsB,
      score,
      winnerTeam: actualWinner,
      playedAt: new Date().toISOString(),
      seasonId: tournament?.seasonId || args.formSeasonSelect.value || null,
      tournamentId: args.formTournamentSelect.value || null,
      tournamentBracketMatchId: args.getActiveTournamentBracketMatchId(),
    };
  };

  const collectSeasonPayload = (): CreateSeasonPayload => ({
    seasonId:
      args.dashboardState.seasonDraftMode === "edit"
        ? args.dashboardState.editingSeasonId || null
        : null,
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
    args.dashboardState.seasonDraftMode = "create";
    args.dashboardState.seasonParticipantQuery = "";
    args.dashboardState.seasonParticipantResults = [];
    args.dashboardState.seasonParticipantSearchLoading = false;
    args.dashboardState.seasonParticipantSearchError = "";
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
    const state = args.getViewState();
    args.tournamentPlannerState.name = "";
    args.tournamentPlannerState.tournamentId = "";
    args.tournamentPlannerState.participantIds = args.isAuthedState(state) ? [state.session.user.id] : [];
    args.tournamentPlannerState.participantQuery = "";
    args.tournamentPlannerState.participantResults = [];
    args.tournamentPlannerState.participantSearchLoading = false;
    args.tournamentPlannerState.participantSearchError = "";
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
