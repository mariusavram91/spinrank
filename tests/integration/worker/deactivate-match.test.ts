import type { UserRow } from "../../../worker/src/types";
import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleDeactivateMatch } from "../../../worker/src/actions/deactivateMatch";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: deactivateMatch", () => {
  it("flags the match as deleted, logs the audit trail, and recomputes rankings", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<UserRow>();
      if (!owner) {
        throw new Error("Owner not seeded");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_setup_season",
          payload: {
            name: "Season Two",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const seasonId = seasonResponse.data?.season.id;
      expect(seasonId).toBeDefined();

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );

      const matchId = matchResponse.data?.match.id;
      expect(matchId).toBeDefined();

      const response = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_match",
          payload: {
            id: matchId!,
            reason: "test cleanup",
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data).toMatchObject({ id: matchId, status: "deleted" });

      const matchRow = await context.env.DB.prepare(
        `
          SELECT status, deactivated_by_user_id, deactivation_reason
          FROM matches
          WHERE id = ?1
        `,
      )
        .bind(matchId)
        .first<{ status: string; deactivated_by_user_id: string; deactivation_reason: string }>();

      expect(matchRow).toMatchObject({ status: "deleted", deactivation_reason: "test cleanup", deactivated_by_user_id: "user_a" });

      const users = await context.env.DB.prepare(
        `
          SELECT id, global_elo, wins, losses, streak
          FROM users
          WHERE id IN (?1, ?2)
          ORDER BY id ASC
        `,
      )
        .bind("user_a", "user_b")
        .all<{ id: string; global_elo: number; wins: number; losses: number; streak: number }>();

      expect(users.results).toEqual([
        expect.objectContaining({ id: "user_a", global_elo: 1200, wins: 0, losses: 0, streak: 0 }),
        expect.objectContaining({ id: "user_b", global_elo: 1200, wins: 0, losses: 0, streak: 0 }),
      ]);

      const audits = await context.env.DB.prepare(
        `
          SELECT action, actor_user_id, target_id
          FROM audit_log
          WHERE target_id = ?1 AND action = 'deactivateMatch'
        `,
      )
        .bind(matchId)
        .all<{ action: string; actor_user_id: string; target_id: string }>();

      expect(audits.results).toEqual([
        {
          action: "deactivateMatch",
          actor_user_id: "user_a",
          target_id: matchId,
        },
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
