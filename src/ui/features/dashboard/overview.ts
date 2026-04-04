import { bindLocalizedText } from "../../shared/i18n/runtime";

export interface DashboardOverviewElements {
  dashboardStatus: HTMLParagraphElement;
  shareAlert: HTMLDivElement;
  viewGrid: HTMLDivElement;
  progressPanel: HTMLElement;
  progressSubtitle: HTMLParagraphElement;
  progressSubtitleRankLabel: HTMLSpanElement;
  progressSubtitleRankValue: HTMLSpanElement;
  progressSubtitleElo: HTMLSpanElement;
  progressSummary: HTMLDivElement;
  progressBody: HTMLDivElement;
  leaderboardPanel: HTMLElement;
  globalButton: HTMLButtonElement;
  seasonButton: HTMLButtonElement;
  tournamentButton: HTMLButtonElement;
  seasonSelect: HTMLSelectElement;
  seasonStats: HTMLDivElement;
  seasonStatsMatches: HTMLParagraphElement;
  seasonStatsActive: HTMLParagraphElement;
  tournamentSelect: HTMLSelectElement;
  leaderboardStatsGroup: HTMLDivElement;
  leaderboardMatchesSummary: HTMLParagraphElement;
  leaderboardMatchesSummaryValue: HTMLSpanElement;
  leaderboardStatMostActive: HTMLDivElement;
  leaderboardStatMostActivePlayer: HTMLSpanElement;
  leaderboardStatMostActiveMeta: HTMLSpanElement;
  leaderboardStatLongestStreak: HTMLDivElement;
  leaderboardStatLongestStreakLabel: HTMLSpanElement;
  leaderboardStatLongestStreakPlayer: HTMLSpanElement;
  leaderboardStatLongestStreakMeta: HTMLSpanElement;
  leaderboardStatMostWins: HTMLDivElement;
  leaderboardStatMostWinsPlayer: HTMLSpanElement;
  leaderboardStatMostWinsMeta: HTMLSpanElement;
  leaderboardList: HTMLDivElement;
  leaderboardAvatarFallback: string;
}

