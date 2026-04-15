import type { UserRow } from "../../../worker/src/types";
import {
  calculateSeasonScore,
  compareLeaderboardRows,
  computeEloDeltaForTeams,
  createBlankRatingState,
} from "../../../worker/src/services/elo";

describe("elo helpers", () => {
  it("calculates season score with penalties", () => {
    const score = calculateSeasonScore({
      rating: 1500,
      rd: 50,
      attendedWeeks: 3,
      totalWeeks: 10,
    });

    expect(score).toBe(1384);
  });

  it("orders leaderboard rows by elo, wins, losses, and name", () => {
    const highElo = { elo: 1400, wins: 5, losses: 2, displayName: "Alpha" };
    const lowElo = { elo: 1300, wins: 5, losses: 2, displayName: "Beta" };
    expect(compareLeaderboardRows(highElo, lowElo)).toBeLessThan(0);

    const sameElo = { elo: 1400, wins: 2, losses: 2, displayName: "Alpha" };
    const moreWins = { elo: 1400, wins: 5, losses: 2, displayName: "Beta" };
    expect(compareLeaderboardRows(sameElo, moreWins)).toBeGreaterThan(0);

    const fewerLosses = { elo: 1400, wins: 5, losses: 1, displayName: "Alpha" };
    const moreLosses = { elo: 1400, wins: 5, losses: 3, displayName: "Beta" };
    expect(compareLeaderboardRows(fewerLosses, moreLosses)).toBeLessThan(0);

    const alphabetical = { elo: 1400, wins: 5, losses: 2, displayName: "Ben" };
    const alphabeticalOther = { elo: 1400, wins: 5, losses: 2, displayName: "Ana" };
    expect(compareLeaderboardRows(alphabetical, alphabeticalOther)).toBeGreaterThan(0);
  });

  it("demotes players with fewer than five matches below qualified players", () => {
    const qualified = { elo: 1200, wins: 5, losses: 0, displayName: "Qualified" };
    const unqualified = { elo: 1500, wins: 4, losses: 0, displayName: "Unqualified" };
    expect(compareLeaderboardRows(qualified, unqualified)).toBeLessThan(0);
  });

  it("orders unqualified players by matches played before elo", () => {
    const moreMatches = { elo: 1210, wins: 3, losses: 1, displayName: "More Matches" };
    const fewerMatches = { elo: 1300, wins: 2, losses: 0, displayName: "Fewer Matches" };
    expect(compareLeaderboardRows(moreMatches, fewerMatches)).toBeLessThan(0);
  });

  it("computes elo deltas that balance across players", () => {
    const ratingMap: Record<string, UserRow> = {
      player_a: {
        id: "player_a",
        provider: "google",
        provider_user_id: "player_a",
        email: null,
        display_name: "Player A",
        avatar_url: null,
        locale: "en",
        global_elo: 1400,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      player_b: {
        id: "player_b",
        provider: "google",
        provider_user_id: "player_b",
        email: null,
        display_name: "Player B",
        avatar_url: null,
        locale: "en",
        global_elo: 1300,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    };

    const deltas = computeEloDeltaForTeams(
      ["player_a"],
      ["player_b"],
      ratingMap,
      "A",
      "singles",
    );

    expect(deltas.player_a).toBeGreaterThan(0);
    expect(deltas.player_b).toBeLessThan(0);
    expect(deltas.player_a + deltas.player_b).toBe(0);
    expect(deltas).toEqual({ player_a: expect.any(Number), player_b: expect.any(Number) });
    expect(deltas.player_a).toBe(14);
    expect(deltas.player_b).toBe(-14);
  });

  it("creates a blank rating state with defaults", () => {
    const state = createBlankRatingState("2026-04-05T00:00:00.000Z" as const);

    expect(state).toEqual({
      elo: 1200,
      highestElo: 1200,
      wins: 0,
      losses: 0,
      streak: 0,
      bestWinStreak: 0,
      matchesPlayed: 0,
      matchEquivalentPlayed: 0,
      lastMatchAt: "",
      updatedAt: "2026-04-05T00:00:00.000Z",
    });
  });
});
