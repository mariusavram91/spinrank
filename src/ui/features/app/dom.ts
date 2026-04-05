import type { LeaderboardEntry, MatchFeedFilter, SeasonRecord } from "../../../api/contract";
import { buildHelpScreens } from "../help/screens";
import { buildDashboardOverview } from "../dashboard/overview";
import { buildFooter } from "../../shared/components/footer";
import { buildLanguageSwitch } from "../../shared/components/languageSwitch";
import { buildLoginView } from "../../shared/components/loginView";
import { buildScoreCard } from "../../shared/components/scoreCard";
import { buildDeleteWarning } from "../../shared/components/deleteWarning";
import { bindLocalizedAttribute, bindLocalizedText, t } from "../../shared/i18n/runtime";
import type { TextKey } from "../../shared/i18n/translations";
import { getTodayDateValue } from "../../shared/utils/format";

type MatchScoreInputSet = {
  teamA: HTMLInputElement;
  teamB: HTMLInputElement;
  teamALabel: HTMLSpanElement;
  teamBLabel: HTMLSpanElement;
};

export const createAppDom = (args: {
  assetsBaseUrl: string;
  onMatchFilterClick: (filter: MatchFeedFilter) => void;
  buildMatchesPanel: (input: {
    matchesTitle: HTMLHeadingElement;
    matchesMeta: HTMLParagraphElement;
    matchFilters: MatchFeedFilter[];
    matchFilterLabels: Record<MatchFeedFilter, TextKey>;
    onFilterClick: (filter: MatchFeedFilter) => void;
  }) => {
    matchesPanel: HTMLElement;
    matchFilterButtons: Map<MatchFeedFilter, HTMLButtonElement>;
    matchesList: HTMLElement;
    loadMoreButton: HTMLButtonElement;
  };
  matchFilterLabels: Record<MatchFeedFilter, TextKey>;
  getPlayers: () => LeaderboardEntry[];
  getCurrentUserId: () => string;
  getSeasons: () => SeasonRecord[];
  getSelectedSeasonId: () => string;
}) => {
  const container = document.createElement("main");
  container.className = "shell";

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "app-loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.setAttribute("aria-live", "polite");
  loadingOverlay.setAttribute("aria-busy", "true");

  const loadingOverlayDialog = document.createElement("div");
  loadingOverlayDialog.className = "app-loading-overlay__dialog";
  loadingOverlayDialog.setAttribute("role", "status");

  const loadingOverlaySpinner = document.createElement("div");
  loadingOverlaySpinner.className = "app-loading-overlay__spinner";
  loadingOverlaySpinner.setAttribute("aria-hidden", "true");

  const loadingOverlayLabel = document.createElement("div");
  loadingOverlayLabel.className = "app-loading-overlay__label";
  bindLocalizedText(loadingOverlayLabel, "loadingOverlay");

  loadingOverlayDialog.append(loadingOverlaySpinner, loadingOverlayLabel);
  loadingOverlay.append(loadingOverlayDialog);

  const card = document.createElement("section");
  card.className = "panel";

  const header = document.createElement("header");
  header.className = "topbar";

  const brandMark = document.createElement("img");
  brandMark.className = "brand-mark";
  brandMark.src = `${args.assetsBaseUrl}assets/logo.png`;
  brandMark.alt = "SpinRank logo";

  const providerStack = document.createElement("div");
  providerStack.className = "provider-stack";

  const { element: languageSwitch, closeIfOutside: closeLanguageSwitchIfOutside } = buildLanguageSwitch();
  providerStack.append(languageSwitch);

  const authActions = document.createElement("div");
  authActions.className = "auth-actions";

  const authMenu = document.createElement("div");
  authMenu.className = "auth-menu";

  const createMenu = document.createElement("div");
  createMenu.className = "create-menu";

  const authAvatar = document.createElement("img");
  authAvatar.className = "auth-avatar";
  authAvatar.alt = "Signed-in user avatar";
  authAvatar.tabIndex = 0;
  authAvatar.setAttribute("role", "button");
  authAvatar.setAttribute("aria-label", "Open profile");

  const authMenuButton = document.createElement("button");
  authMenuButton.type = "button";
  authMenuButton.className = "secondary-button auth-menu-button";
  authMenuButton.textContent = "☰";
  authMenuButton.setAttribute("aria-label", "Open account menu");

  const createMenuButton = document.createElement("button");
  createMenuButton.type = "button";
  createMenuButton.className = "create-menu-button";
  createMenuButton.textContent = "+";
  createMenuButton.setAttribute("aria-label", "Open create menu");
  createMenuButton.dataset.testid = "create-menu-toggle";

  const dashboard = document.createElement("section");
  dashboard.className = "dashboard";
  dashboard.dataset.testid = "dashboard-screen";

  const createMatchScreen = document.createElement("section");
  createMatchScreen.className = "dashboard";
  createMatchScreen.hidden = true;

  const createTournamentScreen = document.createElement("section");
  createTournamentScreen.className = "dashboard";
  createTournamentScreen.hidden = true;

  const createSeasonScreen = document.createElement("section");
  createSeasonScreen.className = "dashboard";
  createSeasonScreen.hidden = true;

  const profileScreen = document.createElement("section");
  profileScreen.className = "dashboard";
  profileScreen.hidden = true;

  const profilePanel = document.createElement("section");
  profilePanel.className = "content-card profile-screen";

  const profileTop = document.createElement("div");
  profileTop.className = "card-header";

  const profileHeading = document.createElement("div");

  const profileTitle = document.createElement("h3");
  profileTitle.className = "card-title";
  bindLocalizedText(profileTitle, "profileTitle");

  const profileMeta = document.createElement("p");
  profileMeta.className = "card-meta";
  bindLocalizedText(profileMeta, "profileMeta");

  const closeProfileButton = document.createElement("button");
  closeProfileButton.type = "button";
  closeProfileButton.className = "secondary-button compact-header-button";
  bindLocalizedText(closeProfileButton, "back");

  profileHeading.append(profileTitle, profileMeta);
  profileTop.append(profileHeading, closeProfileButton);

  const profileStatus = document.createElement("p");
  profileStatus.className = "form-status";
  profileStatus.hidden = true;
  profileStatus.setAttribute("aria-live", "polite");

  const profileBody = document.createElement("div");
  profileBody.className = "profile-screen__body";

  const profileSeasonsSection = document.createElement("section");
  profileSeasonsSection.className = "profile-section";
  const profileSeasonsTitle = document.createElement("h4");
  profileSeasonsTitle.className = "card-title profile-section__title";
  bindLocalizedText(profileSeasonsTitle, "profileSeasonLabel");
  const profileSeasonsList = document.createElement("div");
  profileSeasonsList.className = "profile-card-list";
  profileSeasonsSection.append(profileSeasonsTitle, profileSeasonsList);

  const profileTournamentsSection = document.createElement("section");
  profileTournamentsSection.className = "profile-section";
  const profileTournamentsTitle = document.createElement("h4");
  profileTournamentsTitle.className = "card-title profile-section__title";
  bindLocalizedText(profileTournamentsTitle, "tournaments");
  const profileTournamentsList = document.createElement("div");
  profileTournamentsList.className = "profile-card-list";
  profileTournamentsSection.append(profileTournamentsTitle, profileTournamentsList);

  const profileMatchesSection = document.createElement("section");
  profileMatchesSection.className = "profile-section";
  const profileMatchesTitle = document.createElement("h4");
  profileMatchesTitle.className = "card-title profile-section__title";
  bindLocalizedText(profileMatchesTitle, "profileMatches");
  const profileMatchesList = document.createElement("div");
  profileMatchesList.className = "profile-match-list";
  const profileLoadMoreButton = document.createElement("button");
  profileLoadMoreButton.type = "button";
  profileLoadMoreButton.className = "secondary-button";
  bindLocalizedText(profileLoadMoreButton, "loadMore");
  profileMatchesSection.append(profileMatchesTitle, profileMatchesList);

  profileBody.append(
    profileSeasonsSection,
    profileTournamentsSection,
    profileMatchesSection,
  );
  profilePanel.append(profileTop, profileStatus, profileBody);
  profileScreen.append(profilePanel);

  const { faqScreen, faqBackButton, privacyScreen, privacyBackButton } = buildHelpScreens();
  const { footer, faqButton: footerFaqButton, privacyButton: footerPrivacyButton } = buildFooter();
  const { loginView, googleSlot } = buildLoginView();

  const welcomeTitle = document.createElement("h2");
  welcomeTitle.className = "section-title";
  bindLocalizedText(welcomeTitle, "dashboardTitle");

  const welcomeText = document.createElement("p");
  welcomeText.className = "section-copy";

  const logoutButton = document.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "secondary-button";
  bindLocalizedText(logoutButton, "logout");

  const faqMenuButton = document.createElement("button");
  faqMenuButton.type = "button";
  faqMenuButton.className = "secondary-button";
  bindLocalizedText(faqMenuButton, "faqMenuLabel");

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "icon-button";
  refreshButton.textContent = "↻";
  refreshButton.setAttribute("aria-label", "Refresh dashboard");

  const openCreateMatchButton = document.createElement("button");
  openCreateMatchButton.type = "button";
  openCreateMatchButton.className = "secondary-button";
  bindLocalizedText(openCreateMatchButton, "createMatch");
  openCreateMatchButton.dataset.testid = "open-match-button";

  const openCreateTournamentButton = document.createElement("button");
  openCreateTournamentButton.type = "button";
  openCreateTournamentButton.className = "secondary-button";
  bindLocalizedText(openCreateTournamentButton, "openCreateTournament");
  openCreateTournamentButton.dataset.testid = "open-tournament-button";

  const openCreateSeasonButton = document.createElement("button");
  openCreateSeasonButton.type = "button";
  openCreateSeasonButton.className = "secondary-button";
  bindLocalizedText(openCreateSeasonButton, "createSeason");
  openCreateSeasonButton.dataset.testid = "open-season-button";

  const {
    openButton: openScoreCardButton,
    overlay: scoreCardOverlay,
    closeButton: closeScoreCardButton,
    show: showScoreCard,
    hide: hideScoreCard,
    isVisible: isScoreCardVisible,
    sync: syncScoreCard,
    setSaveMatchHandler: setScoreCardSaveMatchHandler,
  } = buildScoreCard({
    getPlayers: args.getPlayers,
    getCurrentUserId: args.getCurrentUserId,
    getSeasons: args.getSeasons,
    getSelectedSeasonId: args.getSelectedSeasonId,
  });
  openScoreCardButton.dataset.testid = "open-scorecard-button";
  const { overlay: deleteWarningOverlay, prompt: promptDeleteWarning } = buildDeleteWarning();

  const dashboardOverview = buildDashboardOverview(args.assetsBaseUrl);

  const composerPanel = document.createElement("section");
  composerPanel.className = "content-card composer-card";

  const composerTop = document.createElement("div");
  composerTop.className = "card-header";

  const closeCreateMatchButton = document.createElement("button");
  closeCreateMatchButton.type = "button";
  closeCreateMatchButton.className = "secondary-button";
  bindLocalizedText(closeCreateMatchButton, "back");

  const composerHeading = document.createElement("div");

  const composerTitle = document.createElement("h3");
  composerTitle.className = "card-title";
  bindLocalizedText(composerTitle, "createMatch");

  const composerMeta = document.createElement("p");
  composerMeta.className = "card-meta";
  composerMeta.textContent = "";

  const composerStatus = document.createElement("p");
  composerStatus.className = "form-status share-alert match-composer-alert";
  composerStatus.hidden = true;
  composerStatus.setAttribute("aria-live", "polite");

  const matchOutcome = document.createElement("p");
  matchOutcome.className = "match-outcome";

  const matchLockNotice = document.createElement("p");
  matchLockNotice.className = "form-status";
  matchLockNotice.hidden = true;

  const matchQuickBar = document.createElement("div");
  matchQuickBar.className = "quick-bar quick-bar--match";
  matchQuickBar.append(matchOutcome, matchLockNotice);

  const suggestMatchButton = document.createElement("button");
  suggestMatchButton.type = "button";
  suggestMatchButton.className = "primary-button";
  bindLocalizedText(suggestMatchButton, "suggestFairMatchSingles");

  const matchForm = document.createElement("form");
  matchForm.className = "match-form";

  const matchTypeSelect = document.createElement("select");
  matchTypeSelect.className = "select-input";
  matchTypeSelect.dataset.testid = "match-type-select";

  const formatTypeSelect = document.createElement("select");
  formatTypeSelect.className = "select-input";
  formatTypeSelect.dataset.testid = "match-format-select";

  const pointsToWinSelect = document.createElement("select");
  pointsToWinSelect.className = "select-input";
  pointsToWinSelect.dataset.testid = "match-points-select";

  const formSeasonSelect = document.createElement("select");
  formSeasonSelect.className = "select-input";
  formSeasonSelect.dataset.testid = "match-season-select";

  const formTournamentSelect = document.createElement("select");
  formTournamentSelect.className = "select-input";
  formTournamentSelect.dataset.testid = "match-tournament-select";

  const matchBracketSelect = document.createElement("select");
  matchBracketSelect.className = "select-input";
  matchBracketSelect.dataset.testid = "match-bracket-select";

  const tournamentDateInput = document.createElement("input");
  tournamentDateInput.className = "text-input";
  tournamentDateInput.type = "date";
  tournamentDateInput.value = getTodayDateValue();

  const tournamentSeasonSelect = document.createElement("select");
  tournamentSeasonSelect.className = "select-input";

  const teamA1Select = document.createElement("select");
  teamA1Select.className = "select-input";
  teamA1Select.dataset.testid = "match-team-a-1";
  const teamA2Select = document.createElement("select");
  teamA2Select.className = "select-input";
  teamA2Select.dataset.testid = "match-team-a-2";
  const teamB1Select = document.createElement("select");
  teamB1Select.className = "select-input";
  teamB1Select.dataset.testid = "match-team-b-1";
  const teamB2Select = document.createElement("select");
  teamB2Select.className = "select-input";
  teamB2Select.dataset.testid = "match-team-b-2";

  const winnerTeamSelect = document.createElement("select");
  winnerTeamSelect.className = "select-input";

  const scoreInputs: MatchScoreInputSet[] = Array.from({ length: 3 }, () => ({
    teamA: Object.assign(document.createElement("input"), {
      className: "text-input",
      type: "number",
      min: "0",
      step: "1",
    }),
    teamB: Object.assign(document.createElement("input"), {
      className: "text-input",
      type: "number",
      min: "0",
      step: "1",
    }),
    teamALabel: document.createElement("span"),
    teamBLabel: document.createElement("span"),
  }));
  scoreInputs.forEach((game, index) => {
    game.teamA.dataset.testid = `match-score-${index}-team-a`;
    game.teamB.dataset.testid = `match-score-${index}-team-b`;
  });

  const resetScoreInputs = (): void => {
    scoreInputs.forEach((game) => {
      game.teamA.value = "";
      game.teamB.value = "";
    });
  };

  const submitMatchButton = document.createElement("button");
  submitMatchButton.type = "submit";
  submitMatchButton.className = "primary-button";
  bindLocalizedText(submitMatchButton, "createMatch");
  submitMatchButton.dataset.testid = "match-submit";

  const matchesTitle = document.createElement("h3");
  matchesTitle.className = "card-title";
  bindLocalizedText(matchesTitle, "matchesTitle");

  const matchesMeta = document.createElement("p");
  matchesMeta.className = "card-meta";
  matchesMeta.textContent = "";

  const visibleMatchFilters: MatchFeedFilter[] = ["recent", "mine"];
  const matchesPanelData = args.buildMatchesPanel({
    matchesTitle,
    matchesMeta,
    matchFilters: visibleMatchFilters,
    matchFilterLabels: args.matchFilterLabels,
    onFilterClick: args.onMatchFilterClick,
  });

  const tournamentPanel = document.createElement("section");
  tournamentPanel.className = "content-card tournament-card";

  const seasonPanel = document.createElement("section");
  seasonPanel.className = "content-card composer-card";

  const tournamentTop = document.createElement("div");
  tournamentTop.className = "card-header";

  const tournamentHeading = document.createElement("div");

  const tournamentTitle = document.createElement("h3");
  tournamentTitle.className = "card-title";
  bindLocalizedText(tournamentTitle, "tournamentScreenTitle");

  const tournamentMeta = document.createElement("p");
  tournamentMeta.className = "card-meta";
  bindLocalizedText(tournamentMeta, "tournamentMeta");

  const closeCreateTournamentButton = document.createElement("button");
  closeCreateTournamentButton.type = "button";
  closeCreateTournamentButton.className = "secondary-button compact-header-button";
  bindLocalizedText(closeCreateTournamentButton, "back");

  const seasonTop = document.createElement("div");
  seasonTop.className = "card-header";

  const seasonHeading = document.createElement("div");

  const seasonTitle = document.createElement("h3");
  seasonTitle.className = "card-title";
  bindLocalizedText(seasonTitle, "seasonScreenTitle");

  const seasonMeta = document.createElement("p");
  seasonMeta.className = "card-meta";
  bindLocalizedText(seasonMeta, "seasonMeta");

  const closeCreateSeasonButton = document.createElement("button");
  closeCreateSeasonButton.type = "button";
  closeCreateSeasonButton.className = "secondary-button compact-header-button";
  closeCreateSeasonButton.dataset.testid = "close-create-season-button";
  bindLocalizedText(closeCreateSeasonButton, "back");

  const seasonStatus = document.createElement("p");
  seasonStatus.className = "form-status share-alert match-composer-alert";
  seasonStatus.hidden = true;
  seasonStatus.setAttribute("aria-live", "polite");
  seasonStatus.dataset.testid = "season-status";

  const seasonSummary = document.createElement("p");
  seasonSummary.className = "summary-chip";

  const seasonLockNotice = document.createElement("p");
  seasonLockNotice.className = "form-status";
  seasonLockNotice.hidden = true;

  const seasonQuickBar = document.createElement("div");
  seasonQuickBar.className = "segment-lock-bar";
  seasonQuickBar.append(seasonStatus, seasonLockNotice);

  const seasonInsights = document.createElement("div");
  seasonInsights.className = "segment-insights";
  seasonInsights.hidden = true;

  const seasonForm = document.createElement("form");
  seasonForm.className = "match-form";

  const seasonNameInput = document.createElement("input");
  seasonNameInput.className = "text-input";
  seasonNameInput.placeholder = "Season name";
  seasonNameInput.dataset.testid = "season-name";

  const loadSeasonSelect = document.createElement("select");
  loadSeasonSelect.className = "select-input";

  const resetSeasonDraftButton = document.createElement("button");
  resetSeasonDraftButton.type = "button";
  resetSeasonDraftButton.className = "secondary-button";
  bindLocalizedText(resetSeasonDraftButton, "createNewSeasonDraft");

  const seasonStartDateInput = document.createElement("input");
  seasonStartDateInput.className = "text-input";
  seasonStartDateInput.type = "date";
  seasonStartDateInput.value = getTodayDateValue();
  seasonStartDateInput.dataset.testid = "season-start";

  const seasonEndDateInput = document.createElement("input");
  seasonEndDateInput.className = "text-input";
  seasonEndDateInput.type = "date";
  seasonEndDateInput.dataset.testid = "season-end";

  const seasonBaseEloSelect = document.createElement("select");
  seasonBaseEloSelect.className = "select-input";

  const seasonParticipantSection = document.createElement("div");
  seasonParticipantSection.className = "form-field";

  const seasonParticipantLabel = document.createElement("span");
  seasonParticipantLabel.className = "field-label";
  bindLocalizedText(seasonParticipantLabel, "participants");

  const seasonParticipantList = document.createElement("div");
  seasonParticipantList.className = "participant-list";

  const seasonParticipantSearchInput = document.createElement("input");
  seasonParticipantSearchInput.className = "text-input participant-search-input";
  seasonParticipantSearchInput.type = "search";
  bindLocalizedAttribute(seasonParticipantSearchInput, "placeholder", "participantSearchPlaceholder");
  seasonParticipantSearchInput.dataset.testid = "season-participant-search";

  const seasonParticipantResults = document.createElement("div");
  seasonParticipantResults.className = "participant-search-results";

  const seasonSelectAllParticipantsField = document.createElement("label");
  seasonSelectAllParticipantsField.className = "checkbox-field";
  const seasonSelectAllParticipantsInput = document.createElement("input");
  seasonSelectAllParticipantsInput.type = "checkbox";
  seasonSelectAllParticipantsInput.className = "checkbox-input";
  const seasonSelectAllParticipantsCopy = document.createElement("span");
  seasonSelectAllParticipantsCopy.className = "field-label";
  bindLocalizedText(seasonSelectAllParticipantsCopy, "selectAllParticipants");
  seasonSelectAllParticipantsField.append(seasonSelectAllParticipantsInput, seasonSelectAllParticipantsCopy);

  const seasonIsActiveInput = document.createElement("input");
  seasonIsActiveInput.type = "checkbox";
  seasonIsActiveInput.checked = true;
  seasonIsActiveInput.className = "checkbox-input";

  const seasonIsPublicInput = document.createElement("input");
  seasonIsPublicInput.type = "checkbox";
  seasonIsPublicInput.className = "checkbox-input";

  const submitSeasonButton = document.createElement("button");
  submitSeasonButton.type = "submit";
  submitSeasonButton.className = "primary-button";
  bindLocalizedText(submitSeasonButton, "createSeason");
  submitSeasonButton.dataset.testid = "season-submit";

  const deleteSeasonButton = document.createElement("button");
  deleteSeasonButton.type = "button";
  deleteSeasonButton.className = "secondary-button destructive-button";
  bindLocalizedText(deleteSeasonButton, "deleteSeason");
  deleteSeasonButton.hidden = true;

  const tournamentNameInput = document.createElement("input");
  tournamentNameInput.className = "text-input";
  tournamentNameInput.placeholder = "Tournament name";

  const loadTournamentSelect = document.createElement("select");
  loadTournamentSelect.className = "select-input";

  const resetTournamentDraftButton = document.createElement("button");
  resetTournamentDraftButton.type = "button";
  resetTournamentDraftButton.className = "secondary-button";
  bindLocalizedText(resetTournamentDraftButton, "createNewTournamentDraft");

  const tournamentStatus = document.createElement("p");
  tournamentStatus.className = "form-status share-alert match-composer-alert";
  tournamentStatus.hidden = true;
  tournamentStatus.setAttribute("aria-live", "polite");

  const tournamentSummary = document.createElement("p");
  tournamentSummary.className = "summary-chip";

  const tournamentLockNotice = document.createElement("p");
  tournamentLockNotice.className = "form-status";
  tournamentLockNotice.hidden = true;

  const tournamentQuickBar = document.createElement("div");
  tournamentQuickBar.className = "segment-lock-bar";
  tournamentQuickBar.append(tournamentLockNotice);

  const tournamentInsights = document.createElement("div");
  tournamentInsights.className = "segment-insights";
  tournamentInsights.hidden = true;

  const participantSection = document.createElement("div");
  participantSection.className = "form-field";

  const participantLabel = document.createElement("span");
  participantLabel.className = "field-label";
  bindLocalizedText(participantLabel, "participants");

  const participantList = document.createElement("div");
  participantList.className = "participant-list";

  const participantSearchInput = document.createElement("input");
  participantSearchInput.className = "text-input participant-search-input";
  participantSearchInput.type = "search";
  bindLocalizedAttribute(participantSearchInput, "placeholder", "participantSearchPlaceholder");

  const participantSearchResults = document.createElement("div");
  participantSearchResults.className = "participant-search-results";

  const tournamentSelectAllParticipantsField = document.createElement("label");
  tournamentSelectAllParticipantsField.className = "checkbox-field";
  const tournamentSelectAllParticipantsInput = document.createElement("input");
  tournamentSelectAllParticipantsInput.type = "checkbox";
  tournamentSelectAllParticipantsInput.className = "checkbox-input";
  const tournamentSelectAllParticipantsCopy = document.createElement("span");
  tournamentSelectAllParticipantsCopy.className = "field-label";
  bindLocalizedText(tournamentSelectAllParticipantsCopy, "selectAllParticipants");
  tournamentSelectAllParticipantsField.append(
    tournamentSelectAllParticipantsInput,
    tournamentSelectAllParticipantsCopy,
  );

  const suggestTournamentButton = document.createElement("button");
  suggestTournamentButton.type = "button";
  suggestTournamentButton.className = "primary-button";
  bindLocalizedText(suggestTournamentButton, "suggestTournament");

  const saveTournamentButton = document.createElement("button");
  saveTournamentButton.type = "button";
  saveTournamentButton.className = "primary-button";
  bindLocalizedText(saveTournamentButton, "saveTournament");

  const deleteTournamentButton = document.createElement("button");
  deleteTournamentButton.type = "button";
  deleteTournamentButton.className = "secondary-button destructive-button";
  bindLocalizedText(deleteTournamentButton, "deleteTournament");
  deleteTournamentButton.hidden = true;

  const bracketBoard = document.createElement("div");
  bracketBoard.className = "bracket-board";

  const seasonActiveField = document.createElement("div");
  const seasonPublicField = document.createElement("div");

  header.append(brandMark, providerStack);
  card.append(
    header,
    dashboardOverview.shareAlert,
    loginView,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    profileScreen,
    faqScreen,
    privacyScreen,
    footer,
  );
  container.append(card, scoreCardOverlay, deleteWarningOverlay, loadingOverlay);

  return {
    container,
    loadingOverlay,
    loadingOverlayLabel,
    header,
    providerStack,
    authActions,
    authMenu,
    createMenu,
    authAvatar,
    authMenuButton,
    createMenuButton,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    profileScreen,
    profilePanel,
    closeProfileButton,
    profileStatus,
    profileSeasonsList,
    profileTournamentsList,
    profileMatchesList,
    profileLoadMoreButton,
    faqScreen,
    faqBackButton,
    privacyScreen,
    privacyBackButton,
    footer,
    footerFaqButton,
    footerPrivacyButton,
    loginView,
    googleSlot,
    welcomeTitle,
    welcomeText,
    logoutButton,
    faqMenuButton,
    refreshButton,
    openCreateMatchButton,
    openCreateTournamentButton,
    openCreateSeasonButton,
    openScoreCardButton,
    scoreCardOverlay,
    closeScoreCardButton,
    showScoreCard,
    hideScoreCard,
    isScoreCardVisible,
    syncScoreCard,
    setScoreCardSaveMatchHandler,
    deleteWarningOverlay,
    promptDeleteWarning,
    ...dashboardOverview,
    composerPanel,
    composerTop,
    closeCreateMatchButton,
    composerHeading,
    composerTitle,
    composerMeta,
    composerStatus,
    matchOutcome,
    matchLockNotice,
    matchQuickBar,
    suggestMatchButton,
    matchForm,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    formSeasonSelect,
    formTournamentSelect,
    matchBracketSelect,
    tournamentDateInput,
    tournamentSeasonSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    winnerTeamSelect,
    scoreInputs,
    resetScoreInputs,
    submitMatchButton,
    matchesTitle,
    matchesMeta,
    visibleMatchFilters,
    ...matchesPanelData,
    tournamentPanel,
    seasonPanel,
    tournamentTop,
    tournamentHeading,
    tournamentTitle,
    tournamentMeta,
    closeCreateTournamentButton,
    seasonTop,
    seasonHeading,
    seasonTitle,
    seasonMeta,
    closeCreateSeasonButton,
    seasonStatus,
    seasonSummary,
    seasonLockNotice,
    seasonQuickBar,
    seasonInsights,
    seasonForm,
    seasonNameInput,
    loadSeasonSelect,
    resetSeasonDraftButton,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonBaseEloSelect,
    seasonParticipantSection,
    seasonParticipantLabel,
    seasonParticipantList,
    seasonParticipantSearchInput,
    seasonParticipantResults,
    seasonSelectAllParticipantsField,
    seasonSelectAllParticipantsInput,
    seasonIsActiveInput,
    seasonIsPublicInput,
    submitSeasonButton,
    deleteSeasonButton,
    tournamentNameInput,
    loadTournamentSelect,
    resetTournamentDraftButton,
    tournamentStatus,
    tournamentSummary,
    tournamentLockNotice,
    tournamentQuickBar,
    tournamentInsights,
    participantSection,
    participantLabel,
    participantList,
    participantSearchInput,
    participantSearchResults,
    tournamentSelectAllParticipantsField,
    tournamentSelectAllParticipantsInput,
    suggestTournamentButton,
    saveTournamentButton,
    deleteTournamentButton,
    bracketBoard,
    seasonActiveField,
    seasonPublicField,
    closeLanguageSwitchIfOutside,
    languageSwitch,
  };
};
