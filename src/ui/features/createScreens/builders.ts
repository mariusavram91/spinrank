import { bindLocalizedText } from "../../shared/i18n/runtime";
import { buildField, createPanelSection } from "../../shared/components/formLayout";
import type { TextKey } from "../../shared/i18n/translations";

type ScoreInput = {
  teamA: HTMLInputElement;
  teamB: HTMLInputElement;
  teamALabel: HTMLSpanElement;
  teamBLabel: HTMLSpanElement;
};

export interface MatchScreenElements {
  teamA1Field: HTMLLabelElement;
  teamA2Field: HTMLElement;
  teamB1Field: HTMLLabelElement;
  teamB2Field: HTMLElement;
  scoreGrid: HTMLDivElement;
  contextToggle: HTMLDivElement;
  matchTypeToggle: HTMLDivElement;
  formatTypeToggle: HTMLDivElement;
  pointsToggle: HTMLDivElement;
  seasonField: HTMLElement;
  seasonInfoField: HTMLElement;
  seasonInfoValue: HTMLElement;
  tournamentField: HTMLElement;
  bracketField: HTMLElement;
  matchOutcome: HTMLElement;
}

export interface SeasonScreenElements {
  seasonActionsWrapper: HTMLDivElement;
  seasonBaseEloToggle: HTMLDivElement;
  seasonStateToggle: HTMLDivElement | null;
  seasonVisibilityToggle: HTMLDivElement;
}

const buildSegmentedControl = (
  options: Array<{ value: string; labelKey: TextKey }>,
  onSelect: (value: string) => void,
  className = "segment-toggle form-segment-toggle",
): HTMLDivElement => {
  const toggle = document.createElement("div");
  toggle.className = className;
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = option.value;
    button.setAttribute("aria-pressed", "false");
    bindLocalizedText(button, option.labelKey);
    button.addEventListener("click", () => {
      onSelect(option.value);
    });
    toggle.append(button);
  });
  return toggle;
};

