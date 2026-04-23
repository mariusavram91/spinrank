import type {
  AchievementSummaryItem,
  LeaderboardEntry,
  MatchBracketContext,
  MatchRecord,
  SeasonRecord,
  TournamentRecord,
} from "../../../api/contract";
import type { DashboardState, ProfileMatchesFilter, ProfileSegmentSummary } from "../../shared/types/app";
import type { TextKey } from "../../shared/i18n/translations";
import { isLockedSeason, isLockedTournament } from "../app/helpers";
import { renderActivityHeatmap } from "./activityHeatmap";

type TranslationFn = (key: TextKey) => string;

const createEmptyState = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
};

const formatSignedDelta = (value: number): string => (value >= 0 ? `+${value}` : String(value));
const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
const formatOneDecimal = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};
const getMatchWeight = (matchType: MatchRecord["matchType"]): number => (matchType === "singles" ? 1 : 0.7);

export const ACHIEVEMENT_ICONS: Record<AchievementSummaryItem["icon"], string> = {
  user_plus: "👤",
  ping_pong: "🏓",
  victory_badge: "✅",
  single_dot: "🧍",
  bullseye: "🎯",
  double_dot: "👯",
  handshake: "🤝",
  three_mark: "③",
  five_mark: "⑤",
  ten_mark: "⑩",
  twentyfive_mark: "㉕",
  fifty_mark: "㊿",
  hundred_mark: "💯",
  road_250_badge: "🛣️",
  club_500_badge: "⛰️",
  endless_rally_badge: "♾️",
  lightning_run: "⚡",
  wildfire: "🔥",
  iron_wall_badge: "🧱",
  perfect_11_badge: "🚫",
  perfect_21_badge: "👑",
  blowout_11_badge: "💥",
  blowout_21_badge: "🌪️",
  marathon_match_badge: "⏳",
  lucky_numbers_badge: "🎰",
  mirror_match_badge: "🪞",
  style_points_badge: "🕶️",
  top_ten_badge: "🔟",
  podium_finish: "🥉",
  gold_medal: "🥇",
  dynasty_badge: "🏛️",
  defender_badge: "🛡️",
  upset_victory_badge: "📈",
  positive_record_badge: "⚖️",
  dominant_era_badge: "💪",
  calendar_plus: "🗓️",
  calendar_stack: "🗂️",
  calendar_archive: "🗃️",
  leaf_one: "🍃",
  leaf_three: "🍂",
  leaf_five: "🍁",
  season_podium_badge: "🥉",
  season_winner_badge: "🌟",
  season_podiums_badge: "🏵️",
  season_dynasty_badge: "🏰",
  spring_contender_badge: "🌱",
  spring_champion_badge: "🌞",
  bracket_seed: "🧬",
  bracket_triplet: "🧩",
  bracket_crown: "♛",
  tournament_finalist_badge: "🥈",
  tournament_winner_badge: "🏆",
  tournament_finals_badge: "🎖️",
  tournament_dynasty_badge: "🦁",
  squad_goals_badge: "👥",
  rivalry_begins_badge: "⚔️",
  arch_rival_badge: "🐉",
  weekly_warrior_badge: "📅",
  all_rounder_badge: "🧠",
  ticket_one: "🎫",
  ticket_three: "🎟️",
  ticket_five: "🎪",
  chart_up: "📶",
  chart_peak: "📊",
  diamond_rank: "💎",
  rocket_rank: "🚀",
  deuce_master_badge: "🪢",
  ice_cold_badge: "🧊",
  clutch_player_badge: "🦾",
  comeback_king_badge: "🔁",
  completionist_i_badge: "📘",
  completionist_ii_badge: "📚",
  completionist_iii_badge: "📜",
  moon_cycle: "🌙",
  sun_path: "☀️",
  party_year: "🎉",
};