export const buildDashboardOverview = (baseUrl: string): DashboardOverviewElements => {
  const dashboardStatus = document.createElement("p");
  dashboardStatus.className = "dashboard-status";

  const shareAlert = document.createElement("div");
  shareAlert.className = "share-alert";
  shareAlert.setAttribute("aria-live", "polite");
  shareAlert.hidden = true;

  const viewGrid = document.createElement("div");
  viewGrid.className = "view-grid";

  const progressPanel = document.createElement("section");
  progressPanel.className = "content-card progress-card";

  const progressHeader = document.createElement("div");
  progressHeader.className = "card-header progress-card__header";

  const progressTitleContainer = document.createElement("div");

  const progressTitle = document.createElement("h3");
  progressTitle.className = "card-title";
  bindLocalizedText(progressTitle, "progressStatsTitle");

  const progressSubtitle = document.createElement("p");
  progressSubtitle.className = "progress-subtitle card-meta";

  const progressSubtitleRank = document.createElement("span");
  progressSubtitleRank.className = "progress-subtitle__rank";

  const progressSubtitleRankLabel = document.createElement("span");
  progressSubtitleRankLabel.className = "progress-subtitle__rank-label";

  const progressSubtitleRankValue = document.createElement("span");
  progressSubtitleRankValue.className =
    "progress-subtitle__rank-value progress-badge progress-subtitle-elo progress-subtitle__rank-value--hidden";

  progressSubtitleRank.append(progressSubtitleRankLabel, progressSubtitleRankValue);

  const progressSubtitleElo = document.createElement("span");
  progressSubtitleElo.className = "progress-subtitle-elo progress-badge";

  progressSubtitle.append(progressSubtitleRank, progressSubtitleElo);

  progressTitleContainer.append(progressTitle, progressSubtitle);
  progressHeader.append(progressTitleContainer);

  const progressSummary = document.createElement("div");
  progressSummary.className = "progress-summary";
  progressSummary.hidden = true;

  const progressBody = document.createElement("div");
  progressBody.className = "progress-body";

  progressPanel.append(progressHeader, progressSummary, progressBody);

  const leaderboardPanel = document.createElement("section");
  leaderboardPanel.className = "content-card";

  const leaderboardTop = document.createElement("div");
  leaderboardTop.className = "card-header leaderboard-topline";

  const leaderboardHeading = document.createElement("div");
  leaderboardHeading.className = "leaderboard-topline__heading";

  const leaderboardTitle = document.createElement("h3");
  leaderboardTitle.className = "card-title";
  bindLocalizedText(leaderboardTitle, "leaderboard");

  const segmentToggle = document.createElement("div");
  segmentToggle.className = "segment-toggle";

  const globalButton = document.createElement("button");
  globalButton.type = "button";
  bindLocalizedText(globalButton, "scopeGlobal");

  const seasonButton = document.createElement("button");
  seasonButton.type = "button";
  bindLocalizedText(seasonButton, "scopeSeason");

  const tournamentButton = document.createElement("button");
  tournamentButton.type = "button";
  bindLocalizedText(tournamentButton, "scopeTournament");

  segmentToggle.append(globalButton, seasonButton, tournamentButton);

  const seasonSelect = document.createElement("select");
  seasonSelect.className = "select-input";

  const seasonStats = document.createElement("div");
  seasonStats.className = "leaderboard-season-stats";
  seasonStats.hidden = true;

  const seasonStatsMatches = document.createElement("p");
  seasonStatsMatches.className = "leaderboard-season-stats__matches";

  const seasonStatsActive = document.createElement("p");
  seasonStatsActive.className = "leaderboard-season-stats__active";

  seasonStats.append(seasonStatsMatches, seasonStatsActive);

  const tournamentSelect = document.createElement("select");
  tournamentSelect.className = "select-input";

  const leaderboardStatsGroup = document.createElement("div");
  leaderboardStatsGroup.className = "leaderboard-stats-group";
  leaderboardStatsGroup.hidden = true;

  const leaderboardMatchesSummary = document.createElement("p");
  leaderboardMatchesSummary.className = "leaderboard-matches";
  leaderboardMatchesSummary.hidden = true;

  const leaderboardMatchesSummaryLabel = document.createElement("span");
  leaderboardMatchesSummaryLabel.className = "leaderboard-matches__label";
  bindLocalizedText(leaderboardMatchesSummaryLabel, "leaderboardMatchesLabel");

  const leaderboardMatchesSummaryValue = document.createElement("span");
  leaderboardMatchesSummaryValue.className = "leaderboard-matches__value";

  leaderboardMatchesSummary.append(leaderboardMatchesSummaryLabel, leaderboardMatchesSummaryValue);

  const leaderboardStatMostActive = document.createElement("div");
  leaderboardStatMostActive.className = "leaderboard-stat";
  leaderboardStatMostActive.hidden = true;

  const leaderboardStatMostActiveDetails = document.createElement("div");
  leaderboardStatMostActiveDetails.className = "leaderboard-stat__details";

  const leaderboardStatMostActiveLabel = document.createElement("span");
  leaderboardStatMostActiveLabel.className = "leaderboard-stat__label";
  bindLocalizedText(leaderboardStatMostActiveLabel, "leaderboardMostGamesLabel");

  const leaderboardStatMostActiveName = document.createElement("p");
  leaderboardStatMostActiveName.className = "leaderboard-stat__name";

  const leaderboardStatMostActivePlayer = document.createElement("span");
  leaderboardStatMostActivePlayer.className = "leaderboard-stat__player";

  const leaderboardStatMostActiveMeta = document.createElement("span");
  leaderboardStatMostActiveMeta.className = "leaderboard-stat__meta";

  leaderboardStatMostActiveName.append(leaderboardStatMostActivePlayer, leaderboardStatMostActiveMeta);
  leaderboardStatMostActiveDetails.append(leaderboardStatMostActiveLabel, leaderboardStatMostActiveName);
  leaderboardStatMostActive.append(leaderboardStatMostActiveDetails);

  const leaderboardStatLongestStreak = document.createElement("div");
  leaderboardStatLongestStreak.className = "leaderboard-stat";
  leaderboardStatLongestStreak.hidden = true;

  const leaderboardStatLongestStreakDetails = document.createElement("div");
  leaderboardStatLongestStreakDetails.className = "leaderboard-stat__details";

  const leaderboardStatLongestStreakLabel = document.createElement("span");
  leaderboardStatLongestStreakLabel.className = "leaderboard-stat__label";
  bindLocalizedText(leaderboardStatLongestStreakLabel, "leaderboardLongestStreakLabel");

  const leaderboardStatLongestStreakName = document.createElement("p");
  leaderboardStatLongestStreakName.className = "leaderboard-stat__name";

  const leaderboardStatLongestStreakPlayer = document.createElement("span");
  leaderboardStatLongestStreakPlayer.className = "leaderboard-stat__player";

  const leaderboardStatLongestStreakMeta = document.createElement("span");
  leaderboardStatLongestStreakMeta.className = "leaderboard-stat__meta";

  leaderboardStatLongestStreakName.append(leaderboardStatLongestStreakPlayer, leaderboardStatLongestStreakMeta);
  leaderboardStatLongestStreakDetails.append(leaderboardStatLongestStreakLabel, leaderboardStatLongestStreakName);
  leaderboardStatLongestStreak.append(leaderboardStatLongestStreakDetails);

  const leaderboardStatMostWins = document.createElement("div");
  leaderboardStatMostWins.className = "leaderboard-stat";
  leaderboardStatMostWins.hidden = true;

  const leaderboardStatMostWinsDetails = document.createElement("div");
  leaderboardStatMostWinsDetails.className = "leaderboard-stat__details";

  const leaderboardStatMostWinsLabel = document.createElement("span");
  leaderboardStatMostWinsLabel.className = "leaderboard-stat__label";
  bindLocalizedText(leaderboardStatMostWinsLabel, "leaderboardMostWinsLabel");

  const leaderboardStatMostWinsName = document.createElement("p");
  leaderboardStatMostWinsName.className = "leaderboard-stat__name";

  const leaderboardStatMostWinsPlayer = document.createElement("span");
  leaderboardStatMostWinsPlayer.className = "leaderboard-stat__player";

  const leaderboardStatMostWinsMeta = document.createElement("span");
  leaderboardStatMostWinsMeta.className = "leaderboard-stat__meta";

  leaderboardStatMostWinsName.append(leaderboardStatMostWinsPlayer, leaderboardStatMostWinsMeta);
  leaderboardStatMostWinsDetails.append(leaderboardStatMostWinsLabel, leaderboardStatMostWinsName);
  leaderboardStatMostWins.append(leaderboardStatMostWinsDetails);

  leaderboardStatsGroup.append(
    leaderboardMatchesSummary,
    leaderboardStatMostActive,
    leaderboardStatMostWins,
    leaderboardStatLongestStreak,
  );

  const leaderboardList = document.createElement("div");
  leaderboardList.className = "leaderboard-list";

  leaderboardHeading.append(leaderboardTitle, segmentToggle, seasonSelect, seasonStats, tournamentSelect);
  leaderboardTop.append(leaderboardHeading);
  leaderboardPanel.append(leaderboardTop, leaderboardList, leaderboardStatsGroup);

  return {
    dashboardStatus,
    shareAlert,
    viewGrid,
    progressPanel,
    progressSubtitle,
    progressSubtitleRankLabel,
    progressSubtitleRankValue,
    progressSubtitleElo,
    progressSummary,
    progressBody,
    leaderboardPanel,
    globalButton,
    seasonButton,
    tournamentButton,
    seasonSelect,
    seasonStats,
    seasonStatsMatches,
    seasonStatsActive,
    tournamentSelect,
    leaderboardStatsGroup,
    leaderboardMatchesSummary,
    leaderboardMatchesSummaryValue,
    leaderboardStatMostActive,
    leaderboardStatMostActivePlayer,
    leaderboardStatMostActiveMeta,
    leaderboardStatLongestStreak,
    leaderboardStatLongestStreakLabel,
    leaderboardStatLongestStreakPlayer,
    leaderboardStatLongestStreakMeta,
    leaderboardStatMostWins,
    leaderboardStatMostWinsPlayer,
    leaderboardStatMostWinsMeta,
    leaderboardList,
    leaderboardAvatarFallback: `${baseUrl}assets/logo.png`,
  };
};
