import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: getDashboard", () => {
  it("stays within a coarse latency budget while composing dashboard summaries", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_budget_match_a",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_budget_match_b",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const startedAt = performance.now();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_budget",
          payload: { matchesLimit: 2, matchesFilter: "recent" },
        },
        refreshedAlice,
        context.env,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(response.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(4000);
      expect(response.data?.matches).toHaveLength(2);
      expect(response.data?.leaderboard[0]).toMatchObject({ userId: "user_a", rank: 1 });
      expect(response.data?.userProgress).toMatchObject({ wins: 1, losses: 0 });
    } finally {
      await context.cleanup();
    }
  });

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

  it("respects mine filtering and match limits while keeping achievement data available", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_mine_match_a",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_mine_match_b",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_mine_only",
          payload: { matchesLimit: 1, matchesFilter: "mine" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toHaveLength(1);
      expect(response.data?.matches[0]).toMatchObject({
        winnerTeam: "A",
      });
      expect([response.data?.matches[0].teamAPlayerIds, response.data?.matches[0].teamBPlayerIds].flat()).toContain("user_a");
      expect(response.data?.achievements.items).toHaveLength(49);
      expect(response.data?.userProgress).toMatchObject({
        wins: 1,
        losses: 0,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("includes match players outside the dashboard leaderboard preview in the player directory", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_z", displayName: "Zed" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      for (let index = 0; index < 10; index += 1) {
        await seedUser(context.env, { id: `user_rank_${index}`, displayName: `Rank ${index}` });
      }

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_preview_hidden_player_match_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_z"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_hidden_match_players",
          payload: { matchesLimit: 4, matchesFilter: "all" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toHaveLength(1);
      expect(response.data?.players).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: "user_b", displayName: "Bob" }),
          expect.objectContaining({ userId: "user_z", displayName: "Zed" }),
        ]),
      );
    } finally {
      await context.cleanup();
    }
  });
});
