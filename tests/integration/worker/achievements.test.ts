import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleDeactivateMatch } from "../../../worker/src/actions/deactivateMatch";
import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { UserRow } from "../../../worker/src/types";

describe("worker integration: achievements", () => {
  it("includes unlocked achievements in the dashboard and keeps them after deleting a match", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Zara" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const userA = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!userA) {
        throw new Error("Missing user_a");
      }

      await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_achievement_season",
          payload: {
            name: "Achievement Season",
            startDate: "2026-04-01",
            endDate: "2026-04-30",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        userA,
        context.env,
      );

      await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_achievement_tournament",
          payload: {
            name: "Achievement Tournament",
            date: "2026-04-05",
            participantIds: ["user_a", "user_b"],
            rounds: [
              {
                title: "Final",
                matches: [
                  {
                    id: "tbm_final",
                    leftPlayerId: "user_a",
                    rightPlayerId: "user_b",
                    createdMatchId: null,
                    winnerPlayerId: null,
                    locked: false,
                    isFinal: true,
                  },
                ],
              },
            ],
          },
        },
        userA,
        context.env,
      );

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
      expect(dashboardBeforeDelete.data?.achievements.totalUnlocked).toBe(6);
      expect(dashboardBeforeDelete.data?.achievements.score).toBe(520);
      expect(dashboardBeforeDelete.data?.achievements.items).toHaveLength(11);
      expect(dashboardBeforeDelete.data?.achievements.recentUnlocks).toHaveLength(3);

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
      expect(dashboardAfterDelete.data?.achievements.totalUnlocked).toBe(6);
      expect(dashboardAfterDelete.data?.achievements.items).toHaveLength(11);
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
        expect.objectContaining({ achievement_key: "rank_1", unlocked_at: expect.any(String) }),
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