export const buildAchievementChip = (
  item: AchievementSummaryItem,
  t: TranslationFn,
  options?: { shellClassName?: string },
): HTMLElement => {
  const locked = !item.unlockedAt;
  const shell = document.createElement("div");
  shell.className = ["profile-segment-card-shell", options?.shellClassName].filter(Boolean).join(" ");

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
  currentUserDisplayName: string;
  achievementsTitle: HTMLElement;
  achievementsSubtitle: HTMLElement;
  achievementsSummary: HTMLElement;
  achievementsPreview: HTMLElement;
  achievementsUnread: HTMLElement;
  achievementsToggle: HTMLButtonElement;
  achievementsList: HTMLElement;
  activityHeatmap: HTMLElement;
  currentUserId: string;
  seasonsList: HTMLElement;
  tournamentsList: HTMLElement;
  matchesSummary: HTMLElement;
  matchFilterAllButton: HTMLButtonElement;
  matchFilterSinglesButton: HTMLButtonElement;
  matchFilterDoublesButton: HTMLButtonElement;
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
  onProfileMatchFilterChange: (filter: ProfileMatchesFilter) => void;
  locale: string;
}): void => {
  const profileFormMessage = args.dashboardState.profileFormMessage ?? "";
  args.status.textContent = profileFormMessage;
  args.status.hidden = !profileFormMessage;
  args.status.dataset.status = profileFormMessage.toLowerCase().includes("failed") ? "error" : "success";
  args.status.classList.toggle("share-alert--visible", Boolean(profileFormMessage));

  const allAchievements = args.dashboardState.achievements?.items ?? [];
  const unlockedAchievements = allAchievements.filter((item) => item.unlockedAt);
  const unlockedAchievementPoints = unlockedAchievements.reduce((total, item) => total + item.points, 0);
  args.achievementsTitle.textContent = args.t("achievementsTitle");
  args.achievementsSubtitle.textContent = `${args.t("achievementsTotalPointsLabel" as TextKey)} ${unlockedAchievementPoints}`;
  const unreadAchievementKeys = new Set(args.dashboardState.profileRecentlySeenAchievementKeys);
  const recentUnlocks = args.dashboardState.achievements?.recentUnlocks ?? [];
  const unreadUnlockedAchievements = (
    recentUnlocks.length > 0
      ? recentUnlocks.filter((item) => item.unlockedAt && unreadAchievementKeys.has(item.key))
      : unlockedAchievements.filter((item) => unreadAchievementKeys.has(item.key))
  );
  const visibleAchievements = allAchievements.filter(
    (item) => !item.unlockedAt || !unreadAchievementKeys.has(item.key),
  );
  const unreadAchievementNodes = unreadUnlockedAchievements
    .sort((left, right) => left.points - right.points)
    .map((item) => buildAchievementChip(item, args.t));
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
  const selectedAchievement = unlockedAchievements.find(
    (item) => item.key === args.dashboardState.profileSelectedAchievementKey,
  );
  const summaryNodes = unlockedAchievements.map((item) => {
      const icon = document.createElement("button");
      icon.type = "button";
      icon.className = "achievement-card__icon profile-achievements__summary-icon";
      icon.textContent = ACHIEVEMENT_ICONS[item.icon];
      icon.title = args.t(item.titleKey as TextKey);
      icon.setAttribute("aria-label", args.t(item.titleKey as TextKey));
      icon.dataset.achievementKey = item.key;
      icon.setAttribute("aria-pressed", String(selectedAchievement?.key === item.key));
      return icon;
    });
  args.achievementsPreview.hidden = !selectedAchievement;
  args.achievementsPreview.replaceChildren(...(selectedAchievement ? [buildAchievementChip(selectedAchievement, args.t)] : []));
  if (summaryNodes.length === 0) {
    args.achievementsSummary.replaceChildren(createEmptyState(args.t("achievementsEmpty")));
  } else {
    args.achievementsSummary.replaceChildren(...summaryNodes);
    if (selectedAchievement) {
      const summaryIcons = [...args.achievementsSummary.querySelectorAll<HTMLElement>("[data-achievement-key]")];
      const selectedIcon = summaryIcons.find((icon) => icon.dataset.achievementKey === selectedAchievement.key) ?? null;
      if (selectedIcon) {
        const selectedRowTop = selectedIcon.offsetTop;
        let insertionAnchor: HTMLElement = selectedIcon;
        for (const icon of summaryIcons) {
          if (icon.offsetTop === selectedRowTop && icon.offsetLeft >= selectedIcon.offsetLeft) {
            insertionAnchor = icon;
          }
        }
        insertionAnchor.after(args.achievementsPreview);
      } else {
        args.achievementsSummary.append(args.achievementsPreview);
      }
    }
  }
  args.achievementsUnread.hidden = unreadAchievementNodes.length === 0;
  args.achievementsUnread.replaceChildren(...unreadAchievementNodes);
  args.achievementsToggle.hidden = achievementNodes.length === 0;
  args.achievementsToggle.textContent = args.dashboardState.profileAchievementsExpanded
    ? args.t("achievementsHideAll")
    : args.t("achievementsShowAll");
  args.achievementsToggle.setAttribute("aria-expanded", String(args.dashboardState.profileAchievementsExpanded));
  args.achievementsList.hidden = !args.dashboardState.profileAchievementsExpanded;
  args.achievementsList.replaceChildren(
    ...(achievementNodes.length > 0 ? achievementNodes : [createEmptyState(args.t("achievementsEmpty"))]),
  );

  renderActivityHeatmap({
    target: args.activityHeatmap,
    data: args.dashboardState.userProgress?.activityHeatmap ?? null,
    locale: args.locale,
    t: args.t,
  });

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

  const singles = args.dashboardState.userProgress?.singles ?? { matches: 0, wins: 0, losses: 0 };
  const doubles = args.dashboardState.userProgress?.doubles ?? { matches: 0, wins: 0, losses: 0 };
  const buildTypeSummaryCard = (
    title: string,
    values: { matches: number; wins: number; losses: number },
  ): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = "profile-match-type-summary__card";

    const heading = document.createElement("p");
    heading.className = "profile-match-type-summary__title";
    heading.textContent = title;

    const body = document.createElement("p");
    body.className = "profile-match-type-summary__values";
    body.textContent = `${args.t("progressMatchesLabel")} ${values.matches} • ${args.t("leaderboardWins")} ${values.wins} • ${args.t("leaderboardLosses")} ${values.losses}`;
    card.append(heading, body);
    return card;
  };
  args.matchesSummary.replaceChildren(
    buildTypeSummaryCard(args.t("matchTypeSingles"), singles),
    buildTypeSummaryCard(args.t("matchTypeDoubles"), doubles),
  );

  const selectedFilter: ProfileMatchesFilter = args.dashboardState.profileMatchesFilter ?? "all";
  args.matchFilterAllButton.setAttribute("aria-pressed", String(selectedFilter === "all"));
  args.matchFilterSinglesButton.setAttribute("aria-pressed", String(selectedFilter === "singles"));
  args.matchFilterDoublesButton.setAttribute("aria-pressed", String(selectedFilter === "doubles"));
  args.matchFilterAllButton.onclick = () => args.onProfileMatchFilterChange("all");
  args.matchFilterSinglesButton.onclick = () => args.onProfileMatchFilterChange("singles");
  args.matchFilterDoublesButton.onclick = () => args.onProfileMatchFilterChange("doubles");

  if (args.dashboardState.profileMatches.length === 0) {
    args.loadMoreButton.hidden = true;
    const emptyMessage = args.t("matchFilterEmptyMine");
    args.matchesList.replaceChildren(createEmptyState(emptyMessage));
    return;
  }

  const filteredMatches = selectedFilter === "all"
    ? args.dashboardState.profileMatches
    : args.dashboardState.profileMatches.filter((match) => match.matchType === selectedFilter);
  if (filteredMatches.length === 0) {
    const emptyKey = selectedFilter === "singles" ? "profileEmptySinglesMatches" : "profileEmptyDoublesMatches";
    args.matchesList.replaceChildren(createEmptyState(args.t(emptyKey)));
    args.loadMoreButton.hidden = !args.dashboardState.profileMatchesCursor;
    args.loadMoreButton.disabled = args.dashboardState.profileMatchesLoading;
    return;
  }

  const matchNodes = filteredMatches.map((match) => {
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

    const impact = document.createElement("details");
    impact.className = "profile-match-impact";

    const impactSummary = document.createElement("summary");
    impactSummary.className = "profile-match-impact__summary";
    impactSummary.textContent = args.t("profileMatchImpactToggle");

    const impactBody = document.createElement("div");
    impactBody.className = "profile-match-impact__body";

    const weightLine = document.createElement("p");
    weightLine.className = "profile-match-impact__line";
    const matchWeight = getMatchWeight(match.matchType);
    const matchTypeLabel = args.t(match.matchType === "singles" ? "matchTypeSingles" : "matchTypeDoubles");
    weightLine.textContent = `${args.t("profileMatchImpactWeight")} ${formatOneDecimal(matchWeight)} (${matchTypeLabel})`;

    const globalGroup = document.createElement("section");
    globalGroup.className = [
      "profile-match-impact__group",
      "profile-match-impact__group--global",
      userWon ? "profile-match-impact__group--won" : "profile-match-impact__group--lost",
    ].join(" ");
    const globalTitle = document.createElement("h5");
    globalTitle.className = "profile-match-impact__group-title";
    globalTitle.textContent = args.t("profileMatchImpactGlobal");

    const globalRow = document.createElement("p");
    globalRow.className = "profile-match-impact__line profile-match-impact__line--primary";
    const globalBefore = match.ratingImpact?.globalBefore;
    const globalAfter = match.ratingImpact?.globalAfter;
    const globalDelta = match.ratingImpact?.globalDelta;
    if (typeof globalBefore === "number" && typeof globalAfter === "number" && typeof globalDelta === "number") {
      globalRow.textContent =
        `${args.t("profileMatchImpactGlobalPointsSimple")} ${globalBefore} -> ${globalAfter} (${formatSignedDelta(globalDelta)})`;
    } else {
      globalRow.textContent = `${args.t("profileMatchImpactChange")}: ${
        typeof globalDelta === "number" ? formatSignedDelta(globalDelta) : args.t("profileMatchImpactUnavailable")
      }`;
    }
    globalGroup.append(globalTitle, globalRow);

    const globalGap = match.ratingImpact?.globalGap;
    if (typeof globalGap === "number") {
      const globalGapRow = document.createElement("p");
      globalGapRow.className = "profile-match-impact__line";
      globalGapRow.textContent = `${args.t("profileMatchImpactGlobalGapSimple")} ${args.t("profileMatchImpactGapYou")} ${formatSignedDelta(globalGap)}`;
      globalGroup.append(globalGapRow);
    }

    const seasonDelta = match.ratingImpact?.seasonScoreDelta;

    const reason = document.createElement("p");
    reason.className = "profile-match-impact__source";
    const expected = match.ratingImpact?.expectedWinProbability;
    const outcome = match.ratingImpact?.outcome;
    if (typeof expected === "number" && outcome) {
      const expectedRow = document.createElement("p");
      expectedRow.className = "profile-match-impact__line";
      expectedRow.textContent = `${args.t("profileMatchImpactExpectedChance")} ${formatPercent(expected)}`;

      const highExpected = expected >= 0.5;
      const outcomeKey = outcome === "win"
        ? (highExpected ? "profileMatchImpactReasonFavWin" : "profileMatchImpactReasonUnderdogWin")
        : (highExpected ? "profileMatchImpactReasonFavLoss" : "profileMatchImpactReasonUnderdogLoss");
      reason.textContent = args.t(outcomeKey);
      globalGroup.append(expectedRow);
    } else {
      reason.textContent = args.t("profileMatchImpactReasonFallback");
    }

    globalGroup.append(reason);

    const seasonBreakdown = match.ratingImpact?.seasonBreakdown;
    if (seasonBreakdown && typeof seasonDelta === "number" && match.seasonId) {
      const seasonGroup = document.createElement("section");
      seasonGroup.className = [
        "profile-match-impact__group",
        "profile-match-impact__group--season",
        userWon ? "profile-match-impact__group--won" : "profile-match-impact__group--lost",
      ].join(" ");
      const seasonTitle = document.createElement("h5");
      seasonTitle.className = "profile-match-impact__group-title";
      seasonTitle.textContent = args.t("profileMatchImpactSeason");

      const seasonRow = document.createElement("p");
      seasonRow.className = "profile-match-impact__line profile-match-impact__line--primary";
      seasonRow.textContent =
        `${args.t("profileMatchImpactSeasonScoreSimple")} ${seasonBreakdown.scoreBefore} -> ${seasonBreakdown.scoreAfter} (${formatSignedDelta(seasonDelta)})`;

      const seasonExpectedRow = document.createElement("p");
      seasonExpectedRow.className = "profile-match-impact__line";
      seasonExpectedRow.textContent = `${args.t("profileMatchImpactSeasonExpectedChance")} ${formatPercent(seasonBreakdown.expectedWinProbability)}`;

      const seasonGap = match.ratingImpact?.seasonGap;
      const seasonGapRow = typeof seasonGap === "number"
        ? (() => {
            const row = document.createElement("p");
            row.className = "profile-match-impact__line";
            row.textContent = `${args.t("profileMatchImpactSeasonGapSimple")} ${args.t("profileMatchImpactGapYou")} ${formatSignedDelta(seasonGap)}`;
            return row;
          })()
        : null;

      const seasonReason = document.createElement("p");
      seasonReason.className = "profile-match-impact__source";
      const seasonOutcome = match.ratingImpact?.outcome;
      if (seasonOutcome) {
        const highSeasonExpected = seasonBreakdown.expectedWinProbability >= 0.5;
        const seasonOutcomeKey = seasonOutcome === "win"
          ? (highSeasonExpected ? "profileMatchImpactReasonFavWin" : "profileMatchImpactReasonUnderdogWin")
          : (highSeasonExpected ? "profileMatchImpactReasonFavLoss" : "profileMatchImpactReasonUnderdogLoss");
        seasonReason.textContent = args.t(seasonOutcomeKey);
      } else {
        seasonReason.textContent = args.t("profileMatchImpactReasonFallback");
      }

      const hasAttendancePenalty = seasonBreakdown.attendancePenaltyBefore > 0 || seasonBreakdown.attendancePenaltyAfter > 0;
      if (hasAttendancePenalty) {
        const penaltyDelta = seasonBreakdown.attendancePenaltyAfter - seasonBreakdown.attendancePenaltyBefore;
        const penaltyRow = document.createElement("p");
        penaltyRow.className = "profile-match-impact__line";
        penaltyRow.textContent = `${args.t("profileMatchImpactSeasonPenaltySimple")} ${seasonBreakdown.attendancePenaltyBefore} -> ${seasonBreakdown.attendancePenaltyAfter} (${formatSignedDelta(penaltyDelta)})`;
        const formulaRow = document.createElement("p");
        formulaRow.className = "profile-match-impact__line";
        formulaRow.textContent =
          `${args.t("profileMatchImpactSeasonFormulaSimple")} ${seasonBreakdown.conservativeBefore} - ${seasonBreakdown.attendancePenaltyBefore} = ${seasonBreakdown.scoreBefore} -> ` +
          `${seasonBreakdown.conservativeAfter} - ${seasonBreakdown.attendancePenaltyAfter} = ${seasonBreakdown.scoreAfter}`;
        seasonGroup.append(penaltyRow, formulaRow);
      }

      seasonGroup.append(
        seasonTitle,
        seasonRow,
        seasonExpectedRow,
        ...(seasonGapRow ? [seasonGapRow] : []),
        seasonReason,
      );
      impactBody.append(weightLine, globalGroup, seasonGroup);
    } else {
      impactBody.append(weightLine, globalGroup);
    }
    impact.append(impactSummary, impactBody);

    header.append(players, score);
    card.append(header, meta, date, impact);
    return card;
  });

  args.matchesList.replaceChildren(...matchNodes);
  args.loadMoreButton.hidden = !args.dashboardState.profileMatchesCursor;
  args.loadMoreButton.disabled = args.dashboardState.profileMatchesLoading;
};
