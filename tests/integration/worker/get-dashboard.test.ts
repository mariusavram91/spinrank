import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: getDashboard", () => {
  it("returns composed season, leaderboard, match, and progress data from persisted state", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const alice = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<any>();

      await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_season",
          payload: {
            name: "April Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 5 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: "season_uuid_1",
          },
        },
        alice,
        context.env,
      );
      const matchId = matchResponse.data?.match.id;

      const refreshedAlice = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<any>();

      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard",
          payload: { matchesLimit: 4, matchesFilter: "recent" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.seasons).toEqual([
        expect.objectContaining({
          id: "season_uuid_1",
          name: "April Season",
        }),
      ]);
      expect(response.data?.matches).toEqual([
        expect.objectContaining({
          id: matchId,
          winnerTeam: "A",
          seasonId: "season_uuid_1",
        }),
      ]);
      expect(response.data?.leaderboard[0]).toMatchObject({
        userId: "user_a",
        elo: 1220,
        rank: 1,
      });
      expect(response.data?.userProgress).toMatchObject({
        currentRank: 1,
        currentElo: 1220,
        wins: 1,
        losses: 0,
      });
      expect(response.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  });
});
