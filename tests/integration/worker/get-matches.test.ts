import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetMatches } from "../../../worker/src/actions/getMatches";
import { backfillHistoricalMatchImpactSnapshots, invalidateUserMatchImpactCache } from "../../../worker/src/services/elo";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { UserRow } from "../../../worker/src/types";

describe("worker integration: getMatches", () => {
  it("paginates recent matches using the encoded cursor", async () => {
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

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match_old",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match_new",
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
        owner,
        context.env,
      );

      const firstPage = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_page_1",
          payload: {
            filter: "recent",
            limit: 1,
            includeImpact: true,
          },
        },
        owner,
        context.env,
      );

      expect(firstPage.ok).toBe(true);
      expect(firstPage.data?.matches).toHaveLength(1);
      expect(firstPage.data?.matches[0]).toMatchObject({
        playedAt: "2026-04-05T10:00:00.000Z",
        ratingImpact: {
          userId: "user_a",
        },
      });
      expect(firstPage.data?.matches[0].ratingImpact?.globalDelta).toBeGreaterThan(0);
      expect(firstPage.data?.matches[0].ratingImpact?.seasonBreakdown).toBeNull();
      expect(firstPage.data?.nextCursor).toBeTruthy();

      const secondPage = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_page_2",
          payload: {
            filter: "recent",
            limit: 1,
            cursor: firstPage.data?.nextCursor ?? undefined,
          },
        },
        owner,
        context.env,
      );

      expect(secondPage.ok).toBe(true);
      expect(secondPage.data?.matches).toHaveLength(1);
      expect(secondPage.data?.matches[0]).toMatchObject({
        playedAt: "2026-04-05T09:00:00.000Z",
      });
      expect(secondPage.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  }, 30000);

  it("returns season breakdown details for season matches when impact is requested", async () => {
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
          requestId: "req_season_for_impact",
          payload: {
            name: "Impact Season",
            startDate: "2026-04-01",
            endDate: null,
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_season_match_for_impact",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: seasonResponse.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      const response = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_impact_season",
          payload: {
            filter: "recent",
            limit: 1,
            includeImpact: true,
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toHaveLength(1);
      expect(response.data?.matches[0].ratingImpact?.seasonBreakdown).toMatchObject({
        expectedWinProbability: expect.any(Number),
        ratingBefore: expect.any(Number),
        ratingAfter: expect.any(Number),
        rdBefore: expect.any(Number),
        rdAfter: expect.any(Number),
        conservativeBefore: expect.any(Number),
        conservativeAfter: expect.any(Number),
        attendancePenaltyBefore: expect.any(Number),
        attendancePenaltyAfter: expect.any(Number),
        scoreBefore: expect.any(Number),
        scoreAfter: expect.any(Number),
      });
    } finally {
      await context.cleanup();
    }
  }, 30000);

  it("hides private season matches from users outside the season", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Charlie" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<UserRow>();
      const outsider = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_c")
        .first<UserRow>();

      if (!owner || !outsider) {
        throw new Error("Required users were not seeded");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_private_season",
          payload: {
            name: "Private Season",
            startDate: "2026-04-01",
            endDate: "2026-04-30",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: false,
          },
        },
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_private_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
            seasonId: seasonResponse.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      const response = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_outsider",
          payload: {
            filter: "all",
          },
        },
        outsider,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toEqual([]);
      expect(response.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  });

  it("supports filtering personal history by match type", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });
      await seedUser(context.env, { id: "user_d", displayName: "Dora" });

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

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match_doubles_old",
          payload: {
            matchType: "doubles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a", "user_b"],
            teamBPlayerIds: ["user_c", "user_d"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match_singles_new",
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
        owner,
        context.env,
      );

      const filtered = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_mine_doubles_only",
          payload: {
            filter: "mine",
            matchType: "doubles",
            limit: 8,
          },
        },
        owner,
        context.env,
      );

      expect(filtered.ok).toBe(true);
      expect(filtered.data?.matches).toHaveLength(1);
      expect(filtered.data?.matches[0]).toMatchObject({
        matchType: "doubles",
        playedAt: "2026-04-05T09:00:00.000Z",
      });
      expect(filtered.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  });
  it("reads persisted rating impact snapshots when present", async () => {
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

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_get_matches_persisted_impact_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      await context.env.DB.prepare(
        "UPDATE match_rating_impacts SET global_before = 4321, global_after = 4333 WHERE match_id = ?1 AND user_id = ?2",
      )
        .bind(matchResponse.data?.match.id, "user_a")
        .run();

      const response = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_get_matches_persisted_impact",
          payload: {
            filter: "recent",
            limit: 1,
            includeImpact: true,
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches[0].ratingImpact?.globalBefore).toBe(4321);
      expect(response.data?.matches[0].ratingImpact?.globalAfter).toBe(4333);
    } finally {
      await context.cleanup();
    }
  }, 30000);
  it("backfills legacy season impact snapshots with the pre-change attendance rule", async () => {
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
          requestId: "req_backfill_legacy_season",
          payload: {
            name: "Legacy Attendance Season",
            startDate: "2026-04-01",
            endDate: "2026-05-15",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_backfill_legacy_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-22T10:00:00.000Z",
            seasonId: seasonResponse.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      await context.env.DB.prepare(
        "DELETE FROM match_rating_impacts WHERE match_id = ?1",
      )
        .bind(matchResponse.data?.match.id)
        .run();
      invalidateUserMatchImpactCache();

      const processed = await backfillHistoricalMatchImpactSnapshots(context.env, 10);
      expect(processed).toBeGreaterThan(0);

      const impactRow = await context.env.DB.prepare(
        "SELECT season_breakdown_json FROM match_rating_impacts WHERE match_id = ?1 AND user_id = ?2",
      )
        .bind(matchResponse.data?.match.id, "user_a")
        .first<{ season_breakdown_json: string }>();
      const breakdown = impactRow ? JSON.parse(impactRow.season_breakdown_json) : null;

      expect(breakdown).toMatchObject({
        attendancePenaltyBefore: 24,
      });
    } finally {
      await context.cleanup();
    }
  }, 30000);
});
