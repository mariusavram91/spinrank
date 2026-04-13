import type { LeaderboardEntry, MatchFeedFilter, SeasonRecord } from "../../../api/contract";
import { buildHelpScreens } from "../help/screens";
import { buildDashboardOverview } from "../dashboard/overview";
import { buildFooter } from "../../shared/components/footer";
import { buildLanguageSwitch } from "../../shared/components/languageSwitch";
import { buildLoginView } from "../../shared/components/loginView";
import { buildScoreCard } from "../../shared/components/scoreCard";
import { buildDeleteWarning } from "../../shared/components/deleteWarning";
import { languageOptions } from "../../shared/i18n/translations";
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

  const authAvatarButton = document.createElement("button");
  authAvatarButton.type = "button";
  authAvatarButton.className = "auth-avatar-button";
  authAvatarButton.setAttribute("aria-label", "Open profile");

  const authAvatarBadge = document.createElement("span");
  authAvatarBadge.className = "auth-avatar-badge";
  authAvatarBadge.hidden = true;
  authAvatarBadge.dataset.testid = "achievements-avatar-badge";

  const authMenu = document.createElement("div");
  authMenu.className = "auth-menu";
  authMenu.dataset.testid = "auth-menu";

  const createMenu = document.createElement("div");
  createMenu.className = "create-menu";
  createMenu.dataset.testid = "create-menu";

  const authAvatar = document.createElement("img");
  authAvatar.className = "auth-avatar";
  authAvatar.alt = "Signed-in user avatar";
  authAvatar.setAttribute("aria-hidden", "true");
  authAvatarButton.append(authAvatar, authAvatarBadge);

  const authMenuButton = document.createElement("button");
  authMenuButton.type = "button";
  authMenuButton.className = "secondary-button auth-menu-button";
  authMenuButton.textContent = "☰";
  authMenuButton.setAttribute("aria-label", "Open account menu");
  authMenuButton.dataset.testid = "auth-menu-toggle";

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

  const sharedUserProfileScreen = document.createElement("section");
  sharedUserProfileScreen.className = "dashboard";
  sharedUserProfileScreen.hidden = true;

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
  profileStatus.className = "form-status share-alert match-composer-alert";
  profileStatus.hidden = true;
  profileStatus.setAttribute("aria-live", "polite");

  const profileEditorSection = document.createElement("section");
  profileEditorSection.className = "profile-section profile-editor";
  const profileEditorTitle = document.createElement("h4");
  profileEditorTitle.className = "card-title profile-section__title profile-section__title--primary";
  bindLocalizedText(profileEditorTitle, "profileSettingsTitle");
  const profileEditorField = document.createElement("label");
  profileEditorField.className = "form-field";
  const profileEditorLabel = document.createElement("span");
  profileEditorLabel.className = "field-label";
  bindLocalizedText(profileEditorLabel, "profileDisplayNameLabel");
  const profileDisplayNameInput = document.createElement("input");
  profileDisplayNameInput.type = "text";
  profileDisplayNameInput.className = "text-input";
  profileDisplayNameInput.maxLength = 80;
  profileDisplayNameInput.autocomplete = "name";
  profileDisplayNameInput.dataset.testid = "profile-display-name";
  bindLocalizedAttribute(profileDisplayNameInput, "placeholder", "profileDisplayNamePlaceholder");
  profileEditorField.append(profileEditorLabel, profileDisplayNameInput);
  const profileLocaleField = document.createElement("label");
  profileLocaleField.className = "form-field";
  const profileLocaleLabel = document.createElement("span");
  profileLocaleLabel.className = "field-label";
  bindLocalizedText(profileLocaleLabel, "profileLocaleLabel");
  const profileLocaleSelect = document.createElement("select");
  profileLocaleSelect.className = "text-input";
  profileLocaleSelect.dataset.testid = "profile-locale";
  for (const [code, option] of Object.entries(languageOptions)) {
    const localeOption = document.createElement("option");
    localeOption.value = code;
    localeOption.textContent = `${option.flag} ${option.label}`;
    profileLocaleSelect.append(localeOption);
  }
  profileLocaleField.append(profileLocaleLabel, profileLocaleSelect);
  const profileSaveButton = document.createElement("button");
  profileSaveButton.type = "button";
  profileSaveButton.className = "primary-button";
  profileSaveButton.dataset.testid = "profile-save";
  bindLocalizedText(profileSaveButton, "profileSaveButton");
  profileEditorSection.append(profileEditorTitle, profileEditorField, profileLocaleField, profileSaveButton, profileStatus);

  const profileBody = document.createElement("div");
  profileBody.className = "profile-screen__body";

  const profileActivitySection = document.createElement("section");
  profileActivitySection.className = "profile-section profile-activity";
  const profileActivityTitle = document.createElement("h4");
  profileActivityTitle.className = "card-title profile-section__title profile-section__title--primary";
  bindLocalizedText(profileActivityTitle, "profileActivityTitle");

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
  profileLoadMoreButton.className = "secondary-button matches-load-more-button";
  bindLocalizedText(profileLoadMoreButton, "loadMore");
  profileMatchesSection.append(profileMatchesTitle, profileMatchesList, profileLoadMoreButton);

  const profileAchievementsSection = document.createElement("section");
  profileAchievementsSection.className = "profile-section";
  const profileAchievementsHeader = document.createElement("div");
  profileAchievementsHeader.className = "profile-achievements__header";
  const profileAchievementsTitleBlock = document.createElement("div");
  profileAchievementsTitleBlock.className = "profile-achievements__title-block";
  const profileAchievementsTitle = document.createElement("h4");
  profileAchievementsTitle.className = "card-title profile-section__title";
  bindLocalizedText(profileAchievementsTitle, "achievementsTitle");
  const profileAchievementsSubtitle = document.createElement("p");
  profileAchievementsSubtitle.className = "profile-section__subtitle";
  const profileAchievementsToggle = document.createElement("button");
  profileAchievementsToggle.type = "button";
  profileAchievementsToggle.className = "secondary-button";
  profileAchievementsToggle.dataset.testid = "profile-achievements-toggle";
  const profileAchievementsSummary = document.createElement("div");
  profileAchievementsSummary.className = "profile-achievements__summary";
  const profileAchievementsPreview = document.createElement("div");
  profileAchievementsPreview.className =
    "achievement-chip-list achievement-chip-list--profile achievement-chip-list--profile-unread achievement-chip-list--profile-preview";
  profileAchievementsPreview.hidden = true;
  const profileAchievementsUnread = document.createElement("div");
  profileAchievementsUnread.className = "achievement-chip-list achievement-chip-list--profile achievement-chip-list--profile-unread";
  profileAchievementsUnread.hidden = true;
  const profileAchievementsList = document.createElement("div");
  profileAchievementsList.className = "achievement-chip-list achievement-chip-list--profile";
  profileAchievementsSection.append(
    profileAchievementsHeader,
    profileAchievementsSummary,
    profileAchievementsPreview,
    profileAchievementsUnread,
    profileAchievementsList,
  );
  profileAchievementsTitleBlock.append(profileAchievementsTitle, profileAchievementsSubtitle);
  profileAchievementsHeader.append(profileAchievementsTitleBlock, profileAchievementsToggle);

  profileActivitySection.append(
    profileActivityTitle,
    profileAchievementsSection,
    profileSeasonsSection,
    profileTournamentsSection,
    profileMatchesSection,
  );
  profileBody.append(profileEditorSection, profileActivitySection);
  profilePanel.append(profileTop, profileBody);
  profileScreen.append(profilePanel);

  const sharedUserProfilePanel = document.createElement("section");
  sharedUserProfilePanel.className = "content-card profile-screen";

  const sharedUserProfileTop = document.createElement("div");
  sharedUserProfileTop.className = "card-header";

  const sharedUserProfileHeading = document.createElement("div");

  const sharedUserProfileTitle = document.createElement("h3");
  sharedUserProfileTitle.className = "card-title";
  bindLocalizedText(sharedUserProfileTitle, "sharedProfileTitle");

  const sharedUserProfileMeta = document.createElement("p");
  sharedUserProfileMeta.className = "card-meta";
  bindLocalizedText(sharedUserProfileMeta, "sharedProfileMeta");

  const closeSharedUserProfileButton = document.createElement("button");
  closeSharedUserProfileButton.type = "button";
  closeSharedUserProfileButton.className = "secondary-button compact-header-button";
  bindLocalizedText(closeSharedUserProfileButton, "back");

  sharedUserProfileHeading.append(sharedUserProfileTitle, sharedUserProfileMeta);
  sharedUserProfileTop.append(sharedUserProfileHeading, closeSharedUserProfileButton);

  const sharedUserProfileBody = document.createElement("div");
  sharedUserProfileBody.className = "profile-screen__body";

  const sharedUserProfileSummary = document.createElement("section");
  sharedUserProfileSummary.className = "profile-section profile-editor shared-profile-summary";

  const sharedUserProfileHeader = document.createElement("div");
  sharedUserProfileHeader.className = "shared-profile-summary__header";

  const sharedUserProfileAvatar = document.createElement("img");
  sharedUserProfileAvatar.className = "player-avatar shared-profile-summary__avatar";

  const sharedUserProfileIdentity = document.createElement("div");
  sharedUserProfileIdentity.className = "shared-profile-summary__identity";

  const sharedUserProfileName = document.createElement("h4");
  sharedUserProfileName.className = "card-title profile-section__title profile-section__title--primary";

  const sharedUserProfileStats = document.createElement("div");
  sharedUserProfileStats.className = "profile-segment-card__stats shared-profile-summary__stats";

  const sharedUserProfileRank = document.createElement("span");
  sharedUserProfileRank.className = "profile-stat-chip";

  const sharedUserProfileElo = document.createElement("span");
  sharedUserProfileElo.className = "profile-stat-chip";

  sharedUserProfileStats.append(sharedUserProfileRank, sharedUserProfileElo);
  sharedUserProfileIdentity.append(sharedUserProfileName, sharedUserProfileStats);
  sharedUserProfileHeader.append(sharedUserProfileAvatar, sharedUserProfileIdentity);
  sharedUserProfileSummary.append(sharedUserProfileHeader);

  const sharedUserProfileActivity = document.createElement("section");
  sharedUserProfileActivity.className = "profile-section profile-activity";
  const sharedUserProfileActivityTitle = document.createElement("h4");
  sharedUserProfileActivityTitle.className = "card-title profile-section__title profile-section__title--primary";
  bindLocalizedText(sharedUserProfileActivityTitle, "sharedProfileActivityTitle");

  const sharedUserProfileAchievementsSection = document.createElement("section");
  sharedUserProfileAchievementsSection.className = "profile-section";
  const sharedUserProfileAchievementsTitle = document.createElement("h4");
  sharedUserProfileAchievementsTitle.className = "card-title profile-section__title";
  bindLocalizedText(sharedUserProfileAchievementsTitle, "achievementsTitle");
  const sharedUserProfileAchievementsSubtitle = document.createElement("p");
  sharedUserProfileAchievementsSubtitle.className = "profile-section__subtitle";
  const sharedUserProfileAchievementsSummary = document.createElement("div");
  sharedUserProfileAchievementsSummary.className = "profile-achievements__summary";
  const sharedUserProfileAchievementsPreview = document.createElement("div");
  sharedUserProfileAchievementsPreview.className =
    "achievement-chip-list achievement-chip-list--profile achievement-chip-list--profile-unread achievement-chip-list--profile-preview";
  sharedUserProfileAchievementsPreview.hidden = true;
  sharedUserProfileAchievementsSection.append(
    sharedUserProfileAchievementsTitle,
    sharedUserProfileAchievementsSubtitle,
    sharedUserProfileAchievementsSummary,
    sharedUserProfileAchievementsPreview,
  );

  const sharedUserProfileSeasonsSection = document.createElement("section");
  sharedUserProfileSeasonsSection.className = "profile-section";
  const sharedUserProfileSeasonsTitle = document.createElement("h4");
  sharedUserProfileSeasonsTitle.className = "card-title profile-section__title";
  bindLocalizedText(sharedUserProfileSeasonsTitle, "sharedProfileSeasonsTitle");
  const sharedUserProfileSeasonsList = document.createElement("div");
  sharedUserProfileSeasonsList.className = "profile-card-list";
  sharedUserProfileSeasonsSection.append(sharedUserProfileSeasonsTitle, sharedUserProfileSeasonsList);

  const sharedUserProfileTournamentsSection = document.createElement("section");
  sharedUserProfileTournamentsSection.className = "profile-section";
  const sharedUserProfileTournamentsTitle = document.createElement("h4");
  sharedUserProfileTournamentsTitle.className = "card-title profile-section__title";
  bindLocalizedText(sharedUserProfileTournamentsTitle, "sharedProfileTournamentsTitle");
  const sharedUserProfileTournamentsList = document.createElement("div");
  sharedUserProfileTournamentsList.className = "profile-card-list";
  sharedUserProfileTournamentsSection.append(sharedUserProfileTournamentsTitle, sharedUserProfileTournamentsList);

  const sharedUserProfileMatchesSection = document.createElement("section");
  sharedUserProfileMatchesSection.className = "profile-section";
  const sharedUserProfileMatchesTitle = document.createElement("h4");
  sharedUserProfileMatchesTitle.className = "card-title profile-section__title";
  bindLocalizedText(sharedUserProfileMatchesTitle, "sharedProfileMatchesTitle");
  const sharedUserProfileMatchesList = document.createElement("div");
  sharedUserProfileMatchesList.className = "profile-match-list";
  const sharedUserProfileLoadMoreButton = document.createElement("button");
  sharedUserProfileLoadMoreButton.type = "button";
  sharedUserProfileLoadMoreButton.className = "secondary-button matches-load-more-button";
  bindLocalizedText(sharedUserProfileLoadMoreButton, "loadMore");
  sharedUserProfileMatchesSection.append(
    sharedUserProfileMatchesTitle,
    sharedUserProfileMatchesList,
    sharedUserProfileLoadMoreButton,
  );

  sharedUserProfileActivity.append(
    sharedUserProfileAchievementsSection,
    sharedUserProfileActivityTitle,
    sharedUserProfileSeasonsSection,
    sharedUserProfileTournamentsSection,
    sharedUserProfileMatchesSection,
  );
  sharedUserProfileBody.append(sharedUserProfileSummary, sharedUserProfileActivity);
  sharedUserProfilePanel.append(sharedUserProfileTop, sharedUserProfileBody);
  sharedUserProfileScreen.append(sharedUserProfilePanel);

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
  logoutButton.dataset.testid = "auth-menu-logout";

  const faqMenuButton = document.createElement("button");
  faqMenuButton.type = "button";
  faqMenuButton.className = "secondary-button";
  bindLocalizedText(faqMenuButton, "faqMenuLabel");
  faqMenuButton.dataset.testid = "auth-menu-faq";

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

  const exitAppOverlay = document.createElement("div");
  exitAppOverlay.className = "delete-warning-overlay";
  exitAppOverlay.hidden = true;
  exitAppOverlay.tabIndex = -1;

  const exitAppModal = document.createElement("div");
  exitAppModal.className = "delete-warning-modal";
  exitAppModal.setAttribute("role", "alertdialog");
  exitAppModal.setAttribute("aria-modal", "true");

  const exitAppTitle = document.createElement("h3");
  exitAppTitle.className = "delete-warning__title";
  bindLocalizedText(exitAppTitle, "exitAppTitle");

  const exitAppDescription = document.createElement("p");
  exitAppDescription.className = "delete-warning__description";
  bindLocalizedText(exitAppDescription, "exitAppBody");

  const exitAppActions = document.createElement("div");
  exitAppActions.className = "delete-warning__actions";

  const exitAppStayButton = document.createElement("button");
  exitAppStayButton.type = "button";
  exitAppStayButton.className = "secondary-button";
  bindLocalizedText(exitAppStayButton, "exitAppStay");

  exitAppActions.append(exitAppStayButton);
  exitAppModal.append(exitAppTitle, exitAppDescription, exitAppActions);
  exitAppOverlay.append(exitAppModal);

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
  composerStatus.dataset.testid = "match-status";

  const matchOutcome = document.createElement("p");
  matchOutcome.className = "match-outcome";

  const matchLockNotice = document.createElement("p");
  matchLockNotice.className = "form-status";
  matchLockNotice.hidden = true;
  matchLockNotice.dataset.testid = "match-lock-notice";

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
  tournamentDateInput.dataset.testid = "tournament-date";

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
  closeCreateTournamentButton.dataset.testid = "close-create-tournament-button";

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
  seasonLockNotice.dataset.testid = "season-lock-notice";

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
  loadSeasonSelect.dataset.testid = "season-load-select";

  const resetSeasonDraftButton = document.createElement("button");
  resetSeasonDraftButton.type = "button";
  resetSeasonDraftButton.className = "secondary-button";
  bindLocalizedText(resetSeasonDraftButton, "createNewSeasonDraft");
  resetSeasonDraftButton.dataset.testid = "season-reset-draft";

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
  deleteSeasonButton.className = "icon-button section-delete-button";
  deleteSeasonButton.textContent = "🗑";
  bindLocalizedAttribute(deleteSeasonButton, "aria-label", "deleteSeason");
  bindLocalizedAttribute(deleteSeasonButton, "title", "deleteSeason");
  deleteSeasonButton.hidden = true;

  const tournamentNameInput = document.createElement("input");
  tournamentNameInput.className = "text-input";
  tournamentNameInput.placeholder = "Tournament name";
  tournamentNameInput.dataset.testid = "tournament-name";

  const loadTournamentSelect = document.createElement("select");
  loadTournamentSelect.className = "select-input";
  loadTournamentSelect.dataset.testid = "tournament-load-select";

  const resetTournamentDraftButton = document.createElement("button");
  resetTournamentDraftButton.type = "button";
  resetTournamentDraftButton.className = "secondary-button";
  bindLocalizedText(resetTournamentDraftButton, "createNewTournamentDraft");
  resetTournamentDraftButton.dataset.testid = "tournament-reset-draft";

  const tournamentStatus = document.createElement("p");
  tournamentStatus.className = "form-status share-alert match-composer-alert";
  tournamentStatus.hidden = true;
  tournamentStatus.setAttribute("aria-live", "polite");
  tournamentStatus.dataset.testid = "tournament-status";

  const tournamentSummary = document.createElement("p");
  tournamentSummary.className = "summary-chip";

  const tournamentLockNotice = document.createElement("p");
  tournamentLockNotice.className = "form-status";
  tournamentLockNotice.hidden = true;
  tournamentLockNotice.dataset.testid = "tournament-lock-notice";

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
  participantSearchInput.dataset.testid = "tournament-participant-search";

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
  suggestTournamentButton.dataset.testid = "tournament-suggest";

  const saveTournamentButton = document.createElement("button");
  saveTournamentButton.type = "button";
  saveTournamentButton.className = "primary-button";
  bindLocalizedText(saveTournamentButton, "saveTournament");
  saveTournamentButton.dataset.testid = "tournament-save";

  const deleteTournamentButton = document.createElement("button");
  deleteTournamentButton.type = "button";
  deleteTournamentButton.className = "icon-button section-delete-button";
  deleteTournamentButton.textContent = "🗑";
  bindLocalizedAttribute(deleteTournamentButton, "aria-label", "deleteTournament");
  bindLocalizedAttribute(deleteTournamentButton, "title", "deleteTournament");
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
    sharedUserProfileScreen,
    faqScreen,
    privacyScreen,
    footer,
  );
  container.append(card, scoreCardOverlay, deleteWarningOverlay, exitAppOverlay, loadingOverlay);

  return {
    container,
    loadingOverlay,
    loadingOverlayLabel,
    header,
    providerStack,
    authActions,
    authMenu,
    createMenu,
    authAvatarButton,
    authAvatar,
    authAvatarBadge,
    authMenuButton,
    createMenuButton,
    dashboard,
    createMatchScreen,
    createTournamentScreen,
    createSeasonScreen,
    profileScreen,
    sharedUserProfileScreen,
    profilePanel,
    closeProfileButton,
    profileStatus,
    profileDisplayNameInput,
    profileLocaleSelect,
    profileSaveButton,
    profileAchievementsTitle,
    profileAchievementsSubtitle,
    profileAchievementsSummary,
    profileAchievementsPreview,
    profileAchievementsUnread,
    profileAchievementsToggle,
    profileAchievementsList,
    profileSeasonsList,
    profileTournamentsList,
    profileMatchesList,
    profileLoadMoreButton,
    closeSharedUserProfileButton,
    sharedUserProfileMeta,
    sharedUserProfileAvatar,
    sharedUserProfileName,
    sharedUserProfileRank,
    sharedUserProfileElo,
    sharedUserProfileAchievementsSubtitle,
    sharedUserProfileAchievementsSummary,
    sharedUserProfileAchievementsPreview,
    sharedUserProfileSeasonsList,
    sharedUserProfileTournamentsList,
    sharedUserProfileMatchesList,
    sharedUserProfileLoadMoreButton,
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
    exitAppOverlay,
    exitAppStayButton,
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
