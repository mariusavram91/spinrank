import type { CreateMatchPayload, LeaderboardEntry, SeasonRecord, TournamentRecord } from "../../../api/contract";
import { bindLocalizedText, registerTranslation, t } from "../i18n/runtime";
import type { TextKey } from "../i18n/translations";

type ScoreKey = "teamA" | "teamB";
type TeamKey = "A" | "B";
type MatchType = "singles" | "doubles";
type FormatType = "single_game" | "best_of_3";
type PointsToWin = 11 | 21;

type GameScore = {
  teamA: number;
  teamB: number;
};

type GameRecord = GameScore & {
  winnerTeam: TeamKey;
};

type TeamSelections = {
  teamA1: string;
  teamA2: string;
  teamB1: string;
  teamB2: string;
};

type SaveMatchHandler = (payload: CreateMatchPayload) => Promise<void> | void;

type ToggleIcon =
  | "match-single"
  | "match-double"
  | "format-single"
  | "format-best-of-3"
  | "points-11"
  | "points-21";

export interface ScoreCardElements {
  overlay: HTMLDivElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  nextGameButton: HTMLButtonElement;
  isVisible: () => boolean;
  show: () => void;
  hide: () => void;
  sync: () => void;
  setSaveMatchHandler: (handler: SaveMatchHandler) => void;
}

const randomTeam = (): TeamKey => {
  const hasCrypto = typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function";
  const value = hasCrypto ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.random() * 2 ** 32;
  return value % 2 === 0 ? "A" : "B";
};

const oppositeTeam = (team: TeamKey): TeamKey => (team === "A" ? "B" : "A");

const createSvgIcon = (build: (svg: SVGSVGElement) => void): SVGSVGElement => {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("score-card__toggle-svg");
  build(svg);
  return svg;
};

const buildToggleIcon = (icon: ToggleIcon): HTMLSpanElement => {
  const span = document.createElement("span");
  span.className = `score-card__toggle-icon score-card__toggle-icon--${icon}`;
  span.setAttribute("aria-hidden", "true");
  if (icon === "match-single" || icon === "match-double" || icon === "format-single" || icon === "format-best-of-3") {
    const svg = createSvgIcon((svgNode) => {
      const svgNamespace = "http://www.w3.org/2000/svg";
      const circle = (cx: string, cy: string, r: string): SVGCircleElement => {
        const node = document.createElementNS(svgNamespace, "circle");
        node.setAttribute("cx", cx);
        node.setAttribute("cy", cy);
        node.setAttribute("r", r);
        return node;
      };
      const path = (d: string): SVGPathElement => {
        const node = document.createElementNS(svgNamespace, "path");
        node.setAttribute("d", d);
        return node;
      };

      svgNode.setAttribute("fill", "none");
      svgNode.setAttribute("stroke", "currentColor");
      svgNode.setAttribute("stroke-width", "1.6");
      svgNode.setAttribute("stroke-linecap", "round");
      svgNode.setAttribute("stroke-linejoin", "round");

      if (icon === "match-single") {
        svgNode.append(
          circle("10", "6.4", "1.8"),
          path("M4.8 16.2c0-2.8 2.3-5 5.2-5s5.2 2.2 5.2 5"),
        );
      } else if (icon === "match-double") {
        svgNode.append(
          circle("6.2", "6.4", "1.5"),
          circle("13.8", "6.4", "1.5"),
          path("M2.4 16.1c0-2.4 1.8-4.2 4-4.5"),
          path("M9.9 11.6c2.2.3 4 2.1 4 4.5"),
        );
      } else if (icon === "format-single") {
        const dot = circle("10", "10", "3.1");
        dot.setAttribute("fill", "currentColor");
        dot.setAttribute("stroke", "none");
        svgNode.append(dot);
      } else {
        const topDot = circle("10", "5.9", "2.1");
        const leftDot = circle("6.2", "13.6", "2.1");
        const rightDot = circle("13.8", "13.6", "2.1");
        topDot.setAttribute("fill", "currentColor");
        topDot.setAttribute("stroke", "none");
        leftDot.setAttribute("fill", "currentColor");
        leftDot.setAttribute("stroke", "none");
        rightDot.setAttribute("fill", "currentColor");
        rightDot.setAttribute("stroke", "none");
        svgNode.append(topDot, leftDot, rightDot);
      }
    });
    span.append(svg);
    return span;
  }

  span.textContent =
    icon === "points-11"
      ? "11"
      : "21";
  return span;
};

