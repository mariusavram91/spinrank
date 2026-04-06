import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetUserProgress } from "../../../worker/src/actions/getUserProgress";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { UserRow } from "../../../worker/src/types";

describe("worker integration: getUserProgress", () => {
  it("returns a fallback progress point when the user has no visible matches", async () => {
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
        .first<UserRow>();

      if (!alice) {
        throw new Error("Alice missing");
      }

      const response = await handleGetUserProgress(
        {
          action: "getUserProgress",
          requestId: "req_user_progress_empty",
          payload: {},
        },
        alice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data).toMatchObject({
        currentRank: 1,
        bestRank: 1,
        currentElo: 1200,
        bestElo: 1200,
        currentStreak: 0,
        bestStreak: 0,
        wins: 0,
        losses: 0,
      });
      expect(response.data?.points).toHaveLength(1);
      expect(response.data?.points[0]).toMatchObject({
        elo: 1200,
        delta: 0,
        rank: 1,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("derives progress deltas, streaks, and best elo from the user's match history", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<UserRow>();
      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();

      if (!alice || !bob) {
        throw new Error("Required users missing");
      }

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_bob_win",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_bob_loss",
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

      const refreshedBob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<UserRow>();
      if (!refreshedBob) {
        throw new Error("Bob missing after matches");
      }

      const bobProgress = await handleGetUserProgress(
        {
          action: "getUserProgress",
          requestId: "req_user_progress_bob",
          payload: {},
        },
        refreshedBob,
        context.env,
      );

      expect(bobProgress.ok).toBe(true);
      expect(bobProgress.data).toMatchObject({
        bestElo: 1220,
        currentStreak: -1,
        bestStreak: 1,
        wins: 1,
        losses: 1,
      });
      expect(bobProgress.data?.currentElo).toBe(Number(refreshedBob.global_elo));
      expect(bobProgress.data?.points).toEqual([
        expect.objectContaining({
          playedAt: "2026-04-05T09:00:00.000Z",
          elo: 1220,
          delta: 20,
          rank: null,
        }),
        expect.objectContaining({
          playedAt: "2026-04-05T10:00:00.000Z",
          elo: 1199,
          delta: -21,
          rank: null,
        }),
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
