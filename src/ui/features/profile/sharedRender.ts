import type {
  AchievementSummaryItem,
  GetSharedUserProfileData,
  LeaderboardEntry,
  MatchBracketContext,
  MatchRecord,
  SeasonRecord,
  SharedUserSeasonRecord,
  SharedUserTournamentRecord,
  TournamentRecord,
} from "../../../api/contract";
import type { TextKey } from "../../shared/i18n/translations";
import { setAvatarImage } from "../../shared/utils/avatar";
import { isLockedSeason, isLockedTournament } from "../app/helpers";
import { renderActivityHeatmap } from "./activityHeatmap";
import { ACHIEVEMENT_ICONS, buildAchievementChip } from "./render";

type TranslationFn = (key: TextKey) => string;

const createEmptyState = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
};

const createStatChip = (text: string): HTMLSpanElement => {
  const chip = document.createElement("span");
  chip.className = "profile-stat-chip";
  chip.textContent = text;
  return chip;
};

const resolvePlacementLabel = (
  summary: SharedUserSeasonRecord["summary"] | SharedUserTournamentRecord["summary"],
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

const renderSegmentStats = (
  summary: SharedUserSeasonRecord["summary"] | SharedUserTournamentRecord["summary"],
  t: TranslationFn,
): HTMLElement => {
  const stats = document.createElement("div");
  stats.className = "profile-segment-card__stats";

  const entries = [
    summary.rank ? `${t("progressRanked")} #${summary.rank}` : "",
    summary.seasonScore !== undefined ? `${t("leaderboardSeasonScore")} ${summary.seasonScore}` : "",
    `${t("leaderboardWins")} ${summary.wins}`,
    `${t("leaderboardLosses")} ${summary.losses}`,
    resolvePlacementLabel(summary, t) ? `${t("sharedProfileTournamentStatusLabel")} ${resolvePlacementLabel(summary, t)}` : "",
    `${t("profileParticipants")} ${summary.participantCount}`,
  ].filter(Boolean);

  entries.forEach((entry) => {
    const chip = document.createElement("span");
    chip.className = "profile-stat-chip";
    chip.textContent = entry;
    stats.append(chip);
  });

  return stats;
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

const buildSegmentCard = <T extends SharedUserSeasonRecord | SharedUserTournamentRecord>(args: {
  item: T;
  kind: "season" | "tournament";
  t: TranslationFn;
  onOpen: (id: string) => void;
}) => {
  const wrapper = document.createElement("div");
  wrapper.className = "profile-segment-card-shell";

  const card = document.createElement("button");
  card.type = "button";
  const record = args.kind === "season" ? (args.item as SharedUserSeasonRecord).season : (args.item as SharedUserTournamentRecord).tournament;
  const isLocked = args.kind === "season" ? isLockedSeason(record as SeasonRecord) : isLockedTournament(record as TournamentRecord);
  const isInactiveSeason = args.kind === "season" && !(record as SeasonRecord).isActive && !isLocked;
  card.className = [
    "profile-segment-card",
    `profile-segment-card--${args.kind}`,
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

  const title = document.createElement("span");
  title.className = "profile-segment-card__title";
  title.textContent = record.name;

  const meta = document.createElement("span");
  meta.className = "profile-segment-card__meta";
  meta.textContent =
    args.kind === "season"
      ? `${(record as SeasonRecord).startDate}${(record as SeasonRecord).endDate ? ` - ${(record as SeasonRecord).endDate}` : ""}`
      : (record as TournamentRecord).date;

  titleBlock.append(title, meta);
  top.append(titleBlock);
  card.append(top, renderSegmentStats(args.item.summary, args.t));

  if (isLocked) {
    const medal = getPodiumMedal(args.item.summary.rank);
    if (medal) {
      const overlay = document.createElement("span");
      overlay.className = "profile-segment-card__medal";
      overlay.textContent = medal;
      overlay.setAttribute("aria-hidden", "true");
      wrapper.append(overlay);
    }
  } else {
    card.addEventListener("click", () => args.onOpen(record.id));
  }

  wrapper.append(card);
  return wrapper;
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

export const renderSharedUserProfileScreen = (args: {
  sharedUserProfile: GetSharedUserProfileData | null;
  currentUserId: string;
  meta: HTMLElement;
  avatar: HTMLImageElement;
  name: HTMLElement;
  rank: HTMLElement;
  elo: HTMLElement;
  achievementsSubtitle: HTMLElement;
  achievementsSummary: HTMLElement;
  achievementsPreview: HTMLElement;
  activityHeatmap: HTMLElement;
  selectedAchievementKey: string;
  seasonsList: HTMLElement;
  tournamentsList: HTMLElement;
  matchesList: HTMLElement;
  loadMoreButton: HTMLButtonElement;
  matchesLoading: boolean;
  avatarBaseUrl: string;
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
  locale: string;
}): void => {
  const profile = args.sharedUserProfile;
  if (!profile) {
    args.meta.textContent = args.t("profileStatsLoading");
    args.name.textContent = args.t("profileStatsLoading");
    args.rank.textContent = args.t("profileStatsLoading");
    args.elo.textContent = args.t("profileStatsLoading");
    args.achievementsSubtitle.textContent = args.t("profileStatsLoading");
    args.achievementsSummary.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    args.achievementsPreview.hidden = true;
    args.achievementsPreview.replaceChildren();
    args.activityHeatmap.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    args.seasonsList.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    args.tournamentsList.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    args.matchesList.replaceChildren(createEmptyState(args.t("profileStatsLoading")));
    args.loadMoreButton.hidden = true;
    return;
  }

  args.meta.textContent = args.t("sharedProfileMeta");
  setAvatarImage(
    args.avatar,
    profile.user.userId,
    profile.user.avatarUrl,
    `${args.avatarBaseUrl}assets/logo.png`,
    `${profile.user.displayName} avatar`,
  );
  args.name.textContent = profile.user.displayName;
  args.rank.textContent = profile.user.currentRank
    ? `${args.t("sharedProfileRankLabel")} #${profile.user.currentRank}`
    : `${args.t("sharedProfileRankLabel")} ${args.t("sharedProfileUnranked")}`;
  args.elo.replaceChildren(
    createStatChip(`Elo ${profile.user.currentElo}`),
    createStatChip(`${args.t("progressBestStreak")} ${profile.user.bestWinStreak}`),
  );
  args.achievementsSubtitle.textContent = `${args.t("achievementsTotalPointsLabel")} ${profile.achievements.reduce(
    (total, item) => total + item.points,
    0,
  )}`;
  renderActivityHeatmap({
    target: args.activityHeatmap,
    data: profile.activityHeatmap,
    locale: args.locale,
    t: args.t,
  });

  const selectedAchievement =
    profile.achievements.find((item) => item.key === args.selectedAchievementKey && item.unlockedAt) ?? null;
  const achievementIcons = profile.achievements.map((item: AchievementSummaryItem) => {
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
  if (achievementIcons.length === 0) {
    args.achievementsSummary.replaceChildren(createEmptyState(args.t("achievementsEmpty")));
  } else {
    args.achievementsSummary.replaceChildren(...achievementIcons);
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

  args.seasonsList.replaceChildren(
    ...(profile.seasons.length > 0
      ? profile.seasons.map((item) =>
          buildSegmentCard({
            item,
            kind: "season",
            t: args.t,
            onOpen: args.onOpenSeason,
          }),
        )
      : [createEmptyState(args.t("sharedProfileEmptySeasons"))]),
  );

  args.tournamentsList.replaceChildren(
    ...(profile.tournaments.length > 0
      ? profile.tournaments.map((item) =>
          buildSegmentCard({
            item,
            kind: "tournament",
            t: args.t,
            onOpen: args.onOpenTournament,
          }),
        )
      : [createEmptyState(args.t("sharedProfileEmptyTournaments"))]),
  );

  args.matchesList.replaceChildren(
    ...(profile.matches.length > 0
      ? profile.matches.map((match) => {
          const card = document.createElement("article");
          const userWon =
            (match.winnerTeam === "A" && match.teamAPlayerIds.includes(profile.user.userId)) ||
            (match.winnerTeam === "B" && match.teamBPlayerIds.includes(profile.user.userId));
          card.className = ["profile-match-card", userWon ? "profile-match-card--won" : "profile-match-card--lost"].join(
            " ",
          );

          const header = document.createElement("div");
          header.className = "profile-match-card__header";

          const players = document.createElement("span");
          players.className = "profile-match-card__players";
          const left = args.renderPlayerNames(match.teamAPlayerIds, profile.players) || args.t("teamALabel");
          const right = args.renderPlayerNames(match.teamBPlayerIds, profile.players) || args.t("teamBLabel");
          players.textContent = `${left} vs ${right}`;

          const score = document.createElement("span");
          score.className = "profile-match-card__score";
          score.textContent = args.renderMatchScore(match);

          const meta = document.createElement("div");
          meta.className = "profile-match-card__meta";
          const typeChip = document.createElement("span");
          typeChip.className = "profile-badge";
          typeChip.textContent = match.matchType === "doubles" ? args.t("matchTypeDoubles") : args.t("matchTypeSingles");

          const context = document.createElement("span");
          context.textContent = renderMatchContextLabel(
            match,
            profile.seasons.map((item) => item.season),
            profile.tournaments.map((item) => item.tournament),
            profile.matchBracketContextByMatchId[match.id] || null,
            args.renderMatchContext,
          );
          meta.append(typeChip, context);

          const date = document.createElement("div");
          date.className = "profile-match-card__date";
          date.textContent = args.formatDateTime(match.playedAt);

          header.append(players, score);
          card.append(header, meta, date);
          return card;
        })
      : [createEmptyState(args.t("sharedProfileEmptyMatches"))]),
  );

  args.loadMoreButton.hidden = !profile.nextCursor;
  args.loadMoreButton.disabled = args.matchesLoading;
};
