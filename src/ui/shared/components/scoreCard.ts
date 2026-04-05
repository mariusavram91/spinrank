import type { CreateMatchPayload, LeaderboardEntry, SeasonRecord } from "../../../api/contract";
import { bindLocalizedText, registerTranslation, t } from "../i18n/runtime";
import type { TextKey } from "../i18n/translations";
import { isCompletedSeason, shouldShowSeasonInDropdown } from "../../features/app/helpers";

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

type PlayerSearchControl = {
  field: HTMLDivElement;
  input: HTMLInputElement;
  clearButton: HTMLButtonElement;
  menu: HTMLDivElement;
  optionsByLabel: Map<string, string>;
  visible: boolean;
  ignoreBlur: boolean;
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
  getSelectedSeasonId: () => string;
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
  let selectedSeasonId = args.getSelectedSeasonId();

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

  contextFields.append(seasonField);
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
    [
      teamSearchControls.teamA.primary,
      teamSearchControls.teamA.secondary,
      teamSearchControls.teamB.primary,
      teamSearchControls.teamB.secondary,
    ].forEach((control) => {
      control.menu.hidden = true;
      control.field.classList.remove("score-card__player-search-field--open");
      control.input.setAttribute("aria-expanded", "false");
      control.visible = false;
    });
  };
  let currentServeStartTeam: TeamKey = randomTeam();
  let visible = false;
  let saveHandler: SaveMatchHandler | null = null;
  let saving = false;
  let savedSnapshot = "";
  let statusMessage = "";
  let statusKind: "idle" | "error" = "idle";
  const getSelectedValues = (): string[] =>
    [selections.teamA1, selections.teamA2, selections.teamB1, selections.teamB2].filter(Boolean);
  let keepPlayerPickersOpenOnNextSync = false;
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

  const getSelectionValue = (team: ScoreKey, slot: 1 | 2): string => {
    if (team === "teamA") {
      return slot === 1 ? selections.teamA1 : selections.teamA2;
    }
    return slot === 1 ? selections.teamB1 : selections.teamB2;
  };

  const createPlayerSearchControl = (team: ScoreKey, slot: 1 | 2): PlayerSearchControl => {
    const field = document.createElement("div");
    field.className = "score-card__player-search-field";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input score-card__player-search";
    input.dataset.team = team;
    input.dataset.slot = String(slot);
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("role", "combobox");

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "score-card__player-search-clear";
    clearButton.setAttribute("aria-label", t("clearSearch"));
    clearButton.textContent = "x";

    const menu = document.createElement("div");
    menu.className = "score-card__player-search-menu";
    menu.hidden = true;

    let control!: PlayerSearchControl;
    const updateMenuPlacement = (): void => {
      const viewportHeight = globalThis.visualViewport?.height ?? globalThis.innerHeight;
      const fieldRect = field.getBoundingClientRect();
      const menuHeight = Math.min(menu.scrollHeight || 180, 180);
      const gap = 6;
      const spaceBelow = viewportHeight - fieldRect.bottom;
      const spaceAbove = fieldRect.top;
      const shouldOpenAbove = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
      menu.dataset.placement = shouldOpenAbove ? "top" : "bottom";
    };
    const setMenuVisibility = (visible: boolean): void => {
      menu.hidden = !visible;
      field.classList.toggle("score-card__player-search-field--open", visible);
      input.setAttribute("aria-expanded", String(visible));
      control.visible = visible;
      if (visible) {
        requestAnimationFrame(updateMenuPlacement);
      } else {
        delete menu.dataset.placement;
      }
    };

    const updateClearButtonVisibility = (): void => {
      clearButton.hidden = input.value.trim().length === 0;
    };

    input.addEventListener("focus", () => {
      populatePlayerSearchOptions(team, slot, input.value);
      setMenuVisibility(true);
    });
    input.addEventListener("input", () => {
      populatePlayerSearchOptions(team, slot, input.value);
      updateClearButtonVisibility();
      setMenuVisibility(true);
    });
    input.addEventListener("change", () => {
      commitPlayerSearchValue(team, slot);
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (control.ignoreBlur) {
          control.ignoreBlur = false;
          return;
        }
        setMenuVisibility(false);
        syncPlayerSearchControl(team, slot);
      }, 0);
    });

    clearButton.addEventListener("click", () => {
      control.ignoreBlur = true;
      input.value = "";
      updateClearButtonVisibility();
      setSelectionValue(team, slot, "");
      keepPlayerPickersOpenOnNextSync = true;
      handleSelectionChange();
      populatePlayerSearchOptions(team, slot, "");
      setMenuVisibility(true);
      input.focus();
    });

    field.append(input, clearButton, menu);
    control = {
      field,
      input,
      clearButton,
      menu,
      optionsByLabel: new Map<string, string>(),
      visible: false,
      ignoreBlur: false,
    };
    updateClearButtonVisibility();
    return control;
  };

  const teamSearchControls: Record<
    ScoreKey,
    { primary: PlayerSearchControl; secondary: PlayerSearchControl }
  > = {
    teamA: {
      primary: createPlayerSearchControl("teamA", 1),
      secondary: createPlayerSearchControl("teamA", 2),
    },
    teamB: {
      primary: createPlayerSearchControl("teamB", 1),
      secondary: createPlayerSearchControl("teamB", 2),
    },
  };
  let activeFocusTarget: HTMLElement | null = null;
  let focusScrollFrame: number | null = null;
  let focusScrollTimeout: number | null = null;
  const scrollFocusedControlIntoView = (): void => {
    if (!visible || !activeFocusTarget || !scoreCard.contains(activeFocusTarget)) {
      return;
    }
    activeFocusTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
    [
      teamSearchControls.teamA.primary,
      teamSearchControls.teamA.secondary,
      teamSearchControls.teamB.primary,
      teamSearchControls.teamB.secondary,
    ].forEach((control) => {
      if (!control.visible) {
        return;
      }
      control.menu.dataset.placement = "";
      requestAnimationFrame(() => {
        const viewportHeight = globalThis.visualViewport?.height ?? globalThis.innerHeight;
        const fieldRect = control.field.getBoundingClientRect();
        const menuHeight = Math.min(control.menu.scrollHeight || 180, 180);
        const gap = 6;
        const spaceBelow = viewportHeight - fieldRect.bottom;
        const spaceAbove = fieldRect.top;
        const shouldOpenAbove = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
        control.menu.dataset.placement = shouldOpenAbove ? "top" : "bottom";
      });
    });
  };
  const scheduleFocusedControlScroll = (): void => {
    if (focusScrollFrame !== null) {
      cancelAnimationFrame(focusScrollFrame);
    }
    if (focusScrollTimeout !== null) {
      window.clearTimeout(focusScrollTimeout);
    }
    focusScrollFrame = requestAnimationFrame(() => {
      scrollFocusedControlIntoView();
      focusScrollTimeout = window.setTimeout(scrollFocusedControlIntoView, 180);
    });
  };
  const buildTeamWrapper = (
    key: ScoreKey,
    tile: HTMLButtonElement,
    controls: { primary: PlayerSearchControl; secondary: PlayerSearchControl },
  ): {
    wrapper: HTMLDivElement;
    serveBalls: HTMLSpanElement;
    playerPicker: HTMLDivElement;
  } => {
    const wrapper = document.createElement("div");
    wrapper.className = `score-card__team-wrapper score-card__team-wrapper--${key}`;
    const selectContainer = document.createElement("div");
    selectContainer.className = "score-card__player-selects";
    selectContainer.append(controls.primary.field, controls.secondary.field);
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
    const currentUserId = args.getCurrentUserId();
    replaceOptions(
      seasonSelect,
      [
        { value: "", label: t("noSeason") },
        ...seasons.filter((season) => shouldShowSeasonInDropdown(season, currentUserId)).map((season) => ({
          value: season.id,
          label: isCompletedSeason(season)
            ? `${season.name} • Completed`
            : season.name,
        })),
      ],
      selectedSeasonId,
      t("noSeason"),
    );
  };

  seasonSelect.addEventListener("change", () => {
    selectedSeasonId = seasonSelect.value;
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

  const getBlockedIds = (team: ScoreKey, slot: 1 | 2): string[] => {
    return [
      team === "teamA" && slot === 1 ? "" : selections.teamA1,
      team === "teamA" && slot === 2 ? "" : selections.teamA2,
      team === "teamB" && slot === 1 ? "" : selections.teamB1,
      team === "teamB" && slot === 2 ? "" : selections.teamB2,
    ].filter(Boolean);
  };

  const getPlayerOptionLabel = (player: LeaderboardEntry, currentUserId: string): string =>
    `${player.displayName} (${player.elo})${player.userId === currentUserId ? " (You)" : ""}`;

  const getPlayerSearchControl = (team: ScoreKey, slot: 1 | 2): PlayerSearchControl =>
    team === "teamA"
      ? (slot === 1 ? teamSearchControls.teamA.primary : teamSearchControls.teamA.secondary)
      : (slot === 1 ? teamSearchControls.teamB.primary : teamSearchControls.teamB.secondary);

  const populatePlayerSearchOptions = (team: ScoreKey, slot: 1 | 2, query: string): void => {
    const currentUserId = args.getCurrentUserId();
    const control = getPlayerSearchControl(team, slot);
    const currentValue = getSelectionValue(team, slot);
    const blockedIds = new Set(getBlockedIds(team, slot).filter((value) => value !== currentValue));
    const filtered = args.getPlayers()
      .filter((player) => !blockedIds.has(player.userId) || player.userId === currentValue)
      .filter((player) => {
        if (!query.trim()) {
          return true;
        }
        const normalized = query.trim().toLowerCase();
        const optionLabel = getPlayerOptionLabel(player, currentUserId).toLowerCase();
        return (
          player.displayName.toLowerCase().includes(normalized) ||
          optionLabel.includes(normalized)
        );
      })
      .sort((left, right) => {
        if (!query.trim()) {
          if (left.userId === currentUserId) {
            return -1;
          }
          if (right.userId === currentUserId) {
            return 1;
          }
        }
        return left.rank - right.rank;
      })
      .slice(0, query.trim() ? 12 : 8);

    control.optionsByLabel = new Map(
      filtered.map((player) => [getPlayerOptionLabel(player, currentUserId), player.userId]),
    );
    control.menu.replaceChildren(
      ...(
        filtered.length > 0
          ? filtered.map((player) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "score-card__player-search-option";
            option.textContent = getPlayerOptionLabel(player, currentUserId);
            option.addEventListener("pointerdown", (event) => {
              event.preventDefault();
              control.ignoreBlur = true;
            });
            option.addEventListener("click", () => {
              control.input.value = getPlayerOptionLabel(player, currentUserId);
              setSelectionValue(team, slot, player.userId);
              control.clearButton.hidden = false;
              control.menu.hidden = true;
              control.field.classList.remove("score-card__player-search-field--open");
              control.input.setAttribute("aria-expanded", "false");
              control.visible = false;
              handleSelectionChange();
            });
            return option;
          })
          : [(() => {
            const emptyState = document.createElement("div");
            emptyState.className = "score-card__player-search-empty";
            emptyState.textContent = t("scoreCardNoPlayersFound");
            return emptyState;
          })()]
      ),
    );
  };

  const syncPlayerSearchControl = (team: ScoreKey, slot: 1 | 2): void => {
    const currentUserId = args.getCurrentUserId();
    const control = getPlayerSearchControl(team, slot);
    const player = args.getPlayers().find((entry) => entry.userId === getSelectionValue(team, slot));
    control.input.value = player ? getPlayerOptionLabel(player, currentUserId) : "";
    control.clearButton.hidden = control.input.value.trim().length === 0;
  };

  const commitPlayerSearchValue = (team: ScoreKey, slot: 1 | 2): void => {
    const control = getPlayerSearchControl(team, slot);
    const value = control.input.value.trim();
    if (!value) {
      setSelectionValue(team, slot, "");
      handleSelectionChange();
      return;
    }
    populatePlayerSearchOptions(team, slot, value);
    const nextSelection = control.optionsByLabel.get(value);
    if (!nextSelection) {
      syncPlayerSearchControl(team, slot);
      return;
    }
    setSelectionValue(team, slot, nextSelection);
    handleSelectionChange();
  };

  const syncPlayerControls = (): void => {
    const currentUserId = args.getCurrentUserId();
    const selectedValues = getSelectedValues();
    if (currentUserId && !selectedValues.includes(currentUserId) && !selections.teamA1) {
      selections.teamA1 = currentUserId;
    }
    populatePlayerSearchOptions("teamA", 1, teamSearchControls.teamA.primary.input.value);
    populatePlayerSearchOptions("teamA", 2, teamSearchControls.teamA.secondary.input.value);
    populatePlayerSearchOptions("teamB", 1, teamSearchControls.teamB.primary.input.value);
    populatePlayerSearchOptions("teamB", 2, teamSearchControls.teamB.secondary.input.value);
    syncPlayerSearchControl("teamA", 1);
    syncPlayerSearchControl("teamA", 2);
    syncPlayerSearchControl("teamB", 1);
    syncPlayerSearchControl("teamB", 2);
    teamSearchControls.teamA.secondary.field.hidden = matchType === "singles";
    teamSearchControls.teamB.secondary.field.hidden = matchType === "singles";

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

    if (statusKind === "error" && statusMessage) {
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
      tournamentId: "",
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
    if (!keepPlayerPickersOpenOnNextSync) {
      closePlayerPickers();
    }
    keepPlayerPickersOpenOnNextSync = false;
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

    return {
      matchType,
      formatType,
      pointsToWin,
      teamAPlayerIds,
      teamBPlayerIds,
      score: games.map((game) => ({ teamA: game.teamA, teamB: game.teamB })),
      winnerTeam: matchWinner,
      playedAt: new Date().toISOString(),
      seasonId: selectedSeasonId || null,
      tournamentId: null,
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
      reset();
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
  const leftWrapper = buildTeamWrapper("teamA", leftTile, teamSearchControls.teamA);
  const rightWrapper = buildTeamWrapper("teamB", rightTile, teamSearchControls.teamB);
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

  scoreCard.addEventListener("focusin", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const isFocusableField = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement;
    activeFocusTarget = isFocusableField ? event.target : null;
    if (activeFocusTarget) {
      scheduleFocusedControlScroll();
    }
  });

  scoreCard.addEventListener("focusout", (event) => {
    if (event.target === activeFocusTarget) {
      activeFocusTarget = null;
    }
  });

  globalThis.visualViewport?.addEventListener("resize", scheduleFocusedControlScroll);

  const hide = (): void => {
    overlay.hidden = true;
    visible = false;
    activeFocusTarget = null;
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
