import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleGetSegmentLeaderboard } from "../../../worker/src/actions/getSegmentLeaderboard";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";

describe("worker integration: getSegmentLeaderboard", () => {
  it("ignores deleted and unrelated matches while staying within a coarse latency budget", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });
      await seedUser(context.env, { id: "user_d", displayName: "Dina" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!owner) {
        throw new Error("Owner missing");
      }

      const primarySeason = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_segment_budget_primary",
          payload: {
            name: "Primary Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b", "user_c"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const otherSeason = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_segment_budget_other",
          payload: {
            name: "Other Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_d"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const activeMatch = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_budget_active",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
            seasonId: primarySeason.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_budget_other_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_d"],
            score: [{ teamA: 11, teamB: 5 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: otherSeason.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      await context.env.DB.prepare(
        `
          UPDATE matches
          SET status = 'deleted'
          WHERE id = ?1
        `,
      )
        .bind(activeMatch.data?.match.id)
        .run();

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_budget_visible",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
            seasonId: primarySeason.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      const startedAt = performance.now();
      const response = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_segment_budget_result",
          payload: { segmentType: "season", segmentId: primarySeason.data?.season.id! },
        },
        owner,
        context.env,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(response.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(4000);
      expect(response.data?.stats.totalMatches).toBe(1);
      expect(response.data?.leaderboard.find((entry) => entry.userId === "user_a")).toMatchObject({
        wins: 1,
        losses: 0,
        streak: 1,
        bestWinStreak: 1,
      });
      expect(response.data?.leaderboard.find((entry) => entry.userId === "user_b")).toMatchObject({
        wins: 0,
        losses: 0,
      });
      expect(response.data?.leaderboard.find((entry) => entry.userId === "user_c")).toMatchObject({
        wins: 0,
        losses: 1,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("returns longest-ever win streaks separately from current streaks for season leaderboards", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!owner) {
        throw new Error("Owner missing");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_segment_best_streak_setup",
          payload: {
            name: "Season Best Streak",
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

      const seasonId = seasonResponse.data?.season.id!;

      const playedAtByIndex = [
        "2026-04-05T09:00:00.000Z",
        "2026-04-05T10:00:00.000Z",
        "2026-04-05T11:00:00.000Z",
      ] as const;

      for (const [index, winnerTeam] of (["A", "A", "B"] as const).entries()) {
        await handleCreateMatch(
          {
            action: "createMatch",
            requestId: `req_segment_best_streak_${index}`,
            payload: {
              matchType: "singles",
              formatType: "single_game",
              pointsToWin: 11,
              teamAPlayerIds: ["user_a"],
              teamBPlayerIds: ["user_b"],
              score: winnerTeam === "A" ? [{ teamA: 11, teamB: 8 }] : [{ teamA: 8, teamB: 11 }],
              winnerTeam,
              playedAt: playedAtByIndex[index]!,
              seasonId,
            },
          },
          owner,
          context.env,
        );
      }

      const response = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_segment_best_streak_result",
          payload: { segmentType: "season", segmentId: seasonId },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.leaderboard.find((entry) => entry.userId === "user_a")).toMatchObject({
        streak: -1,
        bestWinStreak: 2,
      });
    } finally {
      await context.cleanup();
    }
  });

  it(
    "returns season leaderboard stats with qualification and most-active ordering",
    async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });
      await seedUser(context.env, { id: "user_d", displayName: "Dina" });

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
        throw new Error("Owner missing");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_segment_season_setup",
          payload: {
            name: "Season Ladder",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b", "user_c", "user_d"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const seasonId = seasonResponse.data?.season.id!;

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_match_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );
      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_match_2",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );
      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_segment_match_3",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_d"],
            teamBPlayerIds: ["user_a"],
            score: [{ teamA: 9, teamB: 11 }],
            winnerTeam: "B",
            playedAt: "2026-04-05T11:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );

      const response = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_get_segment_season",
          payload: { segmentType: "season", segmentId: seasonId },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.leaderboard[0]).toMatchObject({
        userId: "user_a",
        wins: 3,
        losses: 0,
        streak: 3,
        isQualified: false,
        rank: 1,
      });
      expect(response.data?.leaderboard.find((entry) => entry.userId === "user_b")).toMatchObject({
        wins: 0,
        losses: 1,
        isQualified: false,
      });
      expect(response.data?.stats).toMatchObject({
        totalMatches: 3,
        mostMatchesPlayer: {
          userId: "user_a",
          matchesPlayed: 3,
          wins: 3,
          losses: 0,
        },
        mostWinsPlayer: {
          userId: "user_a",
          wins: 3,
          losses: 0,
        },
        tournamentWinnerPlayer: null,
      });
    } finally {
      await context.cleanup();
    }
    },
    60000,
  );

  it(
    "orders tournament leaderboard by placement and exposes winner metadata",
    async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });
      await seedUser(context.env, { id: "user_d", displayName: "Dina" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!owner) {
        throw new Error("Owner missing");
      }

      const rounds: TournamentBracketRound[] = [
        {
          title: "Semifinals",
          matches: [
            {
              id: "semi_1",
              leftPlayerId: "user_a",
              rightPlayerId: "user_b",
              createdMatchId: null,
              winnerPlayerId: null,
              locked: false,
              isFinal: false,
            },
            {
              id: "semi_2",
              leftPlayerId: "user_c",
              rightPlayerId: "user_d",
              createdMatchId: null,
              winnerPlayerId: null,
              locked: false,
              isFinal: false,
            },
          ],
        },
        {
          title: "Final",
          matches: [
            {
              id: "final_1",
              leftPlayerId: null,
              rightPlayerId: null,
              createdMatchId: null,
              winnerPlayerId: null,
              locked: false,
              isFinal: true,
            },
          ],
        },
      ];

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_tournament_segment_setup",
          payload: {
            name: "Placement Cup",
            participantIds: ["user_a", "user_b", "user_c", "user_d"],
            rounds,
          },
        },
        owner,
        context.env,
      );

      const tournamentId = tournamentResponse.data?.tournament.id!;

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_tournament_semi_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "semi_1",
          },
        },
        owner,
        context.env,
      );

      const userC = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_c").first<UserRow>();
      if (!userC) {
        throw new Error("User C missing");
      }

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_tournament_semi_2",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_c"],
            teamBPlayerIds: ["user_d"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "semi_2",
          },
        },
        userC,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_tournament_final",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "final_1",
          },
        },
        owner,
        context.env,
      );

      const response = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_get_segment_tournament",
          payload: { segmentType: "tournament", segmentId: tournamentId },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.leaderboard.map((entry) => entry.userId)).toEqual([
        "user_a",
        "user_c",
        "user_b",
        "user_d",
      ]);
      expect(response.data?.leaderboard[0]).toMatchObject({
        userId: "user_a",
        placementLabelKey: "leaderboardPlacementWinner",
        placementLabelCount: null,
        rank: 1,
      });
      expect(response.data?.leaderboard[1]).toMatchObject({
        userId: "user_c",
        placementLabelKey: "leaderboardPlacementFinal",
        placementLabelCount: null,
        rank: 2,
      });
      expect(response.data?.leaderboard[2]).toMatchObject({
        userId: "user_b",
        placementLabelKey: "leaderboardPlacementSemifinals",
        placementLabelCount: null,
      });
      expect(response.data?.stats).toMatchObject({
        totalMatches: 3,
        tournamentWinnerPlayer: {
          userId: "user_a",
          displayName: "Alice",
        },
      });
    } finally {
      await context.cleanup();
    }
    },
    60000,
  );
});
