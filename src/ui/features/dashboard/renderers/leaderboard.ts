import type { DashboardState, SegmentMode } from "../../../shared/types/app";
import type { TextKey } from "../../../shared/i18n/translations";
import { setAvatarImage } from "../../../shared/utils/avatar";

type TranslationFn = (key: TextKey) => string;

const renderStreak = (streak: number, t: TranslationFn): string => {
  if (streak > 0) {
    return `W${streak}`;
  }
  if (streak < 0) {
    return `L${Math.abs(streak)}`;
  }
  return t("streakEven");
};

const getBestVisibleStreak = (players: DashboardState["leaderboard"]): number =>
  players.reduce((max, player) => Math.max(max, player.streak), 0);

const getLeaderboardEmptyText = (scope: SegmentMode, t: TranslationFn): string => {
  if (scope === "season") {
    return t("leaderboardEmptySeason");
  }
  if (scope === "tournament") {
    return t("leaderboardEmptyTournament");
  }
  return t("leaderboardEmptyGlobal");
};

const getTournamentPlacementText = (entry: DashboardState["leaderboard"][number], t: TranslationFn): string | null => {
  if (entry.placementLabelKey) {
    const base = t(entry.placementLabelKey);
    if (entry.placementLabelKey === "leaderboardPlacementRoundOf") {
      const count = entry.placementLabelCount ?? 0;
      return base.replace("{count}", String(count));
    }
    return base;
  }

  return entry.placementLabel ?? null;
};

export type LeaderboardRenderer = {
  markDirty: () => void;
  render: () => void;
};

export const createLeaderboardRenderer = (args: {
  dashboardState: DashboardState;
  leaderboardList: HTMLElement;
  getCurrentUserId: () => string;
  t: TranslationFn;
  avatarBaseUrl: string;
}): LeaderboardRenderer => {
  let needsUpdate = true;

  const buildEmptyState = (): HTMLParagraphElement => {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = getLeaderboardEmptyText(args.dashboardState.segmentMode, args.t);
    return empty;
  };

  const rebuildLeaderboard = (): void => {
    const leaderboard = args.dashboardState.leaderboard;
    if (leaderboard.length === 0) {
      args.leaderboardList.replaceChildren(buildEmptyState());
      return;
    }

    const bestVisibleStreak = getBestVisibleStreak(leaderboard);
    const currentUserId = args.getCurrentUserId();
    const rows = leaderboard.slice(0, 20).map((entry) => {
      const row = document.createElement("article");
      row.className = [
        "leaderboard-row",
        entry.streak > 0 && entry.streak === bestVisibleStreak ? "leaderboard-row--hot-streak" : "",
        entry.userId === currentUserId ? "leaderboard-row--self" : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (entry.rank <= 3) {
        row.dataset.rankTier = String(entry.rank);
      }

      const avatar = document.createElement("img");
      avatar.className = "player-avatar player-avatar-small leaderboard-row__avatar";
      setAvatarImage(
        avatar,
        entry.userId,
        entry.avatarUrl,
        `${args.avatarBaseUrl}assets/logo.png`,
        `${entry.displayName} avatar`,
      );

      const summary = document.createElement("div");
      summary.className = "leaderboard-summary";

      const identityLine = document.createElement("div");
      identityLine.className = "leaderboard-row__identity-line";

      const identity = document.createElement("span");
      identity.className = "leaderboard-identity";
      identity.textContent = `#${entry.rank} ${entry.displayName}`;

      identityLine.append(avatar, identity);

      if (entry.userId === currentUserId) {
        const youChip = document.createElement("span");
        youChip.className = "leaderboard-you-chip";
        youChip.textContent = "You";
        identityLine.append(youChip);
      }

      const record = document.createElement("span");
      record.className = "leaderboard-row__record";
      record.textContent = `${args.t("leaderboardWins")} ${entry.wins} • ${args.t("leaderboardLosses")} ${entry.losses}`;

      const streak = document.createElement("span");
      streak.className = "leaderboard-row__streak";
      streak.textContent = `${args.t("leaderboardStreak")} ${renderStreak(entry.streak, args.t)}`;

      if (entry.streak > 0 && entry.streak === bestVisibleStreak) {
        const fire = document.createElement("span");
        fire.className = "leaderboard-fire";
        fire.textContent = "🔥";
        fire.setAttribute("aria-label", `Best streak: ${entry.streak}`);
        fire.title = `Best streak: ${entry.streak}`;
        streak.append(" ", fire);
      }

      const ratingValue = entry.seasonScore ?? entry.elo;
      const ratingLabel = entry.seasonScore !== undefined ? args.t("leaderboardSeasonScore") : "Elo";
      const rating = document.createElement("span");
      rating.className = "leaderboard-elo";
      rating.textContent = `(${ratingValue} ${ratingLabel})`;

      const placementText = args.dashboardState.segmentMode === "tournament" ? getTournamentPlacementText(entry, args.t) : null;
      const placement = placementText ? document.createElement("span") : null;
      if (placement) {
        placement.className = "leaderboard-placement";
        placement.textContent = placementText;
      }

      const metaRow = document.createElement("div");
      metaRow.className = "leaderboard-row__meta-row";
      metaRow.append(record, streak);
      if (placement) {
        metaRow.append(placement);
      }
      if (args.dashboardState.segmentMode !== "tournament") {
        metaRow.append(rating);
      }

      summary.append(identityLine, metaRow);
      row.append(summary);
      return row;
    });

    args.leaderboardList.replaceChildren(...rows);
  };

  return {
    markDirty: () => {
      needsUpdate = true;
    },
    render: () => {
      if (!needsUpdate) {
        return;
      }
      needsUpdate = false;
      rebuildLeaderboard();
    },
  };
};
