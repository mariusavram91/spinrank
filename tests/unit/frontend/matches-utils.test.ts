import type { LeaderboardEntry, MatchRecord } from "../../../src/api/contract";
import {
  buildFairMatchSuggestion,
  buildUniquePlayerList,
  findPlayer,
  renderMatchScore,
  renderPlayerNames,
} from "../../../src/ui/features/matches/utils";

type LeaderboardEntryInput = Omit<LeaderboardEntry, "avatarUrl" | "placementLabel" | "placementLabelKey" | "placementLabelCount">;

const createPlayer = (overrides: Partial<LeaderboardEntryInput> & { userId: string }): LeaderboardEntry => ({
  userId: overrides.userId,
  displayName: overrides.displayName ?? `Player ${overrides.userId}`,
  avatarUrl: null,
  elo: overrides.elo ?? 1200,
  wins: overrides.wins ?? 0,
  losses: overrides.losses ?? 0,
  streak: overrides.streak ?? 0,
  rank: overrides.rank ?? 1,
});

describe("match helpers", () => {
  it("renders the match score", () => {
    const match = {
      score: [
        { teamA: 6, teamB: 3 },
        { teamA: 6, teamB: 4 },
      ],
    } as MatchRecord;

    expect(renderMatchScore(match)).toBe("6 - 3 • 6 - 4");
  });

  it("filters duplicate and empty player ids", () => {
    expect(buildUniquePlayerList(["a", "", "b", "a", "c"]).sort()).toEqual(["a", "b", "c"]);
  });

  it("renders player names with fallbacks", () => {
    const players = [createPlayer({ userId: "p1", displayName: "Ada" }), createPlayer({ userId: "p2", displayName: "Ben" })];

    expect(renderPlayerNames(["p1", "unknown", "p2"], players)).toBe("Ada / unknown / Ben");
  });

  it("finds players by id", () => {
    const players = [createPlayer({ userId: "p1" })];

    expect(findPlayer("p1", players)).toBe(players[0]);
    expect(findPlayer("missing", players)).toBeNull();
  });

  it("builds a singles suggestion when another player exists", () => {
    const session = createPlayer({ userId: "self", elo: 1500, wins: 5, losses: 0 });
    const opponent = createPlayer({ userId: "opponent", elo: 1400, wins: 3, losses: 1 });
    const suggestion = buildFairMatchSuggestion([session, opponent], "self", "singles");

    expect(suggestion).toEqual({
      teamAPlayerIds: ["self"],
      teamBPlayerIds: ["opponent"],
      fairnessScore: expect.any(Number),
    });
  });

  it("returns null when the session player is missing", () => {
    const suggestion = buildFairMatchSuggestion([], "self", "singles");

    expect(suggestion).toBeNull();
  });

  it("returns null for doubles with insufficient players", () => {
    const session = createPlayer({ userId: "self" });
    const suggestion = buildFairMatchSuggestion([session], "self", "doubles");

    expect(suggestion).toBeNull();
  });

  it("returns a doubles suggestion that includes the session player", () => {
    const players = [
      createPlayer({ userId: "self", elo: 1500, wins: 6, losses: 2 }),
      createPlayer({ userId: "mate", elo: 1480, wins: 5, losses: 3 }),
      createPlayer({ userId: "opponent1", elo: 1300, wins: 1, losses: 5 }),
      createPlayer({ userId: "opponent2", elo: 1320, wins: 2, losses: 3 }),
      createPlayer({ userId: "opponent3", elo: 1280, wins: 0, losses: 4 }),
    ];

    const suggestion = buildFairMatchSuggestion(players, "self", "doubles");

    expect(suggestion).not.toBeNull();
    expect(suggestion?.teamAPlayerIds).toContain("self");
    expect(suggestion?.teamAPlayerIds).toHaveLength(2);
    expect(suggestion?.teamBPlayerIds).toHaveLength(2);
    const combined = [
      ...(suggestion?.teamAPlayerIds ?? []),
      ...(suggestion?.teamBPlayerIds ?? []),
    ];
    expect(new Set(combined)).toContain("self");
  });
});
