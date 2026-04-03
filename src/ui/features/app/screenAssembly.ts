import type { MatchFeedFilter } from "../../../api/contract";
import {
  buildMatchScreen,
  buildSeasonCheckboxField,
  buildSeasonScreen,
  buildTournamentScreen,
} from "../createScreens/builders";
import { attachDashboardLayout, buildDashboardHeader } from "../dashboard/shell";
import { buildSharePanel as buildSharePanelUi } from "../../shared/components/sharePanel";
import type { TextKey } from "../../shared/i18n/translations";

export const assembleAppScreens = (args: {
  replaceOptions: (
    select: HTMLSelectElement,
    options: Array<{ value: string; label: string }>,
    selectedValue: string,
    emptyLabel: string,
  ) => void;
  t: (key: TextKey) => string;
  welcomeTitle: HTMLHeadingElement;
  refreshButton: HTMLButtonElement;
  welcomeText: HTMLParagraphElement;
  dashboard: HTMLElement;
  progressPanel: HTMLElement;
  dashboardStatus: HTMLElement;
  viewGrid: HTMLElement;
  leaderboardPanel: HTMLElement;
  matchesPanel: HTMLElement;
  seasonBaseEloSelect: HTMLSelectElement;
  seasonIsActiveInput: HTMLInputElement;
  seasonIsPublicInput: HTMLInputElement;
  createMatchScreen: HTMLElement;
  composerPanel: HTMLElement;
  composerTop: HTMLElement;
  composerHeading: HTMLElement;
  composerTitle: HTMLHeadingElement;
  composerMeta: HTMLParagraphElement;
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
  scoreInputs: Array<{
    teamA: HTMLInputElement;
    teamB: HTMLInputElement;
    teamALabel: HTMLSpanElement;
    teamBLabel: HTMLSpanElement;
  }>;
  submitMatchButton: HTMLButtonElement;
  createTournamentScreen: HTMLElement;
  tournamentPanel: HTMLElement;
  tournamentTop: HTMLElement;
  tournamentHeading: HTMLElement;
  tournamentTitle: HTMLHeadingElement;
  tournamentMeta: HTMLParagraphElement;
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
  createSeasonScreen: HTMLElement;
  seasonPanel: HTMLElement;
  seasonTop: HTMLElement;
  seasonHeading: HTMLElement;
  seasonTitle: HTMLHeadingElement;
  seasonMeta: HTMLParagraphElement;
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
  submitSeasonButton: HTMLButtonElement;
  deleteSeasonButton: HTMLButtonElement;
}) => {
  const { dashboardHeader } = buildDashboardHeader({
    welcomeTitle: args.welcomeTitle,
    refreshButton: args.refreshButton,
    welcomeText: args.welcomeText,
  });
  attachDashboardLayout({
    dashboard: args.dashboard,
    dashboardHeader,
    progressPanel: args.progressPanel,
    dashboardStatus: args.dashboardStatus,
    viewGrid: args.viewGrid,
    leaderboardPanel: args.leaderboardPanel,
    matchesPanel: args.matchesPanel,
  });

  const seasonSharePanelInstance = buildSharePanelUi("season");
  const tournamentSharePanelInstance = buildSharePanelUi("tournament");

  args.replaceOptions(
    args.seasonBaseEloSelect,
    [
      { value: "carry_over", label: args.t("carryOverElo") },
      { value: "reset_1200", label: args.t("resetElo") },
    ],
    "carry_over",
    args.t("carryOverElo"),
  );

  const seasonActiveField = buildSeasonCheckboxField(args.seasonIsActiveInput, "seasonActiveLabel");
  const seasonPublicField = buildSeasonCheckboxField(args.seasonIsPublicInput, "seasonPublicLabel");

  const matchScreen = buildMatchScreen({
    screen: args.createMatchScreen,
    composerPanel: args.composerPanel,
    composerTop: args.composerTop,
    composerHeading: args.composerHeading,
    composerTitle: args.composerTitle,
    composerMeta: args.composerMeta,
    closeCreateMatchButton: args.closeCreateMatchButton,
    matchQuickBar: args.matchQuickBar,
    matchSummary: args.matchSummary,
    matchLockNotice: args.matchLockNotice,
    matchForm: args.matchForm,
    composerStatus: args.composerStatus,
    suggestMatchButton: args.suggestMatchButton,
    matchTypeSelect: args.matchTypeSelect,
    formatTypeSelect: args.formatTypeSelect,
    pointsToWinSelect: args.pointsToWinSelect,
    formSeasonSelect: args.formSeasonSelect,
    formTournamentSelect: args.formTournamentSelect,
    teamA1Select: args.teamA1Select,
    teamA2Select: args.teamA2Select,
    teamB1Select: args.teamB1Select,
    teamB2Select: args.teamB2Select,
    winnerTeamSelect: args.winnerTeamSelect,
    scoreInputs: args.scoreInputs,
    submitMatchButton: args.submitMatchButton,
  });

  const tournamentScreen = buildTournamentScreen({
    screen: args.createTournamentScreen,
    tournamentPanel: args.tournamentPanel,
    tournamentTop: args.tournamentTop,
    tournamentHeading: args.tournamentHeading,
    tournamentTitle: args.tournamentTitle,
    tournamentMeta: args.tournamentMeta,
    closeCreateTournamentButton: args.closeCreateTournamentButton,
    tournamentQuickBar: args.tournamentQuickBar,
    participantSection: args.participantSection,
    participantLabel: args.participantLabel,
    tournamentSelectAllParticipantsField: args.tournamentSelectAllParticipantsField,
    participantList: args.participantList,
    suggestTournamentButton: args.suggestTournamentButton,
    saveTournamentButton: args.saveTournamentButton,
    deleteTournamentButton: args.deleteTournamentButton,
    tournamentStatus: args.tournamentStatus,
    loadTournamentSelect: args.loadTournamentSelect,
    tournamentLoadActions: args.tournamentLoadActions,
    tournamentSeasonSelect: args.tournamentSeasonSelect,
    tournamentNameInput: args.tournamentNameInput,
    tournamentDateInput: args.tournamentDateInput,
    bracketBoard: args.bracketBoard,
  });

  const seasonScreen = buildSeasonScreen({
    screen: args.createSeasonScreen,
    seasonPanel: args.seasonPanel,
    seasonTop: args.seasonTop,
    seasonHeading: args.seasonHeading,
    seasonTitle: args.seasonTitle,
    seasonMeta: args.seasonMeta,
    closeCreateSeasonButton: args.closeCreateSeasonButton,
    seasonQuickBar: args.seasonQuickBar,
    seasonForm: args.seasonForm,
    seasonStatus: args.seasonStatus,
    loadSeasonSelect: args.loadSeasonSelect,
    seasonLoadActions: args.seasonLoadActions,
    seasonNameInput: args.seasonNameInput,
    seasonStartDateInput: args.seasonStartDateInput,
    seasonEndDateInput: args.seasonEndDateInput,
    seasonParticipantSection: args.seasonParticipantSection,
    seasonParticipantLabel: args.seasonParticipantLabel,
    seasonSelectAllParticipantsField: args.seasonSelectAllParticipantsField,
    seasonParticipantList: args.seasonParticipantList,
    seasonBaseEloSelect: args.seasonBaseEloSelect,
    seasonActiveField,
    seasonPublicField,
    submitSeasonButton: args.submitSeasonButton,
    deleteSeasonButton: args.deleteSeasonButton,
  });

  return {
    seasonSharePanelInstance,
    tournamentSharePanelInstance,
    ...matchScreen,
    ...tournamentScreen,
    ...seasonScreen,
  };
};
