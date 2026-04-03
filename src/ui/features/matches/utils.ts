import type { LeaderboardEntry, MatchRecord } from "../../../api/contract";
import type { FairPlayerProfile, SuggestedMatchup } from "../../shared/types/app";

export const renderMatchScore = (match: MatchRecord): string =>
  match.score.map((game) => `${game.teamA} - ${game.teamB}`).join(" • ");

export const buildUniquePlayerList = (values: string[]): string[] => {
  const seen: string[] = [];
  values.forEach((value) => {
    if (!value) {
      return;
    }
    if (seen.includes(value)) {
      return;
    }
    seen.push(value);
  });
  return seen;
};

export const renderPlayerNames = (playerIds: string[], players: LeaderboardEntry[]): string => {
  const playersById = new Map(players.map((player) => [player.userId, player.displayName]));
  return playerIds.map((playerId) => playersById.get(playerId) || playerId).join(" / ");
};

export const findPlayer = (
  playerId: string | null,
  players: LeaderboardEntry[],
): LeaderboardEntry | null => players.find((player) => player.userId === playerId) || null;

const toFairPlayerProfile = (player: LeaderboardEntry): FairPlayerProfile => {
  const totalMatches = player.wins + player.losses;
  return {
    userId: player.userId,
    displayName: player.displayName,
    elo: player.elo,
    winRate: totalMatches > 0 ? player.wins / totalMatches : 0.5,
  };
};

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateFairnessScore = (teamA: FairPlayerProfile[], teamB: FairPlayerProfile[]): number => {
  const eloGap = Math.abs(average(teamA.map((player) => player.elo)) - average(teamB.map((player) => player.elo)));
  const winRateGap = Math.abs(
    average(teamA.map((player) => player.winRate)) - average(teamB.map((player) => player.winRate)),
  );
  return eloGap + winRateGap * 160;
};

export const buildFairMatchSuggestion = (
  players: LeaderboardEntry[],
  sessionUserId: string,
  matchType: "singles" | "doubles",
): SuggestedMatchup | null => {
  const profiles = players.map(toFairPlayerProfile);
  const sessionPlayer = profiles.find((player) => player.userId === sessionUserId);

  if (!sessionPlayer) {
    return null;
  }

  const availablePlayers = profiles.filter((player) => player.userId !== sessionUserId);

  if (matchType === "singles") {
    if (availablePlayers.length === 0) {
      return null;
    }

    let bestOpponent = availablePlayers[0];
    let bestScore = calculateFairnessScore([sessionPlayer], [bestOpponent]);

    availablePlayers.slice(1).forEach((candidate) => {
      const score = calculateFairnessScore([sessionPlayer], [candidate]);
      if (score < bestScore) {
        bestOpponent = candidate;
        bestScore = score;
      }
    });

    return {
      teamAPlayerIds: [sessionPlayer.userId],
      teamBPlayerIds: [bestOpponent.userId],
      fairnessScore: bestScore,
    };
  }

  if (availablePlayers.length < 3) {
    return null;
  }

  let bestSuggestion: SuggestedMatchup | null = null;

  for (let indexA = 0; indexA < availablePlayers.length; indexA += 1) {
    const teammate = availablePlayers[indexA];
    const remainingOpponents = availablePlayers.filter((player) => player.userId !== teammate.userId);

    for (let indexB = 0; indexB < remainingOpponents.length - 1; indexB += 1) {
      for (let indexC = indexB + 1; indexC < remainingOpponents.length; indexC += 1) {
        const teamA = [sessionPlayer, teammate];
        const teamB = [remainingOpponents[indexB], remainingOpponents[indexC]];
        const fairnessScore = calculateFairnessScore(teamA, teamB);

        if (!bestSuggestion || fairnessScore < bestSuggestion.fairnessScore) {
          bestSuggestion = {
            teamAPlayerIds: teamA.map((player) => player.userId),
            teamBPlayerIds: teamB.map((player) => player.userId),
            fairnessScore,
          };
        }
      }
    }
  }

  return bestSuggestion;
};
