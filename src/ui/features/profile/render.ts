import type {
  AchievementSummaryItem,
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

const ACHIEVEMENT_ICONS: Record<AchievementSummaryItem["icon"], string> = {
  user_plus: "◉",
  ping_pong: "🏓",
  victory_badge: "🏅",
  single_dot: "①",
  bullseye: "🎯",
  double_dot: "②",
  handshake: "🤝",
  three_mark: "③",
  five_mark: "⑤",
  ten_mark: "⑩",
  twentyfive_mark: "㉕",
  fifty_mark: "㊿",
  hundred_mark: "💯",
  lightning_run: "⚡",
  wildfire: "🔥",
  podium_finish: "🏆",
  gold_medal: "🥇",
  calendar_plus: "🗓",
  calendar_stack: "🗂",
  calendar_archive: "🗃",
  leaf_one: "🍃",
  leaf_three: "🍂",
  leaf_five: "🍁",
  bracket_seed: "⟐",
  bracket_triplet: "🧩",
  bracket_crown: "♛",
  ticket_one: "🎫",
  ticket_three: "🎟",
  ticket_five: "🎪",
  chart_up: "📈",
  chart_peak: "📊",
  diamond_rank: "💎",
  rocket_rank: "🚀",
  moon_cycle: "🌙",
  sun_path: "☀",
  party_year: "🎉",
};

const buildAchievementChip = (
  item: AchievementSummaryItem,
  t: TranslationFn,
): HTMLElement => {
  const locked = !item.unlockedAt;
  const shell = document.createElement("div");
  shell.className = "profile-segment-card-shell";

  const chip = document.createElement("article");
  chip.className = [
    "profile-segment-card",
    "achievement-card",
    `achievement-card--${item.tier}`,
    locked ? "profile-segment-card--completed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  chip.setAttribute("aria-disabled", locked ? "true" : "false");

  const icon = document.createElement("span");
  icon.className = "achievement-card__icon";
  icon.textContent = ACHIEVEMENT_ICONS[item.icon];
  icon.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "achievement-card__content";

  const top = document.createElement("div");
  top.className = "profile-segment-card__top";

  const titleBlock = document.createElement("div");
  titleBlock.className = "profile-segment-card__title-block";

  const title = document.createElement("p");
  title.className = "profile-segment-card__title";
  title.textContent = t(item.titleKey as TextKey);

  const description = document.createElement("p");
  description.className = "profile-segment-card__meta achievement-card__description";
  description.textContent = t(item.descriptionKey as TextKey);

  titleBlock.append(title, description);
  top.append(titleBlock);

  const meta = document.createElement("p");
  meta.className = "achievement-card__meta";
  meta.textContent = locked && item.progressTarget
    ? `${t("achievementProgressLabel")} ${item.progressValue}/${item.progressTarget}`
    : `${t("achievementPointsLabel")} ${item.points}`;

  content.append(top, meta);
  chip.append(icon, content);
  shell.append(chip);
  return shell;
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
  achievementsSummary: HTMLElement;
  achievementsToggle: HTMLButtonElement;
  achievementsList: HTMLElement;
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
  args.status.textContent = "";
  args.status.hidden = true;

  const allAchievements = args.dashboardState.achievements?.items ?? [];
  const unlockedAchievements = allAchievements.filter((item) => item.unlockedAt);
  const recentlySeenAchievementKeys = new Set(args.dashboardState.profileRecentlySeenAchievementKeys);
  const visibleAchievements = allAchievements.filter(
    (item) => !item.unlockedAt || recentlySeenAchievementKeys.has(item.key),
  );
  const achievementNodes = [...visibleAchievements]
    .sort((left, right) => {
      const leftUnlocked = Boolean(left.unlockedAt);
      const rightUnlocked = Boolean(right.unlockedAt);
      if (leftUnlocked !== rightUnlocked) {
        return leftUnlocked ? -1 : 1;
      }
      return left.points - right.points;
    })
    .map((item) => buildAchievementChip(item, args.t));
  const summaryNodes = unlockedAchievements.map((item) => {
    const icon = document.createElement("span");
    icon.className = "achievement-card__icon profile-achievements__summary-icon";
    icon.textContent = ACHIEVEMENT_ICONS[item.icon];
    icon.title = args.t(item.titleKey as TextKey);
    icon.setAttribute("aria-label", args.t(item.titleKey as TextKey));
    return icon;
  });
  args.achievementsSummary.replaceChildren(
    ...(summaryNodes.length > 0 ? summaryNodes : [createEmptyState(args.t("achievementsEmpty"))]),
  );
  args.achievementsToggle.hidden = achievementNodes.length === 0;
  args.achievementsToggle.textContent = args.dashboardState.profileAchievementsExpanded
    ? args.t("achievementsHideAll")
    : args.t("achievementsShowAll");
  args.achievementsToggle.setAttribute("aria-expanded", String(args.dashboardState.profileAchievementsExpanded));
  args.achievementsList.hidden = !args.dashboardState.profileAchievementsExpanded;
  args.achievementsList.replaceChildren(
    ...(achievementNodes.length > 0 ? achievementNodes : [createEmptyState(args.t("achievementsEmpty"))]),
  );

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
    const emptyMessage = args.t("matchFilterEmptyMine");
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
