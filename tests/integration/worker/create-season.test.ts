import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: createSeason", () => {
  it("persists the season, participants, and audit log against the migrated schema", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_owner")
        .first<{ id: string; display_name: string; global_elo: number; wins: number; losses: number; streak: number }>();

      const response = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season",
          payload: {
            name: "Spring Ladder",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: false,
          },
        },
        owner!,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.season).toMatchObject({
        id: "season_uuid_1",
        name: "Spring Ladder",
        participantIds: ["user_owner", "user_friend"],
        createdByUserId: "user_owner",
      });

      const season = await context.env.DB.prepare(
        `
          SELECT id, participant_ids_json, created_by_user_id, is_active
          FROM seasons
          WHERE id = ?1
        `,
      )
        .bind("season_uuid_1")
        .first<{
          id: string;
          participant_ids_json: string;
          created_by_user_id: string;
          is_active: number;
        }>();
      const participants = await context.env.DB.prepare(
        `
          SELECT user_id
          FROM season_participants
          WHERE season_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind("season_uuid_1")
        .all<{ user_id: string }>();
      const auditRows = await context.env.DB.prepare(
        `
          SELECT action, actor_user_id, target_id
          FROM audit_log
          WHERE target_id = ?1
        `,
      )
        .bind("season_uuid_1")
        .all<{ action: string; actor_user_id: string; target_id: string }>();

      expect(season).toMatchObject({
        id: "season_uuid_1",
        created_by_user_id: "user_owner",
        is_active: 1,
      });
      expect(JSON.parse(season!.participant_ids_json)).toEqual(["user_owner", "user_friend"]);
      expect(participants.results.map((row) => row.user_id)).toEqual(["user_friend", "user_owner"]);
      expect(auditRows.results).toEqual([
        {
          action: "createSeason",
          actor_user_id: "user_owner",
          target_id: "season_uuid_1",
        },
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