const buildCompactSegmentedControl = (
  options: Array<{ value: string; labelKey: TextKey; icon: ToggleIcon }>,
  onSelect: (value: string) => void,
): HTMLDivElement => {
  const toggle = document.createElement("div");
  toggle.className = "segment-toggle score-card__toggle score-card__toggle--compact";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "score-card__toggle-button";
    button.dataset.value = option.value;
    button.setAttribute("aria-pressed", "false");
    registerTranslation(() => {
      const label = t(option.labelKey);
      button.setAttribute("aria-label", label);
      button.title = label;
    });
    button.append(buildToggleIcon(option.icon));
    button.addEventListener("click", () => {
      onSelect(option.value);
    });
    toggle.append(button);
  });
  return toggle;
};

const replaceOptions = (
  select: HTMLSelectElement,
  options: Array<{ value: string; label: string; disabled?: boolean }>,
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
      node.disabled = Boolean(option.disabled) && option.value !== selectedValue;
      return node;
    }),
  );
};

const updatePressedState = (toggle: HTMLElement | null, value: string): void => {
  if (!toggle) {
    return;
  }
  Array.from(toggle.querySelectorAll<HTMLButtonElement>("button[data-value]")).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  });
};

const getServesPerTurn = (score: GameScore, pointsToWin: PointsToWin): number => {
  const deuceThreshold = pointsToWin - 1;
  if (score.teamA >= deuceThreshold && score.teamB >= deuceThreshold) {
    return 1;
  }
  return pointsToWin === 11 ? 2 : 5;
};

const getGameWinner = (score: GameScore, pointsToWin: PointsToWin): TeamKey | null => {
  const reachedTarget = Math.max(score.teamA, score.teamB) >= pointsToWin;
  const hasLead = Math.abs(score.teamA - score.teamB) >= 2;
  if (!reachedTarget || !hasLead || score.teamA === score.teamB) {
    return null;
  }
  return score.teamA > score.teamB ? "A" : "B";
};

const buildPayloadSnapshot = (args: {
  matchType: MatchType;
  formatType: FormatType;
  pointsToWin: PointsToWin;
  seasonId: string;
  tournamentId: string;
  selections: TeamSelections;
  games: GameRecord[];
  currentScore: GameScore;
  currentWinner: TeamKey | null;
  matchWinner: TeamKey | null;
}): string => {
  return JSON.stringify({
    matchType: args.matchType,
    formatType: args.formatType,
    pointsToWin: args.pointsToWin,
    seasonId: args.seasonId,
    tournamentId: args.tournamentId,
    selections: args.selections,
    games: args.games,
    currentScore: args.currentScore,
    currentWinner: args.currentWinner,
    matchWinner: args.matchWinner,
  });
};

