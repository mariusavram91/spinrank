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

const getPodiumMedal = (rank: number): string | null => {
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

const getBracketMatchState = (match: {
  createdMatchId: string | null;
  winnerPlayerId: string | null;
}): "pending" | "played" | "completed" => {
  if (match.winnerPlayerId) {
    return "completed";
  }
  if (match.createdMatchId) {
    return "played";
  }
  return "pending";
};

const getBracketPlayerName = (
  playerId: string | null,
  players: DashboardState["players"],
): string | null => {
  if (!playerId) {
    return null;
  }
  return players.find((player) => player.userId === playerId)?.displayName ?? null;
};

const getBracketPlaceholder = (
  rounds: DashboardState["tournamentBracket"],
  roundIndex: number,
  matchIndex: number,
  side: "left" | "right",
): string => {
  if (roundIndex === 0) {
    return "Waiting for player";
  }

  const previousRound = rounds[roundIndex - 1];
  const sourceMatchIndex = matchIndex * 2 + (side === "left" ? 0 : 1);
  const sourceTitle = previousRound?.title || `Round ${roundIndex}`;

  return `Winner of ${sourceTitle} ${sourceMatchIndex + 1}`;
};

const createBracketPlayerNode = (args: {
  playerId: string | null;
  label: string;
  players: DashboardState["players"];
  currentUserId: string;
  avatarBaseUrl: string;
  state: "winner" | "loser" | "neutral";
  showTrophy?: boolean;
}): HTMLElement => {
  const player = args.playerId ? args.players.find((entry) => entry.userId === args.playerId) : undefined;
  const row = document.createElement("div");
  row.className = [
    "leaderboard-bracket__player",
    args.playerId === args.currentUserId ? "leaderboard-bracket__player--self" : "",
    args.state === "winner" ? "leaderboard-bracket__player--winner" : "",
    args.state === "loser" ? "leaderboard-bracket__player--loser" : "",
    args.state === "neutral" ? "leaderboard-bracket__player--neutral" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const avatar = document.createElement("img");
  avatar.className = "player-avatar leaderboard-bracket__avatar";
  setAvatarImage(
    avatar,
    player?.userId,
    player?.avatarUrl,
    `${args.avatarBaseUrl}assets/logo.png`,
    args.label,
  );

  const nameBlock = document.createElement("div");
  nameBlock.className = "leaderboard-bracket__name-block";

  const name = document.createElement("span");
  name.className = "leaderboard-bracket__player-name";
  name.textContent = args.label;

  const meta = document.createElement("span");
  meta.className = "leaderboard-bracket__player-meta";
  meta.textContent = player ? `• Elo ${player.elo}` : "";

  nameBlock.append(name, meta);

  if (args.showTrophy) {
    const trophy = document.createElement("span");
    trophy.className = "leaderboard-bracket__trophy";
    trophy.textContent = "🏆";
    trophy.title = "Tournament winner";
    trophy.setAttribute("aria-label", "Tournament winner");
    nameBlock.append(trophy);
  }

  if (args.playerId === args.currentUserId) {
    const youChip = document.createElement("span");
    youChip.className = "leaderboard-you-chip leaderboard-bracket__you";
    youChip.textContent = "You";
    nameBlock.append(youChip);
  }

  row.append(avatar, nameBlock);
  return row;
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
    const isTournamentMode = args.dashboardState.segmentMode === "tournament";
    const leaderboard = args.dashboardState.leaderboard;
    if (isTournamentMode) {
      const rounds = args.dashboardState.tournamentBracket;
      if (rounds.length === 0) {
        args.leaderboardList.replaceChildren(buildEmptyState());
        return;
      }

      const currentUserId = args.getCurrentUserId();
      const bracket = document.createElement("div");
      bracket.className = "leaderboard-bracket bracket-board";

      rounds.forEach((round, roundIndex) => {
        const roundNode = document.createElement("section");
        roundNode.className = "leaderboard-bracket__round bracket-round";

        const title = document.createElement("h4");
        title.className = "leaderboard-bracket__round-title card-title";
        title.textContent = round.title;
        roundNode.append(title);

        const matches = document.createElement("div");
        matches.className = "leaderboard-bracket__matches";

        round.matches.forEach((match, matchIndex) => {
          const state = getBracketMatchState(match);
          const isBye = Boolean(match.leftPlayerId) !== Boolean(match.rightPlayerId);
          const hasAutoAdvance = roundIndex === 0 && isBye;

          const card = document.createElement("article");
          card.className = [
            "leaderboard-bracket__match",
            "bracket-match",
            `leaderboard-bracket__match--${state}`,
            isBye ? "leaderboard-bracket__match--bye" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const statusChip = document.createElement("span");
          statusChip.className = [
            "leaderboard-bracket__status-chip",
            `leaderboard-bracket__status-chip--${hasAutoAdvance ? "bye" : state}`,
          ].join(" ");
          statusChip.textContent = hasAutoAdvance
            ? "Auto advance"
            : state === "completed"
              ? "Completed"
              : state === "played"
                ? "Played"
                : "Pending";

          const statusRow = document.createElement("div");
          statusRow.className = "leaderboard-bracket__match-status-row";
          statusRow.append(statusChip);
          card.append(statusRow);

          const body = document.createElement("div");
          body.className = "leaderboard-bracket__match-body";

          const previousRound = rounds[roundIndex - 1];
          const previousLeftMatch = previousRound?.matches[matchIndex * 2];
          const previousRightMatch = previousRound?.matches[matchIndex * 2 + 1];
          const canRevealLeft = roundIndex === 0 || Boolean(previousLeftMatch?.winnerPlayerId);
          const canRevealRight = roundIndex === 0 || Boolean(previousRightMatch?.winnerPlayerId);

          const leftPlaceholder = getBracketPlaceholder(rounds, roundIndex, matchIndex, "left");
          const rightPlaceholder = getBracketPlaceholder(rounds, roundIndex, matchIndex, "right");

          const leftPlayerName = canRevealLeft
            ? match.leftPlayerId
              ? getBracketPlayerName(match.leftPlayerId, args.dashboardState.players) || "Unknown player"
              : "Waiting for player"
            : leftPlaceholder;
          const rightPlayerName = canRevealRight
            ? match.rightPlayerId
              ? getBracketPlayerName(match.rightPlayerId, args.dashboardState.players) || "Unknown player"
              : "Waiting for player"
            : rightPlaceholder;

          const leftSlotLabel = canRevealLeft ? (match.leftPlayerId ? "Player 1" : "Slot 1") : round.title || "Next match";
          const rightSlotLabel = canRevealRight ? (match.rightPlayerId ? "Player 2" : "Slot 2") : round.title || "Next match";

          const leftWin = Boolean(match.winnerPlayerId && match.leftPlayerId === match.winnerPlayerId);
          const rightWin = Boolean(match.winnerPlayerId && match.rightPlayerId === match.winnerPlayerId);

          const leftState = canRevealLeft
            ? match.winnerPlayerId
              ? leftWin
                ? "winner"
                : "loser"
              : "neutral"
            : "neutral";
          const rightState = canRevealRight
            ? match.winnerPlayerId
              ? rightWin
                ? "winner"
                : "loser"
              : "neutral"
            : "neutral";

          const leftPlayerId = canRevealLeft ? match.leftPlayerId : null;
          const rightPlayerId = canRevealRight ? match.rightPlayerId : null;

          if (hasAutoAdvance) {
            const playerId = match.leftPlayerId || match.rightPlayerId;
            const label = playerId
              ? getBracketPlayerName(playerId, args.dashboardState.players) || "Unknown player"
              : "Waiting for player";
            body.append(
              createBracketPlayerNode({
                playerId,
                label,
                players: args.dashboardState.players,
                currentUserId,
                avatarBaseUrl: args.avatarBaseUrl,
                state: match.winnerPlayerId ? "winner" : "neutral",
                showTrophy: Boolean(match.isFinal && match.winnerPlayerId),
              }),
            );
          } else {
            body.append(
              createBracketPlayerNode({
                playerId: leftPlayerId,
                label: leftPlayerName,
                players: args.dashboardState.players,
                currentUserId,
                avatarBaseUrl: args.avatarBaseUrl,
                state: leftState,
                showTrophy: Boolean(match.isFinal && leftWin),
              }),
              createBracketPlayerNode({
                playerId: rightPlayerId,
                label: rightPlayerName,
                players: args.dashboardState.players,
                currentUserId,
                avatarBaseUrl: args.avatarBaseUrl,
                state: rightState,
                showTrophy: Boolean(match.isFinal && rightWin),
              }),
            );
          }

          card.append(body);
          matches.append(card);
        });

        roundNode.append(matches);
        bracket.append(roundNode);
      });

      args.leaderboardList.replaceChildren(bracket);
      return;
    }

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

      const identityMain = document.createElement("div");
      identityMain.className = "leaderboard-row__identity-main";

      const identity = document.createElement("span");
      identity.className = "leaderboard-identity";
      identity.textContent = `#${entry.rank} ${entry.displayName}`;

      identityMain.append(avatar, identity);
      identityLine.append(identityMain);

      if (entry.userId === currentUserId) {
        const youChip = document.createElement("span");
        youChip.className = "leaderboard-you-chip";
        youChip.textContent = "You";
        identityMain.append(youChip);
      }

      if (args.dashboardState.segmentMode === "season") {
        const medal = getPodiumMedal(entry.rank);
        if (medal) {
          const medalBadge = document.createElement("span");
          medalBadge.className = "leaderboard-medal";
          medalBadge.textContent = medal;
          medalBadge.title = `Podium place ${entry.rank}`;
          medalBadge.setAttribute("aria-label", `Podium place ${entry.rank}`);
          row.append(medalBadge);
        }
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

      const metaRow = document.createElement("div");
      metaRow.className = "leaderboard-row__meta-row";
      metaRow.append(record, streak);
      metaRow.append(rating);

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
