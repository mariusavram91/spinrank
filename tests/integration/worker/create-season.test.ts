import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import type { UserRow } from "../../../worker/src/types";
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
        .first<UserRow>();

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

  it("updates an existing season in place and rewrites participant membership", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });
      await seedUser(context.env, { id: "user_new", displayName: "New Friend" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_owner")
        .first<UserRow>();

      const firstResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_first",
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

      const seasonId = firstResponse.data?.season.id;
      expect(seasonId).toBe("season_uuid_1");

      const updateResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_update",
          payload: {
            seasonId,
            name: "Spring Ladder Reloaded",
            startDate: "2026-04-02",
            endDate: "2026-05-15",
            isActive: false,
            baseEloMode: "reset_1200",
            participantIds: ["user_new"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      expect(updateResponse.ok).toBe(true);
      expect(updateResponse.data?.season).toMatchObject({
        id: seasonId,
        name: "Spring Ladder Reloaded",
        participantIds: ["user_owner", "user_new"],
        createdByUserId: "user_owner",
        baseEloMode: "reset_1200",
        isActive: false,
        isPublic: true,
      });

      const season = await context.env.DB.prepare(
        `
          SELECT name, start_date, end_date, is_active, base_elo_mode, participant_ids_json, is_public
          FROM seasons
          WHERE id = ?1
        `,
      )
        .bind(seasonId)
        .first<{
          name: string;
          start_date: string;
          end_date: string;
          is_active: number;
          base_elo_mode: string;
          participant_ids_json: string;
          is_public: number;
        }>();
      const participants = await context.env.DB.prepare(
        `
          SELECT user_id
          FROM season_participants
          WHERE season_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind(seasonId)
        .all<{ user_id: string }>();

      expect(season).toMatchObject({
        name: "Spring Ladder Reloaded",
        start_date: "2026-04-02",
        end_date: "2026-05-15",
        is_active: 0,
        base_elo_mode: "reset_1200",
        is_public: 1,
      });
      expect(JSON.parse(season!.participant_ids_json)).toEqual(["user_owner", "user_new"]);
      expect(participants.results.map((row) => row.user_id)).toEqual(["user_new", "user_owner"]);
    } finally {
      await context.cleanup();
    }
  });

  it("rejects edits by non-creators and for completed seasons", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();
      const friend = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_friend").first<UserRow>();

      const createResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_forbidden",
          payload: {
            name: "Locked Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      const seasonId = createResponse.data?.season.id;

      const forbiddenResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_non_owner",
          payload: {
            seasonId,
            name: "Hijacked",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        friend!,
        context.env,
      );

      expect(forbiddenResponse.ok).toBe(false);
      expect(forbiddenResponse.error?.code).toBe("FORBIDDEN");

      await context.env.DB.prepare(
        `
          UPDATE seasons
          SET status = 'completed', completed_at = '2026-04-20T12:00:00.000Z'
          WHERE id = ?1
        `,
      )
        .bind(seasonId)
        .run();

      const conflictResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_completed",
          payload: {
            seasonId,
            name: "Still Locked",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: false,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      expect(conflictResponse.ok).toBe(false);
      expect(conflictResponse.error?.code).toBe("CONFLICT");
    } finally {
      await context.cleanup();
    }
  });
});
