import type { LeaderboardEntry } from "../../../api/contract";
import type { TournamentPlannerMatch, TournamentPlannerRound } from "../../shared/types/app";

const nextPowerOfTwo = (value: number): number => {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
};

const buildSeedOrder = (size: number): number[] => {
  if (size === 1) {
    return [1];
  }

  const previous = buildSeedOrder(size / 2);
  const result: number[] = [];

  previous.forEach((seed) => {
    result.push(seed, size + 1 - seed);
  });

  return result;
};

const createTournamentMatchId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tournament_match_${crypto.randomUUID()}`;
  }
  return `tournament_match_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const getTournamentRoundTitle = (matchCount: number): string => {
  if (matchCount === 1) {
    return "Final";
  }
  if (matchCount === 2) {
    return "Semifinals";
  }
  if (matchCount === 4) {
    return "Quarterfinals";
  }
  return `Round of ${matchCount * 2}`;
};

const getPlayerStrengthScore = (player: LeaderboardEntry): number => {
  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? player.wins / totalMatches : 0.5;
  return player.elo + winRate * 120 + Math.min(totalMatches, 20) * 2;
};

export const buildTournamentSuggestion = (
  players: LeaderboardEntry[],
  participantIds: string[],
): { firstRoundMatches: TournamentPlannerMatch[]; rounds: TournamentPlannerRound[] } | null => {
  if (participantIds.length < 2) {
    return null;
  }

  const selectedPlayers = participantIds
    .map((participantId) => players.find((player) => player.userId === participantId) || null)
    .filter((player): player is LeaderboardEntry => player !== null)
    .sort((left, right) => getPlayerStrengthScore(right) - getPlayerStrengthScore(left));

  const bracketSize = nextPowerOfTwo(selectedPlayers.length);
  const seedOrder = buildSeedOrder(bracketSize);
  const slots = seedOrder.map((seed) => selectedPlayers[seed - 1]?.userId || null);
  const firstRoundMatches: TournamentPlannerMatch[] = [];

  for (let index = 0; index < slots.length; index += 2) {
    firstRoundMatches.push({
      id: createTournamentMatchId(),
      leftPlayerId: slots[index] || null,
      rightPlayerId: slots[index + 1] || null,
    });
  }

  const rounds: TournamentPlannerRound[] = [
    {
      title: getTournamentRoundTitle(firstRoundMatches.length),
      matches: firstRoundMatches,
    },
  ];

  let currentMatchCount = firstRoundMatches.length;
  while (currentMatchCount > 1) {
    const nextMatchCount = currentMatchCount / 2;
    const matches: TournamentPlannerMatch[] = Array.from({ length: nextMatchCount }, () => ({
      id: createTournamentMatchId(),
      leftPlayerId: null,
      rightPlayerId: null,
    }));
    rounds.push({
      title: getTournamentRoundTitle(matches.length),
      matches,
    });
    currentMatchCount = nextMatchCount;
  }

  return {
    firstRoundMatches,
    rounds,
  };
};

export const applyTournamentWinnerLocally = (
  rounds: TournamentPlannerRound[],
  roundIndex: number,
  matchIndex: number,
  winnerPlayerId: string,
): TournamentPlannerRound[] =>
  rounds.map((round, currentRoundIndex) => ({
    title: round.title,
    matches: round.matches.map((match, currentMatchIndex) => {
      if (currentRoundIndex === roundIndex && currentMatchIndex === matchIndex) {
        return {
          ...match,
          winnerPlayerId,
        };
      }

      if (currentRoundIndex === roundIndex + 1 && currentMatchIndex === Math.floor(matchIndex / 2)) {
        return matchIndex % 2 === 0
          ? { ...match, leftPlayerId: winnerPlayerId }
          : { ...match, rightPlayerId: winnerPlayerId };
      }

      return match;
    }),
  }));