const dispatchSelectChange = (select: HTMLSelectElement): void => {
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const buildChoiceRow = (labelKey: TextKey, select: HTMLSelectElement, actionButton: HTMLButtonElement): HTMLElement => {
  const row = document.createElement("div");
  row.className = "form-choice-row";

  const field = buildField(labelKey, select);
  field.classList.add("form-choice-row__field");

  const action = document.createElement("div");
  action.className = "form-choice-row__action";

  const separator = document.createElement("span");
  separator.className = "form-choice-row__separator";
  bindLocalizedText(separator, "orLabel");

  actionButton.classList.add("form-choice-row__button");
  action.append(separator, actionButton);
  row.append(field, action);
  return row;
};

export const buildMatchScreen = (args: {
  screen: HTMLElement;
  composerPanel: HTMLElement;
  composerTop: HTMLElement;
  composerHeading: HTMLElement;
  composerTitle: HTMLElement;
  composerMeta: HTMLElement;
  closeCreateMatchButton: HTMLButtonElement;
  matchQuickBar: HTMLElement;
  matchOutcome: HTMLElement;
  matchLockNotice: HTMLElement;
  matchForm: HTMLFormElement;
  composerStatus: HTMLElement;
  suggestMatchButton: HTMLButtonElement;
  matchTypeSelect: HTMLSelectElement;
  formatTypeSelect: HTMLSelectElement;
  pointsToWinSelect: HTMLSelectElement;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  matchBracketSelect: HTMLSelectElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
  winnerTeamSelect: HTMLSelectElement;
  scoreInputs: ScoreInput[];
  submitMatchButton: HTMLButtonElement;
}): MatchScreenElements => {
  const contextToggle = buildSegmentedControl(
    [
      { value: "open", labelKey: "matchContextOpen" },
      { value: "season", labelKey: "scopeSeason" },
      { value: "tournament", labelKey: "scopeTournament" },
    ],
    (value) => {
      contextToggle.dataset.mode = value;
      if (value === "open") {
        args.formSeasonSelect.value = "";
        args.formTournamentSelect.value = "";
        dispatchSelectChange(args.formSeasonSelect);
        return;
      }
      if (value === "season") {
        args.formTournamentSelect.value = "";
        dispatchSelectChange(args.formSeasonSelect);
        return;
      }
      args.formSeasonSelect.value = "";
      dispatchSelectChange(args.formTournamentSelect);
    },
    "segment-toggle",
  );
  contextToggle.dataset.mode = "open";
  Array.from(contextToggle.querySelectorAll<HTMLButtonElement>("button[data-value]")).forEach((button) => {
    button.dataset.testid = `match-context-${button.dataset.value}`;
  });

  const matchTypeToggle = buildSegmentedControl(
    [
      { value: "singles", labelKey: "matchTypeSingles" },
      { value: "doubles", labelKey: "matchTypeDoubles" },
    ],
    (value) => {
      args.matchTypeSelect.value = value;
      dispatchSelectChange(args.matchTypeSelect);
    },
  );

  const formatTypeToggle = buildSegmentedControl(
    [
      { value: "single_game", labelKey: "formatSingleGame" },
      { value: "best_of_3", labelKey: "formatBestOf3" },
    ],
    (value) => {
      args.formatTypeSelect.value = value;
      dispatchSelectChange(args.formatTypeSelect);
    },
  );

  const pointsToggle = buildSegmentedControl(
    [
      { value: "11", labelKey: "points11" },
      { value: "21", labelKey: "points21" },
    ],
    (value) => {
      args.pointsToWinSelect.value = value;
      dispatchSelectChange(args.pointsToWinSelect);
    },
  );

  const seasonField = buildField("matchFieldSeason", args.formSeasonSelect);
  seasonField.classList.add("match-context-field");

  const seasonInfoValue = document.createElement("span");
  seasonInfoValue.className = "match-context-info";
  const seasonInfoField = buildField("matchFieldSeason", seasonInfoValue);
  seasonInfoField.classList.add("match-context-field", "match-context-field--info");

  const tournamentField = buildField("matchFieldTournament", args.formTournamentSelect);
  tournamentField.classList.add("match-context-field");

  const bracketField = buildField("matchFieldBracket", args.matchBracketSelect);
  bracketField.classList.add("match-context-field");

  const teamGrid = document.createElement("div");
  teamGrid.className = "matchup-grid";
  const teamA1Field = buildField("teamAPlayer1", args.teamA1Select);
  teamA1Field.classList.add("player-slot");
  const teamA2Field = buildField("teamAPlayer2", args.teamA2Select);
  teamA2Field.className = "player-slot player-slot--secondary";
  const teamB1Field = buildField("teamBPlayer1", args.teamB1Select);
  teamB1Field.classList.add("player-slot");
  const teamB2Field = buildField("teamBPlayer2", args.teamB2Select);
  teamB2Field.className = "player-slot player-slot--secondary";

  const teamAColumn = document.createElement("div");
  teamAColumn.className = "matchup-team matchup-team--a";
  teamAColumn.append(teamA1Field, teamA2Field);

  const versus = document.createElement("div");
  versus.className = "matchup-versus";
  versus.textContent = "vs";

  const teamBColumn = document.createElement("div");
  teamBColumn.className = "matchup-team matchup-team--b";
  teamBColumn.append(teamB1Field, teamB2Field);

  teamGrid.append(teamAColumn, versus, teamBColumn);

  const scoreGrid = document.createElement("div");
  scoreGrid.className = "score-grid";

  const scoreSection = document.createElement("div");
  scoreSection.className = "form-field";

  args.scoreInputs.forEach((game, index) => {
    const gameBlock = document.createElement("div");
    gameBlock.className = "score-game-block";

    const gameLabel = document.createElement("span");
    gameLabel.className = "score-game-heading";
    gameLabel.textContent = `Game ${index + 1}`;

    const row = document.createElement("div");
    row.className = "score-row";

    const separator = document.createElement("span");
    separator.className = "score-separator";
    separator.textContent = "-";

    const teamACell = document.createElement("div");
    teamACell.className = "score-input-cell score-input-cell--left";
    game.teamALabel.className = "score-input-label";
    teamACell.append(game.teamALabel, game.teamA);

    const teamBCell = document.createElement("div");
    teamBCell.className = "score-input-cell score-input-cell--right";
    game.teamBLabel.className = "score-input-label";
    teamBCell.append(game.teamBLabel, game.teamB);

    row.append(teamACell, separator, teamBCell);
    gameBlock.append(gameLabel, row);
    scoreGrid.append(gameBlock);
  });

  scoreSection.append(scoreGrid);

  const matchContextSection = createPanelSection(
    "matchSectionContext",
    contextToggle,
    seasonField,
    seasonInfoField,
    tournamentField,
    bracketField,
  );
  matchContextSection.classList.add("panel-section--match", "panel-section--match-context");

  args.matchTypeSelect.classList.add("form-toggle-select");
  args.formatTypeSelect.classList.add("form-toggle-select");
  args.pointsToWinSelect.classList.add("form-toggle-select");
  args.winnerTeamSelect.classList.add("form-toggle-select");
  args.matchOutcome.className = "match-outcome";
  bindLocalizedText(args.matchOutcome, "matchOutcomePending");
  args.matchLockNotice.classList.add("match-lock-notice");

  const matchRulesSection = createPanelSection(
    "matchSectionSetup",
    matchTypeToggle,
    formatTypeToggle,
    pointsToggle,
    args.matchLockNotice,
  );
  matchRulesSection.classList.add("panel-section--match", "panel-section--match-setup");

  const matchPlayersSection = createPanelSection("matchSectionPlayers", teamGrid, args.suggestMatchButton);
  matchPlayersSection.classList.add("panel-section--match", "panel-section--match-players");

  const matchReviewSection = createPanelSection(
    "matchSectionWinnerScoring",
    args.matchOutcome,
    scoreSection,
  );
  matchReviewSection.classList.add("panel-section--match", "panel-section--match-review");

  const matchActions = document.createElement("div");
  matchActions.className = "form-actions";
  matchActions.append(args.submitMatchButton);

  const matchActionsWrapper = document.createElement("div");
  matchActionsWrapper.className = "form-actions-wrapper";
  matchActionsWrapper.append(matchActions, args.composerStatus);

  args.matchForm.append(
    matchContextSection,
    matchRulesSection,
    matchPlayersSection,
    matchReviewSection,
    matchActionsWrapper,
  );

  args.composerHeading.append(args.composerTitle, args.composerMeta);
  args.composerTop.append(args.composerHeading, args.closeCreateMatchButton);
  args.composerPanel.append(args.composerTop, args.matchForm);
  args.screen.append(args.composerPanel);

  return {
    teamA1Field,
    teamA2Field,
    teamB1Field,
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
    matchOutcome: args.matchOutcome,
  };
};

export const buildTournamentScreen = (args: {
  screen: HTMLElement;
  tournamentPanel: HTMLElement;
  tournamentTop: HTMLElement;
  tournamentHeading: HTMLElement;
  tournamentTitle: HTMLElement;
  tournamentMeta: HTMLElement;
  closeCreateTournamentButton: HTMLButtonElement;
  tournamentQuickBar: HTMLElement;
  tournamentInsights: HTMLElement;
  participantSection: HTMLElement;
  participantLabel: HTMLElement;
  participantSearchInput: HTMLInputElement;
  participantSearchResults: HTMLElement;
  participantList: HTMLElement;
  suggestTournamentButton: HTMLButtonElement;
  saveTournamentButton: HTMLButtonElement;
  deleteTournamentButton: HTMLButtonElement;
  tournamentStatus: HTMLElement;
  loadTournamentSelect: HTMLSelectElement;
  resetTournamentDraftButton: HTMLButtonElement;
  tournamentSeasonSelect: HTMLSelectElement;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  bracketBoard: HTMLElement;
}): { tournamentActionsWrapper: HTMLDivElement } => {
  args.tournamentHeading.append(args.tournamentTitle, args.tournamentMeta);
  args.tournamentTop.append(args.tournamentHeading, args.closeCreateTournamentButton);
  args.participantSection.append(
    args.participantSearchInput,
    args.participantSearchResults,
    args.participantList,
  );

  const tournamentActions = document.createElement("div");
  tournamentActions.className = "form-actions";
  tournamentActions.append(args.suggestTournamentButton, args.saveTournamentButton);

  const tournamentActionsWrapper = document.createElement("div");
  tournamentActionsWrapper.className = "form-actions-wrapper";
  tournamentActionsWrapper.append(tournamentActions);

  const tournamentEntrySection = document.createElement("section");
  tournamentEntrySection.className = "panel-section panel-section--entry panel-section--editor panel-section--editor-entry";
  tournamentEntrySection.append(buildChoiceRow("loadSavedTournament", args.loadTournamentSelect, args.resetTournamentDraftButton));

  const tournamentDetailsSection = createPanelSection(
    "tournamentDetails",
    buildField("tournamentSeasonLabel", args.tournamentSeasonSelect),
    buildField("tournamentName", args.tournamentNameInput),
    buildField("tournamentDate", args.tournamentDateInput),
  );
  tournamentDetailsSection.classList.add("panel-section--editor", "panel-section--editor-details");
  const tournamentDetailsHeading = tournamentDetailsSection.querySelector("h4");
  if (tournamentDetailsHeading) {
    const tournamentDetailsHeader = document.createElement("div");
    tournamentDetailsHeader.className = "panel-section__header";
    args.deleteTournamentButton.className = "icon-button section-delete-button";
    args.deleteTournamentButton.textContent = "🗑";
    args.deleteTournamentButton.setAttribute("aria-label", "Delete tournament");
    args.deleteTournamentButton.title = "Delete tournament";
    tournamentDetailsHeading.replaceWith(tournamentDetailsHeader);
    tournamentDetailsHeader.append(tournamentDetailsHeading, args.deleteTournamentButton);
  }
  const tournamentParticipantsSection = createPanelSection("participants", args.participantSection);
  tournamentParticipantsSection.classList.add("panel-section--editor", "panel-section--editor-participants");
  const tournamentBracketSection = createPanelSection("bracketPreviewSection", args.bracketBoard);
  tournamentBracketSection.classList.add("panel-section--editor", "panel-section--editor-bracket");

  args.tournamentPanel.append(
    args.tournamentTop,
    args.tournamentQuickBar,
    tournamentEntrySection,
    tournamentDetailsSection,
    tournamentParticipantsSection,
    tournamentActionsWrapper,
    args.tournamentStatus,
    tournamentBracketSection,
  );
  args.screen.append(args.tournamentPanel);

  return { tournamentActionsWrapper };
};

export const buildSeasonCheckboxField = (
  input: HTMLInputElement,
  labelKey: TextKey,
): HTMLLabelElement => {
  const field = document.createElement("label");
  field.className = "checkbox-field";
  const copy = document.createElement("span");
  copy.className = "field-label";
  bindLocalizedText(copy, labelKey);
  const toggle = document.createElement("span");
  toggle.className = "checkbox-field__switch";
  const toggleThumb = document.createElement("span");
  toggleThumb.className = "checkbox-field__switch-thumb";
  toggle.append(toggleThumb);
  field.append(input, copy, toggle);
  return field;
};

export const buildSeasonScreen = (args: {
  screen: HTMLElement;
  seasonPanel: HTMLElement;
  seasonTop: HTMLElement;
  seasonHeading: HTMLElement;
  seasonTitle: HTMLElement;
  seasonMeta: HTMLElement;
  closeCreateSeasonButton: HTMLButtonElement;
  seasonQuickBar: HTMLElement;
  seasonInsights: HTMLElement;
  seasonForm: HTMLFormElement;
  seasonStatus: HTMLElement;
  loadSeasonSelect: HTMLSelectElement;
  resetSeasonDraftButton: HTMLButtonElement;
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  seasonParticipantSection: HTMLElement;
  seasonParticipantLabel: HTMLElement;
  seasonParticipantSearchInput: HTMLInputElement;
  seasonParticipantResults: HTMLElement;
  seasonParticipantList: HTMLElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonActiveField: HTMLElement;
  seasonPublicField: HTMLElement;
  submitSeasonButton: HTMLButtonElement;
  deleteSeasonButton: HTMLButtonElement;
}): SeasonScreenElements => {
  args.seasonParticipantSection.append(
    args.seasonParticipantSearchInput,
    args.seasonParticipantResults,
    args.seasonParticipantList,
  );

  args.seasonHeading.append(args.seasonTitle, args.seasonMeta);
  args.seasonTop.append(args.seasonHeading, args.closeCreateSeasonButton);

  const seasonActions = document.createElement("div");
  seasonActions.className = "form-actions";
  seasonActions.append(args.submitSeasonButton);

  const seasonActionsWrapper = document.createElement("div");
  seasonActionsWrapper.className = "form-actions-wrapper";
  seasonActionsWrapper.append(seasonActions);

  const seasonEntrySection = document.createElement("section");
  seasonEntrySection.className = "panel-section panel-section--entry panel-section--editor panel-section--editor-entry";
  seasonEntrySection.append(buildChoiceRow("loadSavedSeason", args.loadSeasonSelect, args.resetSeasonDraftButton));

  const seasonDetailsSection = createPanelSection(
    "seasonDetails",
    buildField("seasonName", args.seasonNameInput),
    buildField("seasonStartDate", args.seasonStartDateInput),
    buildField("seasonEndDate", args.seasonEndDateInput),
  );
  seasonDetailsSection.classList.add("panel-section--editor", "panel-section--editor-details");
  const seasonDetailsHeading = seasonDetailsSection.querySelector("h4");
  if (seasonDetailsHeading) {
    const seasonDetailsHeader = document.createElement("div");
    seasonDetailsHeader.className = "panel-section__header";
    args.deleteSeasonButton.className = "icon-button section-delete-button";
    args.deleteSeasonButton.textContent = "🗑";
    args.deleteSeasonButton.setAttribute("aria-label", "Delete season");
    args.deleteSeasonButton.title = "Delete season";
    seasonDetailsHeading.replaceWith(seasonDetailsHeader);
    seasonDetailsHeader.append(seasonDetailsHeading, args.deleteSeasonButton);
  }

  const seasonParticipantsSection = createPanelSection("participants", args.seasonParticipantSection);
  seasonParticipantsSection.classList.add("panel-section--editor", "panel-section--editor-participants");

  const seasonActiveInput = args.seasonActiveField.querySelector("input") as HTMLInputElement | null;
  const seasonPublicInput = args.seasonPublicField.querySelector("input") as HTMLInputElement | null;
  args.seasonBaseEloSelect.classList.add("form-toggle-select");
  if (seasonActiveInput) {
    seasonActiveInput.classList.add("form-toggle-checkbox");
  }
  if (seasonPublicInput) {
    seasonPublicInput.classList.add("form-toggle-checkbox");
  }

  const seasonBaseEloToggle = buildSegmentedControl(
    [
      { value: "carry_over", labelKey: "seasonCarryOverGlobalElo" },
      { value: "reset_1200", labelKey: "seasonResetElo1200" },
    ],
    (value) => {
      args.seasonBaseEloSelect.value = value;
      dispatchSelectChange(args.seasonBaseEloSelect);
    },
  );

  const seasonVisibilityToggle = buildSegmentedControl(
    [
      { value: "public", labelKey: "seasonVisibilityPublic" },
      { value: "private", labelKey: "seasonVisibilityPrivate" },
    ],
    (value) => {
      if (!seasonPublicInput) {
        return;
      }
      seasonPublicInput.checked = value === "public";
      seasonPublicInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
  );

  const seasonRulesSection = createPanelSection(
    "rankingRules",
    seasonBaseEloToggle,
  );
  seasonRulesSection.classList.add("panel-section--editor", "panel-section--editor-rules");
  seasonDetailsSection.append(seasonVisibilityToggle);

  args.seasonForm.append(
    seasonEntrySection,
    seasonDetailsSection,
    seasonParticipantsSection,
    seasonRulesSection,
    seasonActionsWrapper,
  );
  args.seasonPanel.append(args.seasonTop, args.seasonQuickBar, args.seasonForm);
  args.screen.append(args.seasonPanel);

  return {
    seasonActionsWrapper,
    seasonBaseEloToggle,
    seasonStateToggle: null,
    seasonVisibilityToggle,
  };
};
