import type { UserRow } from "../../../worker/src/types";
import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleDeactivateMatch } from "../../../worker/src/actions/deactivateMatch";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: deactivateMatch", () => {
  it("stays within a coarse latency budget while restoring ratings after deletion", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      if (!owner) {
        throw new Error("Owner not seeded");
      }

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_deactivate_match_budget_create",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      const startedAt = performance.now();
      const response = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_match_budget",
          payload: {
            id: matchResponse.data!.match.id,
            reason: "latency baseline",
          },
        },
        owner,
        context.env,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(response.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(4000);

      const users = await context.env.DB.prepare(
        `
          SELECT id, global_elo, wins, losses
          FROM users
          WHERE id IN (?1, ?2)
          ORDER BY id ASC
        `,
      )
        .bind("user_a", "user_b")
        .all<{ id: string; global_elo: number; wins: number; losses: number }>();

      expect(users.results).toEqual([
        expect.objectContaining({ id: "user_a", global_elo: 1200, wins: 0, losses: 0 }),
        expect.objectContaining({ id: "user_b", global_elo: 1200, wins: 0, losses: 0 }),
      ]);
    } finally {
      await context.cleanup();
    }
  });

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

  it("rejects missing ids, non-owners, and already deleted matches", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<UserRow>();
      if (!owner || !bob) {
        throw new Error("Users not seeded");
      }

      const missingId = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_missing_match_id",
          payload: { id: "" },
        },
        owner,
        context.env,
      );
      expect(missingId.ok).toBe(false);
      expect(missingId.error?.code).toBe("VALIDATION_ERROR");

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match_forbidden",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
          },
        },
        owner,
        context.env,
      );

      const forbidden = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_match_forbidden",
          payload: { id: matchResponse.data!.match.id },
        },
        bob,
        context.env,
      );
      expect(forbidden.ok).toBe(false);
      expect(forbidden.error?.code).toBe("FORBIDDEN");

      const firstDelete = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_match_first",
          payload: { id: matchResponse.data!.match.id },
        },
        owner,
        context.env,
      );
      expect(firstDelete.ok).toBe(true);

      const secondDelete = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_match_second",
          payload: { id: matchResponse.data!.match.id },
        },
        owner,
        context.env,
      );
      expect(secondDelete.ok).toBe(false);
      expect(secondDelete.error?.code).toBe("NOT_FOUND");
    } finally {
      await context.cleanup();
    }
  });

  it("rebuilds tournament brackets after deleting a tournament match before later rounds are played", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });
      await seedUser(context.env, { id: "user_d", displayName: "Dina" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<UserRow>();
      const userC = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_c").first<UserRow>();
      if (!owner || !userC) {
        throw new Error("Users not seeded");
      }

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_deactivate_tournament_setup",
          payload: {
            name: "Deletion Cup",
            participantIds: ["user_a", "user_b", "user_c", "user_d"],
            rounds: [
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
            ],
          },
        },
        owner,
        context.env,
      );

      const tournamentId = tournamentResponse.data!.tournament.id;
      const firstSemi = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_deactivate_tournament_match_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 7 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "semi_1",
          },
        },
        owner,
        context.env,
      );
      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_deactivate_tournament_match_2",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_c"],
            teamBPlayerIds: ["user_d"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "semi_2",
          },
        },
        userC,
        context.env,
      );

      const deleteResponse = await handleDeactivateMatch(
        {
          action: "deactivateMatch",
          requestId: "req_deactivate_tournament_match",
          payload: { id: firstSemi.data!.match.id, reason: "bad score" },
        },
        owner,
        context.env,
      );

      expect(deleteResponse.ok).toBe(true);

      const bracketRows = await context.env.DB.prepare(
        `
          SELECT id, left_player_id, right_player_id, created_match_id, winner_player_id, locked
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
          created_match_id: string | null;
          winner_player_id: string | null;
          locked: number;
        }>();

      expect(bracketRows.results[0]).toMatchObject({
        id: "semi_1",
        created_match_id: null,
        winner_player_id: null,
        locked: 0,
      });
      expect(bracketRows.results[2]).toMatchObject({
        id: "final_1",
        left_player_id: "user_a",
        right_player_id: "user_c",
      });
    } finally {
      await context.cleanup();
    }
  });
});
