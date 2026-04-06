import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: createMatch", () => {
  it("stays within a coarse latency budget while persisting ratings and bracket-safe deltas", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_match_budget_season",
          payload: {
            name: "Budget Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b", "user_c"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_match_budget_seed",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T09:00:00.000Z",
            seasonId: seasonResponse.data?.season.id,
          },
        },
        alice,
        context.env,
      );

      const startedAt = performance.now();
      const response = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_match_budget_target",
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
        alice,
        context.env,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(response.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(4000);
      expect(response.data?.match).toMatchObject({
        seasonId: seasonResponse.data?.season.id,
        winnerTeam: "A",
      });
    } finally {
      await context.cleanup();
    }
  });

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

  it("records tournament bracket context and advances the saved bracket", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_setup_bracket_season",
          payload: {
            name: "Bracket Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b", "user_c"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_setup_bracket_tournament",
          payload: {
            name: "Bracket Cup",
            seasonId: seasonResponse.data?.season.id,
            participantIds: ["user_a", "user_b", "user_c"],
            rounds: [
              {
                title: "Semifinal",
                matches: [
                  {
                    id: "tdm_1",
                    leftPlayerId: "user_a",
                    rightPlayerId: "user_b",
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
                    id: "tdm_final",
                    leftPlayerId: null,
                    rightPlayerId: "user_c",
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
        alice,
        context.env,
      );

      const tournamentId = tournamentResponse.data?.tournament.id!;
      const response = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_tournament_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: seasonResponse.data?.season.id,
            tournamentId,
            tournamentBracketMatchId: "tdm_1",
          },
        },
        alice,
        context.env,
      );

      expect(response.ok).toBe(true);

      const bracketRows = await context.env.DB.prepare(
        `
          SELECT id, left_player_id, right_player_id, winner_player_id, created_match_id, round_title
          FROM tournament_bracket_matches
          WHERE tournament_id = ?1
          ORDER BY round_index ASC, match_index ASC
        `,
      )
        .bind(tournamentId)
        .all<{
          id: string;
          left_player_id: string | null;
          right_player_id: string | null;
          winner_player_id: string | null;
          created_match_id: string | null;
          round_title: string;
        }>();

      expect(bracketRows.results[0]).toMatchObject({
        id: "tdm_1",
        winner_player_id: "user_a",
        created_match_id: response.data?.match.id,
        round_title: "Semifinal",
      });
      expect(bracketRows.results[1]).toMatchObject({
        id: "tdm_final",
        left_player_id: "user_a",
        right_player_id: null,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("rejects tournament-season mismatches and non-participant submissions", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();

      const seasonOne = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_setup_season_one",
          payload: {
            name: "Season One",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b", "user_c"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );
      const seasonTwo = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_setup_season_two",
          payload: {
            name: "Season Two",
            startDate: "2026-06-01",
            endDate: "2026-06-30",
            isActive: false,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );
      const tournament = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_setup_tournament_conflict",
          payload: {
            name: "Mismatch Cup",
            seasonId: seasonOne.data?.season.id,
            participantIds: ["user_a", "user_b"],
            rounds: [
              {
                title: "Final",
                matches: [
                  {
                    id: "tdm_final",
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
        alice,
        context.env,
      );

      const mismatchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_match_mismatch",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: seasonTwo.data?.season.id,
            tournamentId: tournament.data?.tournament.id,
          },
        },
        alice,
        context.env,
      );

      expect(mismatchResponse.ok).toBe(false);
      expect(mismatchResponse.error?.code).toBe("VALIDATION_ERROR");

      const outsiderResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_match_outsider",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );

      expect(outsiderResponse.ok).toBe(false);
      expect(outsiderResponse.error?.code).toBe("FORBIDDEN");
    } finally {
      await context.cleanup();
    }
  });

  it("rejects duplicate players, invalid score declarations, and inaccessible or completed segments", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      if (!alice) {
        throw new Error("Alice missing");
      }

      const duplicatePlayer = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_duplicate_player",
          payload: {
            matchType: "doubles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a", "user_a"],
            teamBPlayerIds: ["user_b", "user_c"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );
      expect(duplicatePlayer.ok).toBe(false);
      expect(duplicatePlayer.error?.code).toBe("VALIDATION_ERROR");
      expect(duplicatePlayer.error?.message).toContain("same player twice");

      const mismatchedWinner = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_mismatched_winner",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "B",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );
      expect(mismatchedWinner.ok).toBe(false);
      expect(mismatchedWinner.error?.code).toBe("VALIDATION_ERROR");
      expect(mismatchedWinner.error?.message).toContain("winnerTeam does not match");

      const privateSeason = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_private_conflict_season",
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
        alice,
        context.env,
      );

      const outsider = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_c").first<any>();
      const forbiddenSeason = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_forbidden_private_season_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_c"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: privateSeason.data!.season.id,
          },
        },
        outsider,
        context.env,
      );
      expect(forbiddenSeason.ok).toBe(false);
      expect(forbiddenSeason.error?.code).toBe("FORBIDDEN");

      await context.env.DB.prepare(
        `
          UPDATE seasons
          SET status = 'completed'
          WHERE id = ?1
        `,
      )
        .bind(privateSeason.data!.season.id)
        .run();

      const completedSeason = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_completed_season_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: privateSeason.data!.season.id,
          },
        },
        alice,
        context.env,
      );
      expect(completedSeason.ok).toBe(false);
      expect(completedSeason.error?.code).toBe("CONFLICT");
    } finally {
      await context.cleanup();
    }
  });

  it("rejects players outside tournament membership and completed tournaments", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      if (!alice) {
        throw new Error("Alice missing");
      }

      const tournament = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_match_validation_tournament",
          payload: {
            name: "Validation Cup",
            participantIds: ["user_a", "user_b"],
            rounds: [
              {
                title: "Final",
                matches: [
                  {
                    id: "validation_final",
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
            seasonId: null,
          },
        },
        alice,
        context.env,
      );

      const membershipError = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_tournament_membership_error",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            tournamentId: tournament.data!.tournament.id,
          },
        },
        alice,
        context.env,
      );
      expect(membershipError.ok).toBe(false);
      expect(membershipError.error?.code).toBe("VALIDATION_ERROR");
      expect(membershipError.error?.message).toContain("selected tournament");

      await context.env.DB.prepare(
        `
          UPDATE tournaments
          SET status = 'completed'
          WHERE id = ?1
        `,
      )
        .bind(tournament.data!.tournament.id)
        .run();

      const completedTournament = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_completed_tournament_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            tournamentId: tournament.data!.tournament.id,
          },
        },
        alice,
        context.env,
      );
      expect(completedTournament.ok).toBe(false);
      expect(completedTournament.error?.code).toBe("CONFLICT");
    } finally {
      await context.cleanup();
    }
  });
});
