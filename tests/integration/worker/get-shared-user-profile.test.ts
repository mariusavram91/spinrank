import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleGetSharedUserProfile } from "../../../worker/src/actions/getSharedUserProfile";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";

describe("worker integration: getSharedUserProfile", () => {
  it("returns only shared resources and paginates shared matches", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });
      await seedUser(context.env, { id: "user_guest", displayName: "Guest" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();
      if (!owner) {
        throw new Error("Owner not seeded");
      }

      await context.env.DB.prepare(
        `
          INSERT INTO user_achievements (
            user_id, achievement_key, unlocked_at, progress_value, progress_target, last_evaluated_at, context_json
          )
          VALUES (?1, 'first_match', '2026-04-05T08:00:00.000Z', 1, 1, '2026-04-05T08:00:00.000Z', '{}')
        `,
      )
        .bind("user_friend")
        .run();

      const sharedSeason = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_shared_season",
          payload: {
            name: "Shared Season",
            startDate: "2026-04-01",
            endDate: "2026-04-30",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: false,
          },
        },
        owner,
        context.env,
      );
      const otherSeason = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_other_season",
          payload: {
            name: "Other Season",
            startDate: "2026-04-01",
            endDate: "2026-04-30",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_guest"],
            isPublic: false,
          },
        },
        owner,
        context.env,
      );

      const rounds: TournamentBracketRound[] = [
        {
          title: "Final",
          matches: [
            {
              id: "shared_final",
              leftPlayerId: "user_owner",
              rightPlayerId: "user_friend",
              createdMatchId: null,
              winnerPlayerId: null,
              locked: false,
              isFinal: true,
            },
          ],
        },
      ];
      const sharedTournament = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_shared_tournament",
          payload: {
            name: "Shared Cup",
            participantIds: ["user_owner", "user_friend"],
            rounds,
          },
        },
        owner,
        context.env,
      );
      await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_other_tournament",
          payload: {
            name: "Other Cup",
            participantIds: ["user_owner", "user_guest"],
            rounds: [
              {
                title: "Final",
                matches: [
                  {
                    id: "other_final",
                    leftPlayerId: "user_owner",
                    rightPlayerId: "user_guest",
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
        owner,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_shared_open_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
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
          requestId: "req_shared_season_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: sharedSeason.data?.season.id,
          },
        },
        owner,
        context.env,
      );
      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_unshared_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_guest"],
            score: [{ teamA: 11, teamB: 5 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
            seasonId: otherSeason.data?.season.id,
          },
        },
        owner,
        context.env,
      );

      const firstPage = await handleGetSharedUserProfile(
        {
          action: "getSharedUserProfile",
          requestId: "req_shared_profile_page_1",
          payload: {
            userId: "user_friend",
            limit: 1,
          },
        },
        owner,
        context.env,
      );

      expect(firstPage.ok).toBe(true);
      expect(firstPage.data?.user).toMatchObject({
        userId: "user_friend",
        displayName: "Friend",
        bestWinStreak: 0,
      });
      expect(firstPage.data?.achievements.length).toBeGreaterThan(0);
      expect(firstPage.data?.achievements.every((achievement) => Boolean(achievement.unlockedAt))).toBe(true);
      expect(firstPage.data?.activityHeatmap).toMatchObject({
        totalMatches: 2,
        totalWins: 0,
        totalLosses: 2,
        activeDays: 1,
      });
      expect(firstPage.data?.activityHeatmap.days).toEqual([
        {
          date: "2026-04-05",
          matches: 2,
          wins: 0,
          losses: 2,
        },
      ]);
      expect(firstPage.data?.seasons.map((entry) => entry.season.name)).toEqual(["Shared Season"]);
      expect(firstPage.data?.tournaments.map((entry) => entry.tournament.name)).toEqual(["Shared Cup"]);
      expect(firstPage.data?.matches).toHaveLength(1);
      expect(firstPage.data?.matches[0].playedAt).toBe("2026-04-05T10:00:00.000Z");
      expect(firstPage.data?.nextCursor).toBeTruthy();
      expect(firstPage.data?.players.some((player) => player.userId === "user_friend")).toBe(true);
      expect(firstPage.data?.tournaments[0].summary.placementLabelKey).toBe("leaderboardPlacementFinal");

      const secondPage = await handleGetSharedUserProfile(
        {
          action: "getSharedUserProfile",
          requestId: "req_shared_profile_page_2",
          payload: {
            userId: "user_friend",
            limit: 1,
            cursor: firstPage.data?.nextCursor ?? undefined,
          },
        },
        owner,
        context.env,
      );

      expect(secondPage.ok).toBe(true);
      expect(secondPage.data?.matches).toHaveLength(1);
      expect(secondPage.data?.matches[0].playedAt).toBe("2026-04-05T09:00:00.000Z");
      expect(secondPage.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  });

  it("returns the persisted longest global win streak in the shared profile header", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();
      if (!owner) {
        throw new Error("Owner not seeded");
      }

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_shared_profile_streak_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_friend"],
            teamBPlayerIds: ["user_owner"],
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
          requestId: "req_shared_profile_streak_2",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_friend"],
            teamBPlayerIds: ["user_owner"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        owner,
        context.env,
      );
      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_shared_profile_streak_3",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      const response = await handleGetSharedUserProfile(
        {
          action: "getSharedUserProfile",
          requestId: "req_shared_profile_streak_result",
          payload: {
            userId: "user_friend",
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.user).toMatchObject({
        userId: "user_friend",
        currentElo: expect.any(Number),
        bestWinStreak: 2,
      });
    } finally {
      await context.cleanup();
    }
  });
});
