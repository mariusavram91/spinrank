import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: createMatch", () => {
  it("creates a match and recomputes leaderboard state against the real schema", async () => {
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

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_setup_season",
          payload: {
            name: "Season One",
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

      const seasonId = seasonResponse.data?.season.id;
      expect(seasonId).toBe("season_uuid_1");

      const response = await handleCreateMatch(
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
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId,
          },
        },
        alice,
        context.env,
      );

      expect(response.ok).toBe(true);
      const matchId = response.data?.match.id;
      expect(matchId).toMatch(/^match_uuid_\d+$/);
      expect(response.data?.match).toMatchObject({
        seasonId: "season_uuid_1",
        winnerTeam: "A",
      });

      const match = await context.env.DB.prepare(
        `
          SELECT id, global_elo_delta_json, segment_elo_delta_json, season_id, created_by_user_id
          FROM matches
          WHERE id = ?1
        `,
      )
        .bind(matchId)
        .first<{
          id: string;
          global_elo_delta_json: string;
          segment_elo_delta_json: string;
          season_id: string;
          created_by_user_id: string;
        }>();
      const users = await context.env.DB.prepare(
        `
          SELECT id, global_elo, wins, losses, streak
          FROM users
          WHERE id IN (?1, ?2)
          ORDER BY id ASC
        `,
      )
        .bind("user_a", "user_b")
        .all<{
          id: string;
          global_elo: number;
          wins: number;
          losses: number;
          streak: number;
        }>();
      const segments = await context.env.DB.prepare(
        `
          SELECT segment_type, segment_id, user_id, elo, wins, losses
          FROM elo_segments
          ORDER BY segment_type ASC, user_id ASC
        `,
      ).all<{
        segment_type: string;
        segment_id: string;
        user_id: string;
        elo: number;
        wins: number;
        losses: number;
      }>();

      const delta = JSON.parse(match!.global_elo_delta_json) as Record<string, number>;
      const segmentDelta = JSON.parse(match!.segment_elo_delta_json) as Record<string, Record<string, number>>;

      expect(match).toMatchObject({
        id: matchId,
        season_id: "season_uuid_1",
        created_by_user_id: "user_a",
      });
      expect(delta.user_a).toBeGreaterThan(0);
      expect(delta.user_b).toBeLessThan(0);
      expect(segmentDelta.season_uuid_1).toEqual({});
      expect(users.results).toEqual([
        expect.objectContaining({ id: "user_a", global_elo: 1220, wins: 1, losses: 0, streak: 1 }),
        expect.objectContaining({ id: "user_b", global_elo: 1180, wins: 0, losses: 1, streak: -1 }),
      ]);
      expect(segments.results).toEqual([
        expect.objectContaining({
          segment_type: "season",
          segment_id: "season_uuid_1",
          user_id: "user_a",
          wins: 1,
          losses: 0,
        }),
        expect.objectContaining({
          segment_type: "season",
          segment_id: "season_uuid_1",
          user_id: "user_b",
          wins: 0,
          losses: 1,
        }),
      ]);
      expect(segments.results[0]?.elo).toBeGreaterThan(1200);
      expect(segments.results[1]?.elo).toBeLessThan(1200);
    } finally {
      await context.cleanup();
    }
  });
});
