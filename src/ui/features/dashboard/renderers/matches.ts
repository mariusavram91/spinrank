import type {
  MatchBracketContext,
  MatchFeedFilter,
  MatchRecord,
} from "../../../../api/contract";
import type { DashboardState } from "../../../shared/types/app";
import type { TextKey } from "../../../shared/i18n/translations";

type TranslationFn = (key: TextKey) => string;

export type MatchesRendererArgs = {
  dashboardState: DashboardState;
  matchesList: HTMLElement;
  matchesMeta: HTMLElement;
  t: TranslationFn;
  renderMatchScore: (match: MatchRecord) => string;
  renderPlayerNames: (playerIds: string[], players: DashboardState["players"]) => string;
  renderMatchContext: (
    match: MatchRecord,
    seasons: DashboardState["seasons"],
    tournaments: DashboardState["tournaments"],
    bracketContext: MatchBracketContext | null,
    options?: { includeRound?: boolean; includeTournamentTrophy?: boolean },
  ) => string;
  formatDateTime: (value: string) => string;
  getCurrentUserId: () => string;
  canSoftDelete: (resource: { createdByUserId?: string | null }, sessionUserId: string) => boolean;
  onDeleteMatch: (match: MatchRecord) => void;
};

const getMatchFilterEmptyText = (filter: MatchFeedFilter, t: TranslationFn): string => {
  if (filter === "mine") {
    return t("matchFilterEmptyMine");
  }
  if (filter === "all") {
    return t("matchFilterEmptyAll");
  }
  return t("matchFilterEmptyRecent");
};

const createEmptyState = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
};

const createTeamBlock = (
  labelText: string,
  winner: boolean,
): HTMLDivElement => {
  const block = document.createElement("div");
  block.className = ["match-row__team", winner ? "match-row__team--winner" : ""]
    .filter(Boolean)
    .join(" ");

  const teamName = document.createElement("span");
  teamName.className = "match-row__team-name";
  teamName.textContent = labelText;

  block.append(teamName);
  return block;
};

export const createMatchesRenderer = (args: MatchesRendererArgs): { render: () => void } => ({
  render: () => {
    args.matchesMeta.textContent = "";

    if (args.dashboardState.matches.length === 0) {
      const emptyMessage = getMatchFilterEmptyText(args.dashboardState.matchesFilter, args.t);
      args.matchesList.replaceChildren(createEmptyState(emptyMessage));
      return;
    }

    const matchCards = args.dashboardState.matches.map((match) => {
      const cardNode = document.createElement("article");
      cardNode.className = "match-row";

      const meta = document.createElement("div");
      meta.className = "match-meta";

      const header = document.createElement("div");
      header.className = "match-row__header";

      const detailLine = document.createElement("div");
      detailLine.className = "match-row__detail-line";

      const teamALabel =
        args.renderPlayerNames(match.teamAPlayerIds, args.dashboardState.players) || args.t("teamALabel");
      const teamBLabel =
        args.renderPlayerNames(match.teamBPlayerIds, args.dashboardState.players) || args.t("teamBLabel");

      const scoreBadge = document.createElement("div");
      scoreBadge.className = "match-row__score-badge";
      scoreBadge.textContent = args.renderMatchScore(match);

      const teamARow = document.createElement("div");
      teamARow.className = "match-row__team-row match-row__team-row--left";
      teamARow.append(createTeamBlock(teamALabel, match.winnerTeam === "A"));

      const scoreRow = document.createElement("div");
      scoreRow.className = "match-row__score-row";
      scoreRow.append(scoreBadge);

      const teamBRow = document.createElement("div");
      teamBRow.className = "match-row__team-row match-row__team-row--right";
      teamBRow.append(createTeamBlock(teamBLabel, match.winnerTeam === "B"));

      header.append(teamARow, scoreRow, teamBRow);

      const matchTypeLabel = document.createElement("span");
      matchTypeLabel.className = "match-type";
      matchTypeLabel.textContent =
        match.matchType === "singles" ? args.t("matchSummarySingles") : args.t("matchSummaryDoubles");

      const contextLabel = document.createElement("span");
      contextLabel.className = "match-context";
      contextLabel.textContent = args.renderMatchContext(
        match,
        args.dashboardState.seasons,
        args.dashboardState.tournaments,
        args.dashboardState.matchBracketContextByMatchId[match.id] || null,
        { includeRound: false, includeTournamentTrophy: false },
      );

      detailLine.append(matchTypeLabel, contextLabel);

      const bracketContext = args.dashboardState.matchBracketContextByMatchId[match.id] || null;
      if (bracketContext?.roundTitle) {
        const roundTag = document.createElement("span");
        roundTag.className = "match-round";
        roundTag.textContent = `${bracketContext.isFinal ? "🏆 " : ""}${bracketContext.roundTitle}`;
        detailLine.append(roundTag);
      }

      meta.append(header, detailLine);

      const footer = document.createElement("div");
      footer.className = "match-meta__footer";
      const footerText = document.createElement("span");
      footerText.textContent = args.formatDateTime(match.playedAt);
      footer.append(footerText);

      if (args.canSoftDelete(match, args.getCurrentUserId())) {
        const deleteMatchButton = document.createElement("button");
        deleteMatchButton.type = "button";
        deleteMatchButton.className = "icon-button match-delete-button";
        deleteMatchButton.dataset.testid = "match-delete-button";
        deleteMatchButton.textContent = "🗑";
        deleteMatchButton.setAttribute("aria-label", "Delete match");
        deleteMatchButton.title = "Delete match";
        deleteMatchButton.addEventListener("click", () => {
          void args.onDeleteMatch(match);
        });
        footer.append(deleteMatchButton);
      }

      cardNode.append(meta, footer);
      return cardNode;
    });

    args.matchesList.replaceChildren(...matchCards);
  },
});
