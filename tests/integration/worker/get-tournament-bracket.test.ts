import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleGetTournamentBracket } from "../../../worker/src/actions/getTournamentBracket";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";

describe("worker integration: getTournamentBracket", () => {
  it("returns bracket participants so the client can resolve player labels outside the leaderboard", async () => {
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
          title: "Final",
          matches: [
            {
              id: "tdm_final",
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

      const createResponse = await handleCreateTournament(
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

      const tournamentId = createResponse.data?.tournament.id;
      expect(tournamentId).toBeDefined();

      const bracketResponse = await handleGetTournamentBracket(
        {
          action: "getTournamentBracket",
          requestId: "req_get_tournament_bracket",
          payload: { tournamentId: tournamentId! },
        },
        owner,
        context.env,
      );

      expect(bracketResponse.ok).toBe(true);
      expect(bracketResponse.data?.participants).toEqual([
        expect.objectContaining({ userId: "user_friend", displayName: "Friend", elo: 1200 }),
        expect.objectContaining({ userId: "user_owner", displayName: "Owner", elo: 1200 }),
      ]);
      expect(bracketResponse.data?.rounds).toEqual(rounds);
    } finally {
      await context.cleanup();
    }
  });
});
