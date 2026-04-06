import { evaluateAchievementsForTrigger, getAchievementOverview } from "../../../worker/src/services/achievements";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker unit: achievements", () => {
  it("unlocks account creation once and keeps the overview idempotent", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });

      await evaluateAchievementsForTrigger(context.env, {
        type: "bootstrap",
        userId: "user_a",
        nowIso: "2026-04-04T12:00:00.000Z",
      });
      await evaluateAchievementsForTrigger(context.env, {
        type: "bootstrap",
        userId: "user_a",
        nowIso: "2026-04-04T12:05:00.000Z",
      });

      const overview = await getAchievementOverview(context.env, "user_a");

      expect(overview.totalUnlocked).toBe(1);
      expect(overview.totalAvailable).toBe(11);
      expect(overview.score).toBe(10);
      expect(overview.items).toHaveLength(11);
      expect(overview.items[0]).toMatchObject({
        key: "account_created",
        unlockedAt: "2026-04-04T12:00:00.000Z",
      });
      expect(overview.recentUnlocks).toEqual([
        expect.objectContaining({
          key: "account_created",
          unlockedAt: "2026-04-04T12:00:00.000Z",
          titleKey: "achievement.account_created.title",
        }),
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
