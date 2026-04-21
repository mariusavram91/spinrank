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
            baseEloMode: "carry_over",
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
        baseEloMode: "carry_over",
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
        base_elo_mode: "carry_over",
        is_public: 1,
      });
      expect(JSON.parse(season!.participant_ids_json)).toEqual(["user_owner", "user_new"]);
      expect(participants.results.map((row) => row.user_id)).toEqual(["user_new", "user_owner"]);
    } finally {
      await context.cleanup();
    }
  });

  it("rejects attempts to change base Elo mode for existing seasons", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();

      const createResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_mode_lock_create",
          payload: {
            name: "Locked Mode Season",
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
      expect(seasonId).toBeTruthy();

      const updateResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_mode_lock_update",
          payload: {
            seasonId,
            name: "Locked Mode Season Updated",
            startDate: "2026-04-02",
            endDate: "2026-05-15",
            isActive: false,
            baseEloMode: "reset_1200",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      expect(updateResponse.ok).toBe(false);
      expect(updateResponse.error?.code).toBe("CONFLICT");
      expect(updateResponse.error?.message).toBe("The base Elo mode cannot be changed after a season is created.");

      const season = await context.env.DB.prepare(
        `
          SELECT name, start_date, end_date, is_active, base_elo_mode
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
        }>();

      expect(season).toMatchObject({
        name: "Locked Mode Season",
        start_date: "2026-04-01",
        end_date: "2026-05-01",
        is_active: 1,
        base_elo_mode: "carry_over",
      });
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

  it("rejects removing participants who already have season matches", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });
      await seedUser(context.env, { id: "user_new", displayName: "New Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();

      const createResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_remove_guard_create",
          payload: {
            name: "Removal Guard Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend", "user_new"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      const seasonId = createResponse.data?.season.id;
      expect(seasonId).toBeTruthy();

      await context.env.DB.prepare(
        `
          INSERT INTO matches (
            id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json, score_json, winner_team,
            global_elo_delta_json, segment_elo_delta_json, played_at, season_id, tournament_id, created_by_user_id, status, created_at
          ) VALUES (?1, 'singles', 'single_game', 11, ?2, ?3, ?4, 'A', '{}', '{}', ?5, ?6, NULL, ?7, 'active', ?8)
        `,
      )
        .bind(
          "match_season_removal_guard",
          JSON.stringify(["user_friend"]),
          JSON.stringify(["user_owner"]),
          JSON.stringify([{ teamA: 11, teamB: 8 }]),
          "2026-04-10T10:00:00.000Z",
          seasonId,
          "user_owner",
          "2026-04-10T10:00:00.000Z",
        )
        .run();
      await context.env.DB.prepare(
        `
          INSERT INTO match_players (match_id, user_id, team)
          VALUES (?1, ?2, ?3), (?1, ?4, ?5)
        `,
      )
        .bind("match_season_removal_guard", "user_friend", "A", "user_owner", "B")
        .run();

      const updateResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_remove_guard_update",
          payload: {
            seasonId,
            name: "Removal Guard Season Updated",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_new"],
            isPublic: true,
          },
        },
        owner!,
        context.env,
      );

      expect(updateResponse.ok).toBe(false);
      expect(updateResponse.error?.code).toBe("CONFLICT");
      expect(updateResponse.error?.message).toBe("Participants with recorded matches in this season cannot be removed.");

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

      expect(participants.results.map((row) => row.user_id)).toEqual(["user_friend", "user_new", "user_owner"]);
    } finally {
      await context.cleanup();
    }
  });
});
