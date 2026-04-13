import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleDeactivateMatch } from "../../../worker/src/actions/deactivateMatch";
import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { getAchievementOverview, processPendingAchievementJobs } from "../../../worker/src/services/achievements";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { UserRow } from "../../../worker/src/types";

describe("worker integration: achievements", () => {
  it("keeps achievement overview reads side-effect free for time-based milestones", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Zara" });

      await context.env.DB.prepare(
        `
          UPDATE users
          SET created_at = '2025-01-01T00:00:00.000Z'
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .run();

      const beforeReadRows = await context.env.DB.prepare(
        `
          SELECT achievement_key
          FROM user_achievements
          WHERE user_id = ?1
            AND achievement_key IN ('days_30', 'days_180', 'days_365')
          ORDER BY achievement_key ASC
        `,
      )
        .bind("user_a")
        .all<{ achievement_key: string }>();

      expect(beforeReadRows.results).toEqual([]);

      const overview = await getAchievementOverview(context.env, "user_a");
      expect(overview.totalAvailable).toBe(76);
      expect(overview.items.filter((item) => item.key.startsWith("days_"))).toEqual([
        expect.objectContaining({
          key: "days_30",
          unlockedAt: "2025-01-31T00:00:00.000Z",
          progressValue: 30,
          progressTarget: 30,
        }),
        expect.objectContaining({
          key: "days_180",
          unlockedAt: "2025-06-30T00:00:00.000Z",
          progressValue: 180,
          progressTarget: 180,
        }),
        expect.objectContaining({
          key: "days_365",
          unlockedAt: "2026-01-01T00:00:00.000Z",
          progressValue: 365,
          progressTarget: 365,
        }),
      ]);

      const afterReadRows = await context.env.DB.prepare(
        `
          SELECT achievement_key
          FROM user_achievements
          WHERE user_id = ?1
            AND achievement_key IN ('days_30', 'days_180', 'days_365')
          ORDER BY achievement_key ASC
        `,
      )
        .bind("user_a")
        .all<{ achievement_key: string }>();

      expect(afterReadRows.results).toEqual([]);
    } finally {
      await context.cleanup();
    }
  });

  it("includes unlocked achievements in the dashboard and keeps them after deleting a match", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Zara" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const userA = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!userA) {
        throw new Error("Missing user_a");
      }

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_achievement_match",
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
        userA,
        context.env,
      );
      await processPendingAchievementJobs(context.env, 10);

      const refreshedUserA = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!refreshedUserA || !matchResponse.data?.match.id) {
        throw new Error("Expected persisted match and user.");
      }

      const dashboardBeforeDelete = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_before_delete",
          payload: { matchesLimit: 4, matchesFilter: "mine" },
        },
        refreshedUserA,
        context.env,
      );

      expect(dashboardBeforeDelete.ok).toBe(true);
      expect(dashboardBeforeDelete.data?.achievements.totalUnlocked).toBeGreaterThanOrEqual(3);
      expect(dashboardBeforeDelete.data?.achievements.score).toBeGreaterThan(0);
      expect(dashboardBeforeDelete.data?.achievements.items).toHaveLength(76);
      expect(dashboardBeforeDelete.data?.achievements.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "first_match", unlockedAt: expect.any(String) }),
          expect.objectContaining({ key: "first_win", unlockedAt: expect.any(String) }),
        ]),
      );

      await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_delete_achievement_match",
          payload: { id: matchResponse.data.match.id },
        },
        refreshedUserA,
        context.env,
      );

      const afterDeleteUserA = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!afterDeleteUserA) {
        throw new Error("Missing user_a after deletion");
      }

      const dashboardAfterDelete = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_after_delete",
          payload: { matchesLimit: 4, matchesFilter: "mine" },
        },
        afterDeleteUserA,
        context.env,
      );

      expect(dashboardAfterDelete.ok).toBe(true);
      expect(dashboardAfterDelete.data?.achievements.totalUnlocked).toBeGreaterThanOrEqual(3);
      expect(dashboardAfterDelete.data?.achievements.items).toHaveLength(76);
      expect(dashboardAfterDelete.data?.achievements.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "first_match", unlockedAt: expect.any(String) }),
          expect.objectContaining({ key: "first_win", unlockedAt: expect.any(String) }),
        ]),
      );
      const persistedUnlocks = await context.env.DB.prepare(
        `
          SELECT achievement_key, unlocked_at
          FROM user_achievements
          WHERE user_id = ?1
            AND achievement_key IN ('rank_1', 'first_win')
          ORDER BY achievement_key ASC
        `,
      )
        .bind("user_a")
        .all<{ achievement_key: string; unlocked_at: string | null }>();

      expect(persistedUnlocks.results).toEqual([
        expect.objectContaining({ achievement_key: "first_win", unlocked_at: expect.any(String) }),
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
