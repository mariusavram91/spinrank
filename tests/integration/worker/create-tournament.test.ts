import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: createTournament", () => {
  it("persists the tournament, plan, and participants against the migrated schema", async () => {
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
          requestId: "req_setup_season",
          payload: {
            name: "Season League",
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
      expect(seasonId).toBeDefined();

      const rounds: TournamentBracketRound[] = [
        {
          title: "Round",
          matches: [
            {
              id: "tdm_0",
              leftPlayerId: "user_owner",
              rightPlayerId: "user_friend",
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
              rightPlayerId: null,
              createdMatchId: null,
              winnerPlayerId: null,
              locked: false,
              isFinal: true,
            },
          ],
        },
      ];

      const response = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_create_tournament",
          payload: {
            name: "Spring Cup",
            participantIds: ["user_owner", "user_friend"],
            rounds,
            seasonId,
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      const tournamentId = response.data?.tournament.id;
      expect(tournamentId).toMatch(/^tournament_uuid_/);
      expect(response.data?.tournament).toMatchObject({
        name: "Spring Cup",
        seasonId,
        status: "active",
        participantCount: 2,
        bracketStatus: "draft",
      });

      const tournamentRow = await context.env.DB.prepare(
        `
          SELECT id, name, season_id, status
          FROM tournaments
          WHERE id = ?1
        `,
      )
        .bind(tournamentId)
        .first<{ id: string; name: string; season_id: string | null; status: string }>();

      expect(tournamentRow).toMatchObject({ id: tournamentId, name: "Spring Cup", season_id: seasonId, status: "active" });

      const participants = await context.env.DB.prepare(
        `
          SELECT user_id
          FROM tournament_participants
          WHERE tournament_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind(tournamentId)
        .all<{ user_id: string }>();

      expect(participants.results.map((row) => row.user_id)).toEqual(["user_friend", "user_owner"]);

      const plan = await context.env.DB.prepare(
        `
          SELECT participant_ids_json, bracket_json
          FROM tournament_plans
          WHERE tournament_id = ?1
        `,
      )
        .bind(tournamentId)
        .first<{ participant_ids_json: string; bracket_json: string }>();

      expect(plan).toBeTruthy();
      expect(JSON.parse(plan!.participant_ids_json)).toEqual(["user_owner", "user_friend"]);
      const storedRounds: TournamentBracketRound[] = JSON.parse(plan!.bracket_json);
      expect(storedRounds).toHaveLength(2);

      const bracketMatches = await context.env.DB.prepare(
        `
          SELECT id, round_index, match_index, is_final
          FROM tournament_bracket_matches
          WHERE tournament_id = ?1
          ORDER BY round_index ASC, match_index ASC
        `,
      )
        .bind(tournamentId)
        .all<{
          id: string;
          round_index: number;
          match_index: number;
          is_final: number;
        }>();

      expect(bracketMatches.results).toHaveLength(2);
      expect(bracketMatches.results[1].is_final).toBe(1);

      const audits = await context.env.DB.prepare(
        `
          SELECT action, actor_user_id, target_id
          FROM audit_log
          WHERE target_id = ?1 AND action = 'createTournament'
        `,
      )
        .bind(tournamentId)
        .all<{ action: string; actor_user_id: string; target_id: string }>();

      expect(audits.results).toEqual([
        {
          action: "createTournament",
          actor_user_id: "user_owner",
          target_id: tournamentId,
        },
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
