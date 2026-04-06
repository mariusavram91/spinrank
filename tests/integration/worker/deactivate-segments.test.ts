import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";
import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleDeactivateSeason } from "../../../worker/src/actions/deactivateSeason";
import { handleDeactivateTournament } from "../../../worker/src/actions/deactivateTournament";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

const bracketRounds: TournamentBracketRound[] = [
  {
    title: "Final",
    matches: [
      {
        id: "bracket_final",
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

describe("worker integration: deactivate segments", () => {
  it("deletes a tournament, its matches, and writes the audit log", async () => {
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

      if (!owner) {
        throw new Error("Owner not seeded");
      }

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_create_tournament_for_delete",
          payload: {
            name: "Delete Me Cup",
            participantIds: ["user_owner", "user_friend"],
            rounds: bracketRounds,
            seasonId: null,
          },
        },
        owner,
        context.env,
      );

      const tournamentId = tournamentResponse.data?.tournament.id;
      expect(tournamentId).toBeTruthy();

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_tournament_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
            tournamentId,
            tournamentBracketMatchId: "bracket_final",
          },
        },
        owner,
        context.env,
      );

      const matchId = matchResponse.data?.match.id;
      expect(matchId).toBeTruthy();

      const response = await handleDeactivateTournament(
        {
          action: "deactivateTournament",
          requestId: "req_deactivate_tournament",
          payload: {
            id: tournamentId!,
            reason: "Tournament retired",
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data).toMatchObject({
        id: tournamentId,
        status: "deleted",
      });

      const tournamentRow = await context.env.DB.prepare(
        `
          SELECT status, completed_at
          FROM tournaments
          WHERE id = ?1
        `,
      )
        .bind(tournamentId)
        .first<{ status: string; completed_at: string | null }>();
      const matchRow = await context.env.DB.prepare(
        `
          SELECT status, deactivated_by_user_id, deactivation_reason
          FROM matches
          WHERE id = ?1
        `,
      )
        .bind(matchId)
        .first<{ status: string; deactivated_by_user_id: string; deactivation_reason: string }>();
      const auditRows = await context.env.DB.prepare(
        `
          SELECT action, actor_user_id, target_id
          FROM audit_log
          WHERE action = 'deactivateTournament' AND target_id = ?1
        `,
      )
        .bind(tournamentId)
        .all<{ action: string; actor_user_id: string; target_id: string }>();

      expect(tournamentRow).toMatchObject({
        status: "deleted",
      });
      expect(tournamentRow?.completed_at).toBeTruthy();
      expect(matchRow).toMatchObject({
        status: "deleted",
        deactivated_by_user_id: "user_owner",
        deactivation_reason: "Tournament retired",
      });
      expect(auditRows.results).toEqual([
        {
          action: "deactivateTournament",
          actor_user_id: "user_owner",
          target_id: tournamentId,
        },
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it("deletes a season, cascades to tournaments and matches, and recomputes rankings", async () => {
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

      if (!owner) {
        throw new Error("Owner not seeded");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season_for_delete",
          payload: {
            name: "Delete Me Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const seasonId = seasonResponse.data?.season.id;
      expect(seasonId).toBeTruthy();

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_create_season_tournament",
          payload: {
            name: "Season Cup",
            participantIds: ["user_owner", "user_friend"],
            rounds: bracketRounds,
            seasonId,
          },
        },
        owner,
        context.env,
      );

      const tournamentId = tournamentResponse.data?.tournament.id;
      expect(tournamentId).toBeTruthy();

      const openMatchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_season_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );
      const tournamentMatchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_create_season_tournament_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_owner"],
            teamBPlayerIds: ["user_friend"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
            seasonId,
            tournamentId,
            tournamentBracketMatchId: "bracket_final",
          },
        },
        owner,
        context.env,
      );

      const response = await handleDeactivateSeason(
        {
          action: "deactivateSeason",
          requestId: "req_deactivate_season",
          payload: {
            id: seasonId!,
            reason: "Season archived",
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data).toMatchObject({
        id: seasonId,
        status: "deleted",
      });

      const seasonRow = await context.env.DB.prepare(
        `
          SELECT status, is_active, completed_at
          FROM seasons
          WHERE id = ?1
        `,
      )
        .bind(seasonId)
        .first<{ status: string; is_active: number; completed_at: string | null }>();
      const tournamentRow = await context.env.DB.prepare(
        `
          SELECT status
          FROM tournaments
          WHERE id = ?1
        `,
      )
        .bind(tournamentId)
        .first<{ status: string }>();
      const matchRows = await context.env.DB.prepare(
        `
          SELECT id, status, deactivated_by_user_id, deactivation_reason
          FROM matches
          WHERE id IN (?1, ?2)
          ORDER BY id ASC
        `,
      )
        .bind(openMatchResponse.data?.match.id, tournamentMatchResponse.data?.match.id)
        .all<{
          id: string;
          status: string;
          deactivated_by_user_id: string;
          deactivation_reason: string;
        }>();
      const userRows = await context.env.DB.prepare(
        `
          SELECT id, global_elo, wins, losses, streak
          FROM users
          WHERE id IN (?1, ?2)
          ORDER BY id ASC
        `,
      )
        .bind("user_friend", "user_owner")
        .all<{ id: string; global_elo: number; wins: number; losses: number; streak: number }>();
      const auditRows = await context.env.DB.prepare(
        `
          SELECT action, actor_user_id, target_id
          FROM audit_log
          WHERE action = 'deactivateSeason' AND target_id = ?1
        `,
      )
        .bind(seasonId)
        .all<{ action: string; actor_user_id: string; target_id: string }>();

      expect(seasonRow).toMatchObject({
        status: "deleted",
        is_active: 0,
      });
      expect(seasonRow?.completed_at).toBeTruthy();
      expect(tournamentRow).toEqual({ status: "deleted" });
      expect(matchRows.results).toHaveLength(2);
      expect(matchRows.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "deleted",
            deactivated_by_user_id: "user_owner",
            deactivation_reason: "Season archived",
          }),
        ]),
      );
      expect(userRows.results).toEqual([
        expect.objectContaining({ id: "user_friend", global_elo: 1200, wins: 0, losses: 0, streak: 0 }),
        expect.objectContaining({ id: "user_owner", global_elo: 1200, wins: 0, losses: 0, streak: 0 }),
      ]);
      expect(auditRows.results).toEqual([
        {
          action: "deactivateSeason",
          actor_user_id: "user_owner",
          target_id: seasonId,
        },
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it("rejects missing ids, non-owners, and already deleted tournaments", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();
      const friend = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_friend").first<UserRow>();
      if (!owner || !friend) {
        throw new Error("Users not seeded");
      }

      const missingId = await handleDeactivateTournament(
        {
          action: "deactivateTournament",
          requestId: "req_missing_tournament_id",
          payload: { id: "" },
        },
        owner,
        context.env,
      );
      expect(missingId.ok).toBe(false);
      expect(missingId.error?.code).toBe("VALIDATION_ERROR");

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_delete_branch_tournament",
          payload: {
            name: "Branch Cup",
            participantIds: ["user_owner", "user_friend"],
            rounds: bracketRounds,
            seasonId: null,
          },
        },
        owner,
        context.env,
      );

      const forbidden = await handleDeactivateTournament(
        {
          action: "deactivateTournament",
          requestId: "req_forbidden_tournament_delete",
          payload: { id: tournamentResponse.data!.tournament.id },
        },
        friend,
        context.env,
      );
      expect(forbidden.ok).toBe(false);
      expect(forbidden.error?.code).toBe("FORBIDDEN");

      const firstDelete = await handleDeactivateTournament(
        {
          action: "deactivateTournament",
          requestId: "req_first_tournament_delete",
          payload: { id: tournamentResponse.data!.tournament.id },
        },
        owner,
        context.env,
      );
      expect(firstDelete.ok).toBe(true);

      const secondDelete = await handleDeactivateTournament(
        {
          action: "deactivateTournament",
          requestId: "req_second_tournament_delete",
          payload: { id: tournamentResponse.data!.tournament.id },
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

  it("rejects missing ids, non-owners, and already deleted seasons", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_owner").first<UserRow>();
      const friend = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_friend").first<UserRow>();
      if (!owner || !friend) {
        throw new Error("Users not seeded");
      }

      const missingId = await handleDeactivateSeason(
        {
          action: "deactivateSeason",
          requestId: "req_missing_season_id",
          payload: { id: "" },
        },
        owner,
        context.env,
      );
      expect(missingId.ok).toBe(false);
      expect(missingId.error?.code).toBe("VALIDATION_ERROR");

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_delete_branch_season",
          payload: {
            name: "Branch Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const forbidden = await handleDeactivateSeason(
        {
          action: "deactivateSeason",
          requestId: "req_forbidden_season_delete",
          payload: { id: seasonResponse.data!.season.id },
        },
        friend,
        context.env,
      );
      expect(forbidden.ok).toBe(false);
      expect(forbidden.error?.code).toBe("FORBIDDEN");

      const firstDelete = await handleDeactivateSeason(
        {
          action: "deactivateSeason",
          requestId: "req_first_season_delete",
          payload: { id: seasonResponse.data!.season.id },
        },
        owner,
        context.env,
      );
      expect(firstDelete.ok).toBe(true);

      const secondDelete = await handleDeactivateSeason(
        {
          action: "deactivateSeason",
          requestId: "req_second_season_delete",
          payload: { id: seasonResponse.data!.season.id },
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
});
