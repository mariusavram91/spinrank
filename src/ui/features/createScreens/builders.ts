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
  teamA2Field: HTMLLabelElement;
  teamB1Field: HTMLLabelElement;
  teamB2Field: HTMLLabelElement;
  scoreGrid: HTMLDivElement;
}

export const buildMatchScreen = (args: {
  screen: HTMLElement;
  composerPanel: HTMLElement;
  composerTop: HTMLElement;
  composerHeading: HTMLElement;
  composerTitle: HTMLElement;
  composerMeta: HTMLElement;
  closeCreateMatchButton: HTMLButtonElement;
  matchQuickBar: HTMLElement;
  matchSummary: HTMLElement;
  matchLockNotice: HTMLElement;
  matchForm: HTMLFormElement;
  composerStatus: HTMLElement;
  suggestMatchButton: HTMLButtonElement;
  matchTypeSelect: HTMLSelectElement;
  formatTypeSelect: HTMLSelectElement;
  pointsToWinSelect: HTMLSelectElement;
  formSeasonSelect: HTMLSelectElement;
  formTournamentSelect: HTMLSelectElement;
  teamA1Select: HTMLSelectElement;
  teamA2Select: HTMLSelectElement;
  teamB1Select: HTMLSelectElement;
  teamB2Select: HTMLSelectElement;
  winnerTeamSelect: HTMLSelectElement;
  scoreInputs: ScoreInput[];
  submitMatchButton: HTMLButtonElement;
}): MatchScreenElements => {
  const teamGrid = document.createElement("div");
  teamGrid.className = "team-grid";
  const teamA1Field = buildField("teamAPlayer1", args.teamA1Select);
  const teamA2Field = buildField("teamAPlayer2", args.teamA2Select);
  const teamB1Field = buildField("teamBPlayer1", args.teamB1Select);
  const teamB2Field = buildField("teamBPlayer2", args.teamB2Select);
  teamGrid.append(teamA1Field, teamA2Field, teamB1Field, teamB2Field);

  const scoreGrid = document.createElement("div");
  scoreGrid.className = "score-grid";

  const scoreSection = document.createElement("div");
  scoreSection.className = "form-field";

  const scoreLabel = document.createElement("span");
  scoreLabel.className = "field-label";
  bindLocalizedText(scoreLabel, "scoreLabel");

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

  scoreSection.append(scoreLabel, scoreGrid);

  const matchContextSection = document.createElement("section");
  matchContextSection.className = "panel-section";
  matchContextSection.append(
    buildField("matchFieldSeason", args.formSeasonSelect),
    buildField("matchFieldTournament", args.formTournamentSelect),
  );

  const matchRulesSection = document.createElement("section");
  matchRulesSection.className = "panel-section";
  matchRulesSection.append(
    buildField("matchFieldMatchType", args.matchTypeSelect),
    buildField("matchFieldFormat", args.formatTypeSelect),
    buildField("matchFieldPoints", args.pointsToWinSelect),
  );

  const matchPlayersSection = document.createElement("section");
  matchPlayersSection.className = "panel-section";
  matchPlayersSection.append(teamGrid, args.suggestMatchButton);

  const matchReviewSection = document.createElement("section");
  matchReviewSection.className = "panel-section";
  matchReviewSection.append(buildField("matchFieldWinner", args.winnerTeamSelect), scoreSection);

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
  args.composerPanel.append(args.composerTop, args.matchQuickBar, args.matchForm);
  args.screen.append(args.composerPanel);

  return {
    teamA1Field,
    teamA2Field,
    teamB1Field,
    teamB2Field,
    scoreGrid,
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
  participantSection: HTMLElement;
  participantLabel: HTMLElement;
  tournamentSelectAllParticipantsField: HTMLElement;
  participantList: HTMLElement;
  suggestTournamentButton: HTMLButtonElement;
  saveTournamentButton: HTMLButtonElement;
  deleteTournamentButton: HTMLButtonElement;
  tournamentStatus: HTMLElement;
  loadTournamentSelect: HTMLSelectElement;
  tournamentLoadActions: HTMLElement;
  tournamentSeasonSelect: HTMLSelectElement;
  tournamentNameInput: HTMLInputElement;
  tournamentDateInput: HTMLInputElement;
  bracketBoard: HTMLElement;
}): { tournamentActionsWrapper: HTMLDivElement } => {
  args.tournamentHeading.append(args.tournamentTitle, args.tournamentMeta);
  args.tournamentTop.append(args.tournamentHeading, args.closeCreateTournamentButton);
  args.participantSection.append(
    args.participantLabel,
    args.tournamentSelectAllParticipantsField,
    args.participantList,
  );

  const tournamentActions = document.createElement("div");
  tournamentActions.className = "form-actions";
  tournamentActions.append(args.suggestTournamentButton, args.saveTournamentButton, args.deleteTournamentButton);

  const tournamentActionsWrapper = document.createElement("div");
  tournamentActionsWrapper.className = "form-actions-wrapper";
  tournamentActionsWrapper.append(tournamentActions, args.tournamentStatus);

  const tournamentDetailsSection = createPanelSection(
    "tournamentDetails",
    buildField("loadSavedTournament", args.loadTournamentSelect),
    args.tournamentLoadActions,
    buildField("tournamentSeasonLabel", args.tournamentSeasonSelect),
    buildField("tournamentName", args.tournamentNameInput),
    buildField("tournamentDate", args.tournamentDateInput),
  );
  const tournamentParticipantsSection = createPanelSection("participants", args.participantSection);
  const tournamentBracketSection = createPanelSection("bracketPreviewSection", args.bracketBoard);

  args.tournamentPanel.append(
    args.tournamentTop,
    args.tournamentQuickBar,
    tournamentDetailsSection,
    tournamentParticipantsSection,
    tournamentActionsWrapper,
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
  field.append(input, copy);
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
  seasonForm: HTMLFormElement;
  seasonStatus: HTMLElement;
  loadSeasonSelect: HTMLSelectElement;
  seasonLoadActions: HTMLElement;
  seasonNameInput: HTMLInputElement;
  seasonStartDateInput: HTMLInputElement;
  seasonEndDateInput: HTMLInputElement;
  seasonParticipantSection: HTMLElement;
  seasonParticipantLabel: HTMLElement;
  seasonSelectAllParticipantsField: HTMLElement;
  seasonParticipantList: HTMLElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonActiveField: HTMLElement;
  seasonPublicField: HTMLElement;
  submitSeasonButton: HTMLButtonElement;
  deleteSeasonButton: HTMLButtonElement;
}): { seasonActionsWrapper: HTMLDivElement } => {
  args.seasonParticipantSection.append(
    args.seasonParticipantLabel,
    args.seasonSelectAllParticipantsField,
    args.seasonParticipantList,
  );

  args.seasonHeading.append(args.seasonTitle, args.seasonMeta);
  args.seasonTop.append(args.seasonHeading, args.closeCreateSeasonButton);

  const seasonActions = document.createElement("div");
  seasonActions.className = "form-actions";
  seasonActions.append(args.submitSeasonButton, args.deleteSeasonButton);

  const seasonActionsWrapper = document.createElement("div");
  seasonActionsWrapper.className = "form-actions-wrapper";
  seasonActionsWrapper.append(seasonActions, args.seasonStatus);

  const seasonDetailsSection = createPanelSection(
    "seasonDetails",
    buildField("loadSavedSeason", args.loadSeasonSelect),
    args.seasonLoadActions,
    buildField("seasonName", args.seasonNameInput),
    buildField("seasonStartDate", args.seasonStartDateInput),
    buildField("seasonEndDate", args.seasonEndDateInput),
  );

  const seasonParticipantsSection = createPanelSection("participants", args.seasonParticipantSection);
  const seasonRulesSection = createPanelSection(
    "rankingRules",
    buildField("baseElo", args.seasonBaseEloSelect),
    args.seasonActiveField,
    args.seasonPublicField,
  );

  args.seasonForm.append(
    seasonDetailsSection,
    seasonParticipantsSection,
    seasonRulesSection,
    seasonActionsWrapper,
  );
  args.seasonPanel.append(args.seasonTop, args.seasonQuickBar, args.seasonForm);
  args.screen.append(args.seasonPanel);

  return { seasonActionsWrapper };
};
