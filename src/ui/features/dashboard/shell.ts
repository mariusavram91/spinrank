import { bindLocalizedText, t } from "../../shared/i18n/runtime";
import type { MatchFeedFilter } from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";

export const buildDashboardHeader = (args: {
  welcomeTitle: HTMLElement;
  refreshButton: HTMLButtonElement;
  welcomeText: HTMLElement;
}): { dashboardHeader: HTMLDivElement } => {
  const dashboardHeader = document.createElement("div");
  dashboardHeader.className = "dashboard-header";

  const welcomeBlock = document.createElement("div");
  welcomeBlock.className = "welcome-block";

  const welcomeTitleRow = document.createElement("div");
  welcomeTitleRow.className = "title-row";
  welcomeTitleRow.append(args.welcomeTitle, args.refreshButton);

  welcomeBlock.append(welcomeTitleRow, args.welcomeText);
  dashboardHeader.append(welcomeBlock);

  return { dashboardHeader };
};

export const buildMatchesPanel = (args: {
  matchesTitle: HTMLElement;
  matchesMeta: HTMLElement;
  matchFilters: MatchFeedFilter[];
  matchFilterLabels: Record<MatchFeedFilter, TextKey>;
  onFilterClick: (filter: MatchFeedFilter) => void;
}): {
  matchesPanel: HTMLElement;
  matchFilterButtons: Map<MatchFeedFilter, HTMLButtonElement>;
  matchesList: HTMLDivElement;
  loadMoreButton: HTMLButtonElement;
} => {
  const matchesPanel = document.createElement("section");
  matchesPanel.className = "content-card";
  matchesPanel.dataset.testid = "matches-panel";

  const matchesTop = document.createElement("div");
  matchesTop.className = "card-header match-topline";

  const matchesHeading = document.createElement("div");
  matchesHeading.append(args.matchesTitle, args.matchesMeta);

  const matchFilterToggle = document.createElement("div");
  matchFilterToggle.className = "segment-toggle match-filter-toggle";

  const matchFiltersRow = document.createElement("div");
  matchFiltersRow.className = "match-filter-row";
  matchFiltersRow.append(matchFilterToggle);

  const matchFilterButtons = new Map<MatchFeedFilter, HTMLButtonElement>();
  args.matchFilters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(args.matchFilterLabels[filter]);
    button.dataset.testid = `matches-filter-${filter}`;
    button.addEventListener("click", () => {
      args.onFilterClick(filter);
    });
    matchFilterButtons.set(filter, button);
    matchFilterToggle.append(button);
  });

  const matchesList = document.createElement("div");
  matchesList.className = "matches-list";
  matchesList.dataset.testid = "matches-list";

  const loadMoreButton = document.createElement("button");
  loadMoreButton.type = "button";
  loadMoreButton.className = "secondary-button matches-load-more-button";
  loadMoreButton.dataset.testid = "matches-load-more";
  bindLocalizedText(loadMoreButton, "loadMore");

  matchesTop.append(matchesHeading, matchFiltersRow);
  matchesPanel.append(matchesTop, matchesList, loadMoreButton);

  return {
    matchesPanel,
    matchFilterButtons,
    matchesList,
    loadMoreButton,
  };
};

export const attachDashboardLayout = (args: {
  dashboard: HTMLElement;
  dashboardHeader: HTMLElement;
  disputedAlert: HTMLElement;
  progressPanel: HTMLElement;
  dashboardStatus: HTMLElement;
  viewGrid: HTMLElement;
  leaderboardPanel: HTMLElement;
  matchesPanel: HTMLElement;
}): void => {
  args.viewGrid.append(args.leaderboardPanel, args.matchesPanel);
  args.dashboard.append(args.dashboardHeader, args.disputedAlert, args.progressPanel, args.dashboardStatus, args.viewGrid);
};
