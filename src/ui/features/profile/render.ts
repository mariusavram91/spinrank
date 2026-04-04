import type {
  LeaderboardEntry,
  MatchBracketContext,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
} from "../../../api/contract";
import type { DashboardState, ProfileSegmentSummary } from "../../shared/types/app";
import type { TextKey } from "../../shared/i18n/translations";
import { isLockedSeason, isLockedTournament } from "../app/helpers";

type TranslationFn = (key: TextKey) => string;

const createEmptyState = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
};

const getPodiumMedal = (rank: number | null | undefined): string | null => {
  if (rank === 1) {
    return "🥇";
  }
  if (rank === 2) {
    return "🥈";
  }
  if (rank === 3) {
    return "🥉";
  }
  return null;
};

const resolvePlacementLabel = (
  summary: ProfileSegmentSummary,
  t: TranslationFn,
): string | null => {
  if (!summary.placementLabelKey) {
    return null;
  }
  const template = t(summary.placementLabelKey);
  if (summary.placementLabelKey === "leaderboardPlacementRoundOf") {
    return template.replace("{count}", String(summary.placementLabelCount ?? 0));
  }
  return template;
};

const renderMatchContextLabel = (
  match: MatchRecord,
  seasons: SeasonRecord[],
  tournaments: TournamentRecord[],
  bracketContext: MatchBracketContext | null,
  renderMatchContext: (
    match: MatchRecord,
    seasons: SeasonRecord[],
    tournaments: TournamentRecord[],
    bracketContext: MatchBracketContext | null,
    options?: { includeRound?: boolean; includeTournamentTrophy?: boolean },
  ) => string,
): string =>
  renderMatchContext(match, seasons, tournaments, bracketContext, {
    includeRound: false,
    includeTournamentTrophy: false,
  });

const buildVisibilityIcon = (
  record: SeasonRecord | TournamentRecord,
  kind: "season" | "tournament",
): HTMLSpanElement => {
  const icon = document.createElement("span");
  icon.className = "profile-visibility-icon";
  const isPublic = kind === "season" ? (record as SeasonRecord).isPublic : false;
  icon.textContent = isPublic ? "🌐" : "🔒";
  icon.title = isPublic ? "Public" : "Private";
  icon.setAttribute("aria-label", isPublic ? "Public" : "Private");
  return icon;
};

const renderSegmentCardStats = (
  record: SeasonRecord | TournamentRecord,
  summary: ProfileSegmentSummary | null,
  t: TranslationFn,
): HTMLElement => {
  const stats = document.createElement("div");
  stats.className = "profile-segment-card__stats";

  const entries: string[] = [];
  if (summary) {
    entries.push(`${t("leaderboardWins")} ${summary.wins}`);
    entries.push(`${t("leaderboardLosses")} ${summary.losses}`);
    if (summary.rank) {
      entries.push(`${t("progressRanked")} #${summary.rank}`);
    }
    const placementLabel = resolvePlacementLabel(summary, t);
    if (placementLabel) {
      entries.push(`${t("profilePlacement")} ${placementLabel}`);
    }
  }

  const participantCount =
    "participantCount" in record ? record.participantCount : record.participantIds.length;
  entries.push(`${t("profileParticipants")} ${participantCount}`);

  if (entries.length === 0) {
    stats.textContent = t("profileStatsLoading");
    return stats;
  }

  entries.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "profile-stat-chip";
    chip.textContent = text;
    stats.append(chip);
  });
  return stats;
};

const buildSegmentCard = (args: {
  record: SeasonRecord | TournamentRecord;
  kind: "season" | "tournament";
  isCreated: boolean;
  summary: ProfileSegmentSummary | null;
  isSummaryLoading: boolean;
  t: TranslationFn;
  onOpen: () => void;
}): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-segment-card-shell";

  const card = document.createElement("button");
  card.type = "button";
  const isLocked = args.kind === "season" ? isLockedSeason(args.record as SeasonRecord) : isLockedTournament(args.record as TournamentRecord);
  const isInactiveSeason = args.kind === "season" && !(args.record as SeasonRecord).isActive && !isLocked;
  card.className = [
    "profile-segment-card",
    `profile-segment-card--${args.kind}`,
    args.isCreated ? "profile-segment-card--created" : "",
    isInactiveSeason ? "profile-segment-card--inactive" : "",
    isLocked ? "profile-segment-card--completed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  card.disabled = isLocked;

  const top = document.createElement("div");
  top.className = "profile-segment-card__top";

  const titleBlock = document.createElement("div");
  titleBlock.className = "profile-segment-card__title-block";

  const titleRow = document.createElement("div");
  titleRow.className = "profile-segment-card__title-row";

  const title = document.createElement("span");
  title.className = "profile-segment-card__title";
  title.textContent = args.record.name;

  const meta = document.createElement("span");
  meta.className = "profile-segment-card__meta";
  meta.textContent =
    args.kind === "season"
      ? `${(args.record as SeasonRecord).startDate}${(args.record as SeasonRecord).endDate ? ` - ${(args.record as SeasonRecord).endDate}` : ""}`
      : (args.record as TournamentRecord).date;

  const metaRow = document.createElement("div");
  metaRow.className = "profile-segment-card__meta-row";
  metaRow.append(meta);

  titleRow.append(buildVisibilityIcon(args.record, args.kind), title);
  titleBlock.append(titleRow, metaRow);

  const badges = document.createElement("div");
  badges.className = "profile-segment-card__badges";

  if (args.isCreated) {
    const roleBadge = document.createElement("span");
    roleBadge.className = "profile-badge profile-badge--role";
    roleBadge.textContent = args.t("profileCreatedBadge");
    badges.append(roleBadge);
  }

  top.append(titleBlock, badges);
  card.append(top);

  if (args.isSummaryLoading && !args.summary) {
    const loading = document.createElement("p");
    loading.className = "profile-segment-card__loading";
    loading.textContent = args.t("profileStatsLoading");
    card.append(loading);
  } else {
    card.append(renderSegmentCardStats(args.record, args.summary, args.t));
  }

  if (isLocked) {
    const medal = getPodiumMedal(args.summary?.rank);
    if (medal) {
      const overlay = document.createElement("span");
      overlay.className = "profile-segment-card__medal";
      overlay.textContent = medal;
      overlay.setAttribute("aria-hidden", "true");
      wrapper.append(overlay);
    }
  }

  if (!isLocked) {
    card.addEventListener("click", args.onOpen);
  }
  wrapper.append(card);
  return wrapper;
};

