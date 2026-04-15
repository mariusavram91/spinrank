import type {
  MatchBracketContext,
  MatchFeedFilter,
  MatchRecord,
} from "../../../../api/contract";
import type { DashboardState } from "../../../shared/types/app";
import type { TextKey } from "../../../shared/i18n/translations";
import { translateBracketRoundTitle } from "../../app/helpers";

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
  canDeleteMatch: (match: MatchRecord, sessionUserId: string) => boolean;
  onDeleteMatch: (match: MatchRecord) => void;
  onDisputeMatch: (match: MatchRecord) => void;
  onRemoveMatchDispute: (match: MatchRecord) => void;
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

const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

const canCreateDispute = (match: MatchRecord, sessionUserId: string): boolean =>
  match.createdByUserId !== sessionUserId &&
  [...match.teamAPlayerIds, ...match.teamBPlayerIds].includes(sessionUserId) &&
  Date.now() <= new Date(match.createdAt).getTime() + DISPUTE_WINDOW_MS;

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
      if (args.dashboardState.highlightedMatchId === match.id || args.dashboardState.highlightedMatchIds.includes(match.id)) {
        cardNode.classList.add("match-row--highlighted");
      }
      cardNode.id = `match-row-${match.id}`;

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
        roundTag.textContent = `${bracketContext.isFinal ? "🏆 " : ""}${translateBracketRoundTitle(bracketContext.roundTitle, args.t)}`;
        detailLine.append(roundTag);
      }

      if (match.hasActiveDispute) {
        const disputeTag = document.createElement("span");
        disputeTag.className = "match-round";
        disputeTag.textContent = "Disputed";
        detailLine.append(disputeTag);
      }

      meta.append(header, detailLine);

      const footer = document.createElement("div");
      footer.className = "match-meta__footer";
      const footerText = document.createElement("span");
      footerText.textContent = args.formatDateTime(match.playedAt);
      footer.append(footerText);

      const currentUserId = args.getCurrentUserId();
      if (match.currentUserDispute || canCreateDispute(match, currentUserId)) {
        const disputeButton = document.createElement("button");
        disputeButton.type = "button";
        disputeButton.className = "match-row__action-button";
        disputeButton.textContent = match.currentUserDispute ? "Remove dispute" : "Dispute";
        disputeButton.addEventListener("click", () => {
          if (match.currentUserDispute) {
            void args.onRemoveMatchDispute(match);
            return;
          }
          void args.onDisputeMatch(match);
        });
        footer.append(disputeButton);
      }

      if (args.canDeleteMatch(match, currentUserId)) {
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
    const scrollTargetId = args.dashboardState.pendingHighlightedMatchIds.find((matchId) =>
      Boolean(args.matchesList.querySelector<HTMLElement>(`#match-row-${matchId}`)),
    );
    if (scrollTargetId) {
      const highlightedNode = args.matchesList.querySelector<HTMLElement>(`#match-row-${scrollTargetId}`);
      if (highlightedNode) {
        highlightedNode.scrollIntoView({ block: "center", behavior: "smooth" });
        args.dashboardState.pendingHighlightedMatchIds = [];
      }
    }
  },
});