export const buildScoreCard = (args: {
  getPlayers: () => LeaderboardEntry[];
  getCurrentUserId: () => string;
  getSeasons: () => SeasonRecord[];
  getTournaments: () => TournamentRecord[];
  getSelectedSeasonId: () => string;
  getSelectedTournamentId: () => string;
}): ScoreCardElements => {
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "secondary-button";
  bindLocalizedText(openButton, "scoreCardButton");

  const overlay = document.createElement("div");
  overlay.className = "score-card-overlay";
  overlay.hidden = true;

  const scoreCard = document.createElement("section");
  scoreCard.className = "score-card";

  const header = document.createElement("div");
  header.className = "score-card__header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "score-card__heading";

  const title = document.createElement("h3");
  title.className = "card-title";
  bindLocalizedText(title, "scoreCardTitle");

  const instructions = document.createElement("p");
  instructions.className = "score-card__instructions";
  bindLocalizedText(instructions, "scoreCardInstructions");

  titleBlock.append(title, instructions);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "icon-button score-card__close-button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", t("scoreCardClose"));
  closeButton.title = t("scoreCardClose");

  const controls = document.createElement("div");
  controls.className = "score-card__controls";
  const topLine = document.createElement("div");
  topLine.className = "score-card__topline";

  const matchTypeToggle = buildCompactSegmentedControl(
    [
      { value: "singles", labelKey: "matchTypeSingles", icon: "match-single" },
      { value: "doubles", labelKey: "matchTypeDoubles", icon: "match-double" },
    ],
    (value) => {
      matchType = value as MatchType;
      if (matchType === "singles") {
        selections.teamA2 = "";
        selections.teamB2 = "";
      }
      sync();
    },
  );

  const formatTypeToggle = buildCompactSegmentedControl(
    [
      { value: "single_game", labelKey: "formatSingleGame", icon: "format-single" },
      { value: "best_of_3", labelKey: "formatBestOf3", icon: "format-best-of-3" },
    ],
    (value) => {
      formatType = value as FormatType;
      sync();
    },
  );

  const pointsToggle = buildCompactSegmentedControl(
    [
      { value: "11", labelKey: "points11", icon: "points-11" },
      { value: "21", labelKey: "points21", icon: "points-21" },
    ],
    (value) => {
      pointsToWin = Number(value) as PointsToWin;
      sync();
    },
  );

  const statusPanel = document.createElement("div");
  statusPanel.className = "score-card__status";

  const currentGameChip = document.createElement("p");
  currentGameChip.className = "score-card__status-chip score-card__status-chip--compact";

  const resultChip = document.createElement("p");
  resultChip.className = "score-card__status-chip score-card__status-chip--result score-card__status-chip--compact";

  const savedChip = document.createElement("p");
  savedChip.className = "score-card__status-chip score-card__status-chip--saved";
  savedChip.hidden = true;

  const setupControls = document.createElement("div");
  setupControls.className = "score-card__settings score-card__quick-setup";
  setupControls.append(matchTypeToggle, formatTypeToggle, pointsToggle);

  statusPanel.append(setupControls, currentGameChip, resultChip, savedChip);

  const previousGamesPanel = document.createElement("div");
  previousGamesPanel.className = "score-card__previous-games";

  const previousGamesLabel = document.createElement("p");
  previousGamesLabel.className = "score-card__previous-games-label";
  bindLocalizedText(previousGamesLabel, "scoreCardPreviousGames");
  previousGamesPanel.append(previousGamesLabel);

  const tiles = document.createElement("div");
  tiles.className = "score-card__tiles";

  const seasonSelect = document.createElement("select");
  seasonSelect.className = "select-input score-card__context-select";
  const tournamentSelect = document.createElement("select");
  tournamentSelect.className = "select-input score-card__context-select";
  let selectedSeasonId = args.getSelectedSeasonId();
  let selectedTournamentId = args.getSelectedTournamentId();

  const contextPanel = document.createElement("div");
  contextPanel.className = "score-card__context";

  const contextLabel = document.createElement("p");
  contextLabel.className = "score-card__context-label";
  bindLocalizedText(contextLabel, "matchContextCountsToward");

  const contextFields = document.createElement("div");
  contextFields.className = "score-card__context-fields";

  const seasonField = document.createElement("label");
  seasonField.className = "score-card__context-field";
  const seasonFieldLabel = document.createElement("span");
  seasonFieldLabel.className = "score-card__context-field-label";
  bindLocalizedText(seasonFieldLabel, "matchFieldSeason");
  seasonField.append(seasonFieldLabel, seasonSelect);

  const tournamentField = document.createElement("label");
  tournamentField.className = "score-card__context-field";
  const tournamentFieldLabel = document.createElement("span");
  tournamentFieldLabel.className = "score-card__context-field-label";
  bindLocalizedText(tournamentFieldLabel, "matchFieldTournament");
  tournamentField.append(tournamentFieldLabel, tournamentSelect);

  contextFields.append(seasonField, tournamentField);
  contextPanel.append(contextLabel, contextFields);

  const scoreState: GameScore = { teamA: 0, teamB: 0 };
  const previousGames: GameRecord[] = [];
  let matchType: MatchType = "singles";
  let formatType: FormatType = "single_game";
  let pointsToWin: PointsToWin = 11;
  const selections: TeamSelections = {
    teamA1: "",
    teamA2: "",
    teamB1: "",
    teamB2: "",
  };
  const scoreValues: Record<ScoreKey, HTMLSpanElement> = {
    teamA: document.createElement("span"),
    teamB: document.createElement("span"),
  };
  const teamNames: Record<ScoreKey, HTMLSpanElement> = {
    teamA: document.createElement("span"),
    teamB: document.createElement("span"),
  };
  const scorePreviousValues: Record<ScoreKey, number> = {
    teamA: 0,
    teamB: 0,
  };
  const pointerMeta = new Map<HTMLButtonElement, { startX: number; startY: number; dragged: boolean }>();
  const playerPickers: HTMLDivElement[] = [];
  const playerPickerToggles: HTMLButtonElement[] = [];
  const closePlayerPickers = (): void => {
    playerPickers.forEach((picker, index) => {
      picker.classList.remove("score-card__player-picker--visible");
      const toggle = playerPickerToggles[index];
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  };
  let currentServeStartTeam: TeamKey = randomTeam();
  let visible = false;
  let saveHandler: SaveMatchHandler | null = null;
  let saving = false;
  let savedSnapshot = "";
  let statusMessage = "";
  let statusKind: "idle" | "success" | "error" = "idle";
  const getSelectedValues = (): string[] =>
    [selections.teamA1, selections.teamA2, selections.teamB1, selections.teamB2].filter(Boolean);
  const handleSelectionChange = (): void => {
    statusMessage = "";
    statusKind = "idle";
    sync();
  };

  const getPlayersById = (): Map<string, LeaderboardEntry> =>
    new Map(args.getPlayers().map((player) => [player.userId, player]));

  const setSelectionValue = (team: ScoreKey, slot: 1 | 2, value: string): void => {
    if (team === "teamA") {
      if (slot === 1) {
        selections.teamA1 = value;
      } else {
        selections.teamA2 = value;
      }
      return;
    }
    if (slot === 1) {
      selections.teamB1 = value;
    } else {
      selections.teamB2 = value;
    }
  };

  const createPlayerSelect = (team: ScoreKey, slot: 1 | 2): HTMLSelectElement => {
    const select = document.createElement("select");
    select.className = "select-input score-card__player-select";
    select.dataset.team = team;
    select.dataset.slot = String(slot);
    select.addEventListener("change", () => {
      setSelectionValue(team, slot, select.value);
      handleSelectionChange();
    });
    return select;
  };

  const teamSelects: Record<
    ScoreKey,
    { primary: HTMLSelectElement; secondary: HTMLSelectElement }
  > = {
    teamA: {
      primary: createPlayerSelect("teamA", 1),
      secondary: createPlayerSelect("teamA", 2),
    },
    teamB: {
      primary: createPlayerSelect("teamB", 1),
      secondary: createPlayerSelect("teamB", 2),
    },
  };
  const buildTeamWrapper = (
    key: ScoreKey,
    tile: HTMLButtonElement,
    selects: { primary: HTMLSelectElement; secondary: HTMLSelectElement },
  ): {
    wrapper: HTMLDivElement;
    serveBalls: HTMLSpanElement;
    playerPicker: HTMLDivElement;
  } => {
    const wrapper = document.createElement("div");
    wrapper.className = `score-card__team-wrapper score-card__team-wrapper--${key}`;
    const selectContainer = document.createElement("div");
    selectContainer.className = "score-card__player-selects";
    selectContainer.append(selects.primary, selects.secondary);
    const playerPicker = document.createElement("div");
    playerPicker.className = "score-card__player-picker";
    const pickerToggle = document.createElement("button");
    pickerToggle.type = "button";
    pickerToggle.className = "score-card__player-picker-toggle";
    pickerToggle.setAttribute("aria-expanded", "false");
    bindLocalizedText(pickerToggle, "scoreCardPlayersToggle");
    pickerToggle.addEventListener("click", () => {
      const isOpen = playerPicker.classList.contains("score-card__player-picker--visible");
      closePlayerPickers();
      const shouldShow = !isOpen;
      playerPicker.classList.toggle("score-card__player-picker--visible", shouldShow);
      pickerToggle.setAttribute("aria-expanded", String(shouldShow));
    });
    playerPicker.append(selectContainer);
    playerPickers.push(playerPicker);
    playerPickerToggles.push(pickerToggle);
    const serveBalls = document.createElement("span");
    serveBalls.className = "score-card__serve-balls";
    serveBalls.dataset.team = key;
    wrapper.append(tile, serveBalls, pickerToggle, playerPicker);
    return { wrapper, serveBalls, playerPicker };
  };

  const syncContextControls = (): void => {
    const seasons = args.getSeasons();
    const tournaments = args.getTournaments();
    const selectedTournament = tournaments.find((entry) => entry.id === selectedTournamentId) || null;

    if (selectedTournament?.seasonId && selectedTournament.seasonId !== selectedSeasonId) {
      selectedSeasonId = selectedTournament.seasonId;
    }

    const filteredTournaments = selectedSeasonId
      ? tournaments.filter((entry) => entry.seasonId === selectedSeasonId)
      : tournaments;

    if (selectedTournamentId && !filteredTournaments.some((entry) => entry.id === selectedTournamentId)) {
      selectedTournamentId = "";
    }

    replaceOptions(
      seasonSelect,
      [
        { value: "", label: t("noSeason") },
        ...seasons.map((season) => ({
          value: season.id,
          label: season.status === "completed" ? `${season.name} • Completed` : season.name,
        })),
      ],
      selectedSeasonId,
      t("noSeason"),
    );

    replaceOptions(
      tournamentSelect,
      [
        { value: "", label: t("noTournament") },
        ...filteredTournaments.map((tournament) => ({
          value: tournament.id,
          label: tournament.status === "completed" ? `${tournament.name} • Completed` : tournament.name,
        })),
      ],
      selectedTournamentId,
      t("noTournament"),
    );
  };

  seasonSelect.addEventListener("change", () => {
    selectedSeasonId = seasonSelect.value;
    if (selectedTournamentId) {
      const selectedTournament = args.getTournaments().find((entry) => entry.id === selectedTournamentId) || null;
      if (!selectedTournament || selectedTournament.seasonId !== selectedSeasonId) {
        selectedTournamentId = "";
      }
    }
    syncContextControls();
    syncActionState();
  });

  tournamentSelect.addEventListener("change", () => {
    selectedTournamentId = tournamentSelect.value;
    const selectedTournament = args.getTournaments().find((entry) => entry.id === selectedTournamentId) || null;
    selectedSeasonId = selectedTournament?.seasonId || selectedSeasonId;
    syncContextControls();
    syncActionState();
  });


  const getPlayerLabel = (playerId: string, playersById: Map<string, LeaderboardEntry>): string =>
    playersById.get(playerId)?.displayName || t("scoreCardAnonymous");

  const getTeamLabel = (team: TeamKey, playersById: Map<string, LeaderboardEntry>): string => {
    const playerIds = team === "A"
      ? [selections.teamA1, selections.teamA2]
      : [selections.teamB1, selections.teamB2];
    const names = playerIds.filter(Boolean).map((playerId) => getPlayerLabel(playerId, playersById));
    return names.length > 0 ? names.join(" / ") : t("scoreCardAnonymous");
  };

  const getCompletedGames = (): GameRecord[] => {
    const currentWinner = getGameWinner(scoreState, pointsToWin);
    return currentWinner ? [...previousGames, { ...scoreState, winnerTeam: currentWinner }] : [...previousGames];
  };

  const getMatchWinner = (): TeamKey | null => {
    const currentWinner = getGameWinner(scoreState, pointsToWin);
    const games = currentWinner ? [...previousGames, { ...scoreState, winnerTeam: currentWinner }] : [...previousGames];
    if (formatType === "single_game") {
      return currentWinner;
    }
    const wins = games.reduce(
      (acc, game) => {
        acc[game.winnerTeam] += 1;
        return acc;
      },
      { A: 0, B: 0 },
    );
    if (wins.A >= 2) {
      return "A";
    }
    if (wins.B >= 2) {
      return "B";
    }
    return null;
  };

  const getGameWinnerText = (winner: TeamKey): string =>
    `${t("scoreCardGameWinner")}: ${winner === "A" ? t("teamALabel") : t("teamBLabel")}`;

  const getMatchWinnerText = (winner: TeamKey): string =>
    `${t("scoreCardMatchWinner")}: ${winner === "A" ? t("teamALabel") : t("teamBLabel")}`;

  const animateScoreValue = (element: HTMLSpanElement, direction: number): void => {
    if (!("animate" in element)) {
      return;
    }
    element.animate(
      [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        {
          transform: direction > 0 ? "translateY(-8px) scale(1.06)" : "translateY(8px) scale(0.97)",
          opacity: 0.78,
        },
        { transform: "translateY(0) scale(1)", opacity: 1 },
      ],
      {
        duration: 240,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    );
  };

  const syncPlayerControls = (): void => {
    const currentUserId = args.getCurrentUserId();
    const playerOptions = args.getPlayers().map((player) => ({
      value: player.userId,
      label: `${player.displayName} (${player.elo})${player.userId === currentUserId ? " (You)" : ""}`,
    }));

    const selectedValues = getSelectedValues();
    if (currentUserId && !selectedValues.includes(currentUserId) && !selections.teamA1) {
      selections.teamA1 = currentUserId;
    }

    const blockedA1 = [selections.teamA2, selections.teamB1, selections.teamB2].filter(Boolean);
    const blockedA2 = [selections.teamA1, selections.teamB1, selections.teamB2].filter(Boolean);
    const blockedB1 = [selections.teamA1, selections.teamA2, selections.teamB2].filter(Boolean);
    const blockedB2 = [selections.teamA1, selections.teamA2, selections.teamB1].filter(Boolean);

    const populateSelect = (
      select: HTMLSelectElement,
      currentValue: string,
      blocked: string[],
    ): void => {
      replaceOptions(
        select,
        [
          { value: "", label: t("scoreCardAnonymous") },
          ...playerOptions.map((player) => ({
            value: player.value,
            label: player.label,
            disabled: blocked.includes(player.value) && player.value !== currentValue,
          })),
        ],
        currentValue,
        t("scoreCardAnonymous"),
      );
    };

    populateSelect(teamSelects.teamA.primary, selections.teamA1, blockedA1);
    populateSelect(teamSelects.teamA.secondary, selections.teamA2, blockedA2);
    populateSelect(teamSelects.teamB.primary, selections.teamB1, blockedB1);
    populateSelect(teamSelects.teamB.secondary, selections.teamB2, blockedB2);

    teamSelects.teamA.secondary.hidden = matchType === "singles";
    teamSelects.teamB.secondary.hidden = matchType === "singles";

  };

  const getServeInfo = (): { servingTeam: TeamKey; servesLeft: number } => {
    const currentWinner = getGameWinner(scoreState, pointsToWin);
    if (currentWinner) {
      return {
        servingTeam: currentWinner,
        servesLeft: 0,
      };
    }

    const totalPoints = scoreState.teamA + scoreState.teamB;
    const servesPerTurn = getServesPerTurn(scoreState, pointsToWin);
    const turnIndex = Math.floor(totalPoints / servesPerTurn);
    const servingTeam = turnIndex % 2 === 0 ? currentServeStartTeam : oppositeTeam(currentServeStartTeam);
    const servesLeft = servesPerTurn - (totalPoints % servesPerTurn);
    return {
      servingTeam,
      servesLeft,
    };
  };

  const renderPreviousGames = (): void => {
    previousGamesPanel.replaceChildren(previousGamesLabel);
    if (previousGames.length === 0) {
      previousGamesPanel.hidden = true;
      return;
    }

    previousGamesPanel.hidden = false;
    previousGames.forEach((game, index) => {
      const chip = document.createElement("p");
      chip.className = "score-card__previous-game";
      chip.textContent = `G${index + 1} ${game.teamA}-${game.teamB} · ${game.winnerTeam === "A" ? t("teamALabel") : t("teamBLabel")}`;
      previousGamesPanel.append(chip);
    });
  };

  const renderScoreValues = (): void => {
    (["teamA", "teamB"] as ScoreKey[]).forEach((key) => {
      const value = scoreState[key];
      const valueElement = scoreValues[key];
      if (valueElement.textContent === String(value)) {
        return;
      }
      const previousValue = scorePreviousValues[key];
      valueElement.textContent = String(value);
      if (value !== previousValue) {
        animateScoreValue(valueElement, value > previousValue ? 1 : -1);
      }
      scorePreviousValues[key] = value;
    });
  };

  const renderTeamLabels = (): void => {
    const playersById = getPlayersById();
    (["teamA", "teamB"] as ScoreKey[]).forEach((key) => {
      const teamKey: TeamKey = key === "teamA" ? "A" : "B";
      teamNames[key].textContent = getTeamLabel(teamKey, playersById);
    });
  };

  const renderStatus = (): void => {
    const currentWinner = getGameWinner(scoreState, pointsToWin);
    const matchWinner = getMatchWinner();
    const games = getCompletedGames();
    const serveInfo = getServeInfo();
    (["teamA", "teamB"] as ScoreKey[]).forEach((key) => {
      const tile = key === "teamA" ? leftTile : rightTile;
      tile.classList.toggle("score-card__tile--locked", Boolean(currentWinner));
      tile.classList.toggle(
        "score-card__tile--winner",
        Boolean(currentWinner) && (key === "teamA" ? currentWinner === "A" : currentWinner === "B"),
      );
      tile.setAttribute("aria-disabled", String(Boolean(currentWinner)));
    });
    const activeKey = serveInfo.servingTeam === "A" ? "teamA" : "teamB";
    (["teamA", "teamB"] as ScoreKey[]).forEach((key) => {
      const tray = serveBalls[key];
      const isActive = key === activeKey && serveInfo.servesLeft > 0;
      tray.dataset.active = isActive ? "true" : "false";
      tray.dataset.servesLeft = String(serveInfo.servesLeft);
      tray.setAttribute(
        "aria-label",
        isActive ? `${serveInfo.servesLeft} ${t("scoreCardServesLeft")}` : "",
      );
      tray.title = isActive ? `${serveInfo.servesLeft} ${t("scoreCardServesLeft")}` : "";
      tray.replaceChildren();
      if (!isActive) {
        return;
      }

      for (let i = 0; i < serveInfo.servesLeft; i += 1) {
        const ball = document.createElement("span");
        ball.className = "score-card__serve-ball";
        tray.append(ball);
      }
    });

    currentGameChip.textContent = formatType === "best_of_3"
      ? `${t("scoreCardCurrentGame")} ${previousGames.length + 1} / 3`
      : t("scoreCardCurrentGame");

    const previousGamesWins = games.reduce(
      (acc, game) => {
        acc[game.winnerTeam] += 1;
        return acc;
      },
      { A: 0, B: 0 },
    );

    resultChip.textContent = `${t("scoreCardMatchScore")}: ${previousGamesWins.A} - ${previousGamesWins.B}`;
    resultChip.dataset.state = currentWinner || matchWinner ? "winner" : "neutral";

    if (statusKind === "success" || statusKind === "error" || statusMessage) {
      savedChip.hidden = false;
      savedChip.textContent = statusMessage;
      savedChip.dataset.state = statusKind;
    } else {
      savedChip.hidden = true;
      savedChip.textContent = "";
    }
  };

  const syncActionState = (): void => {
    const currentWinner = getGameWinner(scoreState, pointsToWin);
    const matchWinner = getMatchWinner();
    const currentUserId = args.getCurrentUserId();
    const snapshot = buildPayloadSnapshot({
      matchType,
      formatType,
      pointsToWin,
      seasonId: selectedSeasonId,
      tournamentId: selectedTournamentId,
      selections,
      games: previousGames,
      currentScore: scoreState,
      currentWinner,
      matchWinner,
    });
    const includesCurrentUser = currentUserId ? getSelectedValues().includes(currentUserId) : false;
    const canSave =
      Boolean(saveHandler) &&
      Boolean(matchWinner) &&
      snapshot !== savedSnapshot &&
      !saving &&
      includesCurrentUser &&
      ((matchType === "singles" && Boolean(selections.teamA1 && selections.teamB1)) ||
        (matchType === "doubles" &&
          Boolean(selections.teamA1 && selections.teamA2 && selections.teamB1 && selections.teamB2)));

    saveButton.disabled = !canSave;
    saveButton.hidden = !Boolean(matchWinner);
    contextPanel.hidden = !canSave;
    nextGameButton.hidden = !(formatType === "best_of_3" && currentWinner && !matchWinner);
    nextGameButton.disabled = !(formatType === "best_of_3" && currentWinner && !matchWinner) || saving;
    resetButton.disabled = saving;
  };

  const sync = (): void => {
    closePlayerPickers();
    syncPlayerControls();
    syncContextControls();
    renderTeamLabels();
    renderScoreValues();
    renderPreviousGames();
    renderStatus();
    syncActionState();
    updatePressedState(matchTypeToggle, matchType);
    updatePressedState(formatTypeToggle, formatType);
    updatePressedState(pointsToggle, String(pointsToWin));
  };

  const setScore = (key: ScoreKey, delta: number): void => {
    const nextValue = Math.max(0, scoreState[key] + delta);
    if (nextValue === scoreState[key]) {
      return;
    }
    scoreState[key] = nextValue;
    statusMessage = "";
    statusKind = "idle";
    sync();
  };

  const completeCurrentGame = (): void => {
    const winner = getGameWinner(scoreState, pointsToWin);
    if (!winner) {
      return;
    }
    previousGames.push({ ...scoreState, winnerTeam: winner });
    scoreState.teamA = 0;
    scoreState.teamB = 0;
    currentServeStartTeam = formatType === "best_of_3" ? oppositeTeam(currentServeStartTeam) : randomTeam();
    statusMessage = "";
    statusKind = "idle";
    savedSnapshot = "";
    sync();
  };

  const reset = (): void => {
    matchType = "singles";
    formatType = "single_game";
    pointsToWin = 11;
    selectedSeasonId = args.getSelectedSeasonId();
    selectedTournamentId = args.getSelectedTournamentId();
    selections.teamA1 = "";
    selections.teamA2 = "";
    selections.teamB1 = "";
    selections.teamB2 = "";
    scoreState.teamA = 0;
    scoreState.teamB = 0;
    previousGames.splice(0, previousGames.length);
    currentServeStartTeam = randomTeam();
    savedSnapshot = "";
    statusMessage = "";
    statusKind = "idle";
    saving = false;
    sync();
  };

  const buildSavePayload = (): CreateMatchPayload | null => {
    const matchWinner = getMatchWinner();
    if (!matchWinner) {
      return null;
    }
    const games = getCompletedGames();
    const teamAPlayerIds = [selections.teamA1, selections.teamA2].filter(Boolean);
    const teamBPlayerIds = [selections.teamB1, selections.teamB2].filter(Boolean);
    const allPlayerIds = [...teamAPlayerIds, ...teamBPlayerIds];
    const expectedPlayerCount = matchType === "singles" ? 2 : 4;
    if (
      allPlayerIds.length !== expectedPlayerCount ||
      new Set(allPlayerIds).size !== allPlayerIds.length
    ) {
      return null;
    }

    const selectedTournament = args.getTournaments().find((entry) => entry.id === selectedTournamentId) || null;
    const seasonId = selectedTournament?.seasonId || selectedSeasonId || null;

    return {
      matchType,
      formatType,
      pointsToWin,
      teamAPlayerIds,
      teamBPlayerIds,
      score: games.map((game) => ({ teamA: game.teamA, teamB: game.teamB })),
      winnerTeam: matchWinner,
      playedAt: new Date().toISOString(),
      seasonId,
      tournamentId: selectedTournamentId || null,
      tournamentBracketMatchId: null,
    };
  };

  const saveMatch = async (): Promise<void> => {
    const payload = buildSavePayload();
    if (!payload || !saveHandler) {
      return;
    }

    saving = true;
    statusMessage = "";
    statusKind = "idle";
    sync();
    try {
      await saveHandler(payload);
      savedSnapshot = buildPayloadSnapshot({
        matchType,
        formatType,
        pointsToWin,
        seasonId: selectedSeasonId,
        tournamentId: selectedTournamentId,
        selections,
        games: previousGames,
        currentScore: scoreState,
        currentWinner: getGameWinner(scoreState, pointsToWin),
        matchWinner: getMatchWinner(),
      });
      statusMessage = t("scoreCardSavedMatch");
      statusKind = "success";
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : t("scoreCardSaveFailed");
      statusKind = "error";
    } finally {
      saving = false;
      sync();
    }
  };

  const handlePointerEnd = (tile: HTMLButtonElement, key: ScoreKey, event: PointerEvent): void => {
    const meta = pointerMeta.get(tile);
    if (!meta) {
      return;
    }
    const shouldDecrement = meta.dragged;
    const hasWinner = Boolean(getGameWinner(scoreState, pointsToWin));
    if (shouldDecrement) {
      setScore(key, -1);
    } else if (!hasWinner) {
      setScore(key, 1);
    }
    pointerMeta.delete(tile);
    tile.classList.remove("score-card__tile--dragging");
    if (tile.hasPointerCapture(event.pointerId)) {
      tile.releasePointerCapture(event.pointerId);
    }
  };

  const createScoreTile = (key: ScoreKey): HTMLButtonElement => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "score-card__tile";

    const teamName = teamNames[key];
    teamName.className = "score-card__team-name";
    teamName.textContent = t("scoreCardAnonymous");

    const tileValue = document.createElement("span");
    tileValue.className = "score-card__tile-value";
    tileValue.textContent = "0";
    scoreValues[key] = tileValue;

    tile.append(teamName, tileValue);

    tile.addEventListener("pointerdown", (event) => {
      tile.setPointerCapture(event.pointerId);
      pointerMeta.set(tile, { startX: event.clientX, startY: event.clientY, dragged: false });
    });

    tile.addEventListener("pointermove", (event) => {
      const meta = pointerMeta.get(tile);
      if (!meta) {
        return;
      }
      const dx = event.clientX - meta.startX;
      const dy = event.clientY - meta.startY;
      if (!meta.dragged && Math.hypot(dx, dy) >= 10) {
        meta.dragged = true;
        tile.classList.add("score-card__tile--dragging");
      }
    });

    tile.addEventListener("pointerup", (event) => {
      handlePointerEnd(tile, key, event);
    });
    tile.addEventListener("pointercancel", (event) => {
      handlePointerEnd(tile, key, event);
    });

    return tile;
  };

  const leftTile = createScoreTile("teamA");
  const rightTile = createScoreTile("teamB");
  const leftWrapper = buildTeamWrapper("teamA", leftTile, teamSelects.teamA);
  const rightWrapper = buildTeamWrapper("teamB", rightTile, teamSelects.teamB);
  const serveBalls: Record<ScoreKey, HTMLSpanElement> = {
    teamA: leftWrapper.serveBalls,
    teamB: rightWrapper.serveBalls,
  };
  tiles.append(leftWrapper.wrapper, rightWrapper.wrapper);

  const scoreActions = document.createElement("div");
  scoreActions.className = "score-card__actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "secondary-button";
  bindLocalizedText(resetButton, "resetScoreCard");
  resetButton.addEventListener("click", reset);

  const nextGameButton = document.createElement("button");
  nextGameButton.type = "button";
  nextGameButton.className = "secondary-button";
  bindLocalizedText(nextGameButton, "scoreCardNextGame");
  nextGameButton.addEventListener("click", completeCurrentGame);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "primary-button";
  bindLocalizedText(saveButton, "scoreCardSaveMatch");
  saveButton.addEventListener("click", () => {
    void saveMatch();
  });

  scoreActions.append(resetButton, nextGameButton, saveButton);

  header.append(titleBlock);
  topLine.append(statusPanel);
  controls.append(topLine);
  scoreCard.append(closeButton, header, controls, tiles, contextPanel, previousGamesPanel, scoreActions);
  overlay.append(scoreCard);

  const hide = (): void => {
    overlay.hidden = true;
    visible = false;
    document.body.classList.remove("score-card-open");
  };

  const show = (): void => {
    overlay.hidden = false;
    visible = true;
    document.body.classList.add("score-card-open");
    sync();
  };

  sync();

  return {
    overlay,
    openButton,
    closeButton,
    resetButton,
    saveButton,
    nextGameButton,
    isVisible: () => visible,
    show,
    hide,
    sync,
    setSaveMatchHandler: (handler: SaveMatchHandler) => {
      saveHandler = handler;
      sync();
    },
  };
};