export const renderProfileScreen = (args: {
  dashboardState: DashboardState;
  currentUserId: string;
  seasonsList: HTMLElement;
  tournamentsList: HTMLElement;
  matchesList: HTMLElement;
  status: HTMLElement;
  loadMoreButton: HTMLButtonElement;
  t: TranslationFn;
  renderMatchScore: (match: MatchRecord) => string;
  renderPlayerNames: (playerIds: string[], players: LeaderboardEntry[]) => string;
  renderMatchContext: (
    match: MatchRecord,
    seasons: SeasonRecord[],
    tournaments: TournamentRecord[],
    bracketContext: MatchBracketContext | null,
    options?: { includeRound?: boolean; includeTournamentTrophy?: boolean },
  ) => string;
  formatDateTime: (value: string) => string;
  onOpenSeason: (seasonId: string) => void;
  onOpenTournament: (tournamentId: string) => void;
  onLoadMoreMatches: () => void;
}): void => {
  args.status.textContent = args.dashboardState.profileLoading ? args.t("loadingOverlay") : "";
  args.status.hidden = !args.dashboardState.profileLoading;

  const seasons = args.dashboardState.seasons
    .filter((season) => season.status !== "deleted" && season.participantIds.includes(args.currentUserId))
    .sort((left, right) => Date.parse(right.startDate) - Date.parse(left.startDate));
  const tournaments = args.dashboardState.tournaments
    .filter((tournament) => tournament.status !== "deleted" && tournament.participantIds.includes(args.currentUserId))
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date));

  const renderSegmentGroup = <T extends SeasonRecord | TournamentRecord>(groupArgs: {
    records: T[];
    target: HTMLElement;
    kind: "season" | "tournament";
    onOpen: (id: string) => void;
  }) => {
    if (groupArgs.records.length === 0) {
      groupArgs.target.replaceChildren(createEmptyState(args.t("profileEmptyGroup")));
      return;
    }

    const cards = groupArgs.records.map((record) => {
      const key = `${groupArgs.kind}:${record.id}`;
      const summary = args.dashboardState.profileSegmentSummaries[key] ?? null;
      const isSummaryLoading = args.dashboardState.profileSegmentSummaryLoadingKeys.includes(key);
      return buildSegmentCard({
        record,
        kind: groupArgs.kind,
        isCreated: record.createdByUserId === args.currentUserId,
        summary,
        isSummaryLoading,
        t: args.t,
        onOpen: () => groupArgs.onOpen(record.id),
      });
    });
    groupArgs.target.replaceChildren(...cards);
  };

  renderSegmentGroup({
    records: seasons,
    target: args.seasonsList,
    kind: "season",
    onOpen: args.onOpenSeason,
  });
  renderSegmentGroup({
    records: tournaments,
    target: args.tournamentsList,
    kind: "tournament",
    onOpen: args.onOpenTournament,
  });

  args.loadMoreButton.hidden = true;

  if (args.dashboardState.profileMatches.length === 0) {
    const emptyMessage = args.dashboardState.profileMatchesLoading
      ? args.t("loadingMatches")
      : args.t("matchFilterEmptyMine");
    args.matchesList.replaceChildren(createEmptyState(emptyMessage));
    return;
  }

  const matchNodes = args.dashboardState.profileMatches.slice(0, 15).map((match) => {
    const card = document.createElement("article");
    const userWon =
      (match.winnerTeam === "A" && match.teamAPlayerIds.includes(args.currentUserId)) ||
      (match.winnerTeam === "B" && match.teamBPlayerIds.includes(args.currentUserId));
    card.className = ["profile-match-card", userWon ? "profile-match-card--won" : "profile-match-card--lost"].join(
      " ",
    );

    const header = document.createElement("div");
    header.className = "profile-match-card__header";

    const players = document.createElement("span");
    players.className = "profile-match-card__players";
    const left = args.renderPlayerNames(match.teamAPlayerIds, args.dashboardState.players) || args.t("teamALabel");
    const right = args.renderPlayerNames(match.teamBPlayerIds, args.dashboardState.players) || args.t("teamBLabel");
    players.textContent = `${left} vs ${right}`;

    const score = document.createElement("span");
    score.className = "profile-match-card__score";
    score.textContent = args.renderMatchScore(match);

    const meta = document.createElement("div");
    meta.className = "profile-match-card__meta";
    meta.textContent = renderMatchContextLabel(
      match,
      args.dashboardState.seasons,
      args.dashboardState.tournaments,
      args.dashboardState.matchBracketContextByMatchId[match.id] || null,
      args.renderMatchContext,
    );

    const date = document.createElement("div");
    date.className = "profile-match-card__date";
    date.textContent = args.formatDateTime(match.playedAt);

    header.append(players, score);
    card.append(header, meta, date);
    return card;
  });

  args.matchesList.replaceChildren(...matchNodes);
};
