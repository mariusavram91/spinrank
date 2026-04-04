import type { LeaderboardEntry } from "../../../src/api/contract";
import {
  applyTournamentWinnerLocally,
  buildTournamentSuggestion,
  getTournamentRoundTitle,
} from "../../../src/ui/features/tournaments/planner";

const players: LeaderboardEntry[] = [
  {
    userId: "p1",
    displayName: "Ada",
    avatarUrl: null,
    elo: 1500,
    wins: 10,
    losses: 2,
    streak: 3,
    rank: 1,
  },
  {
    userId: "p2",
    displayName: "Grace",
    avatarUrl: null,
    elo: 1450,
    wins: 8,
    losses: 4,
    streak: 1,
    rank: 2,
  },
  {
    userId: "p3",
    displayName: "Linus",
    avatarUrl: null,
    elo: 1420,
    wins: 7,
    losses: 5,
    streak: 2,
    rank: 3,
  },
  {
    userId: "p4",
    displayName: "Margaret",
    avatarUrl: null,
    elo: 1380,
    wins: 6,
    losses: 6,
    streak: 0,
    rank: 4,
  },
];

describe("tournament planner", () => {
  it("returns null when fewer than two participants are selected", () => {
    expect(buildTournamentSuggestion(players, ["p1"])).toBeNull();
  });

  it("builds seeded rounds for the selected participants", () => {
    const suggestion = buildTournamentSuggestion(players, ["p1", "p2", "p3", "p4"]);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.rounds).toHaveLength(2);
    expect(suggestion?.rounds[0].title).toBe("Semifinals");
    expect(suggestion?.rounds[1].title).toBe("Final");
    expect(suggestion?.firstRoundMatches).toHaveLength(2);
    expect(
      suggestion?.firstRoundMatches.flatMap((match) => [match.leftPlayerId, match.rightPlayerId]),
    ).toEqual(["p1", "p4", "p2", "p3"]);
  });

  it("propagates winners into the next round locally", () => {
    const suggestion = buildTournamentSuggestion(players, ["p1", "p2", "p3", "p4"]);
    const updatedRounds = applyTournamentWinnerLocally(suggestion?.rounds ?? [], 0, 1, "p2");

    expect(updatedRounds[0].matches[1].winnerPlayerId).toBe("p2");
    expect(updatedRounds[1].matches[0].rightPlayerId).toBe("p2");
  });

  it("labels round titles by match count", () => {
    expect(getTournamentRoundTitle(1)).toBe("Final");
    expect(getTournamentRoundTitle(2)).toBe("Semifinals");
    expect(getTournamentRoundTitle(4)).toBe("Quarterfinals");
    expect(getTournamentRoundTitle(8)).toBe("Round of 16");
  });
});
