vi.mock("../../../worker/src/services/visibility", () => ({
  canAccessTournament: vi.fn(async () => true),
  getTournamentById: vi.fn(async () => ({ id: "tournament_1" })),
}));

vi.mock("../../../worker/src/services/brackets", () => ({
  getBracketRounds: vi.fn(async () => [
    {
      title: "Final",
      matches: [
        {
          id: "tbm_final",
          leftPlayerId: "user_a",
          rightPlayerId: "user_b",
          createdMatchId: null,
          winnerPlayerId: null,
          locked: false,
          isFinal: true,
        },
      ],
    },
  ]),
  getPlanParticipantIds: vi.fn(async () => ["user_a", "user_b"]),
}));

import { handleGetTournamentBracket } from "../../../worker/src/actions/getTournamentBracket";
import type { Env, UserRow } from "../../../worker/src/types";

function createPreparedStatement(
  sql: string,
  responder: (sql: string, args: unknown[]) => Promise<unknown>,
) {
  const statement = {
    args: [] as unknown[],
    bind(...args: unknown[]) {
      this.args = args;
      return this;
    },
    async all<T>() {
      return (await responder(sql, this.args)) as T;
    },
    async first<T>() {
      return (await responder(sql, this.args)) as T;
    },
  };

  return statement;
}

describe("worker getTournamentBracket action", () => {
  it("returns the requested tournament record with sorted participant details", async () => {
    const sessionUser = {
      id: "user_a",
      provider: "google",
      provider_user_id: "google:user_a",
      email: "user_a@example.com",
      display_name: "Alice",
      avatar_url: null,
      global_elo: 1200,
      wins: 0,
      losses: 0,
      streak: 0,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-06T00:00:00.000Z",
    } as UserRow;

    const env = {
      DB: {
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM tournaments t")) {
              return {
                id: "tournament_1",
                name: "Target Cup",
                date: "2026-04-05",
                status: "active",
                season_id: null,
                season_name: null,
                created_by_user_id: "user_a",
                created_at: "2026-04-05T00:00:00.000Z",
                completed_at: null,
                participant_count: 2,
                bracket_status: "draft",
              };
            }

            return {
              results: [
                { id: "user_b", display_name: "Bob", avatar_url: null, global_elo: 1180 },
                { id: "user_a", display_name: "Alice", avatar_url: "https://example.com/a.png", global_elo: 1215 },
              ],
            };
          }),
        ),
      },
    } as unknown as Env;

    const response = await handleGetTournamentBracket(
      {
        action: "getTournamentBracket",
        requestId: "req_tournament_bracket_unit",
        payload: { tournamentId: "tournament_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      tournament: {
        id: "tournament_1",
        name: "Target Cup",
        date: "2026-04-05",
        seasonId: null,
        seasonName: null,
        status: "active",
        createdByUserId: "user_a",
        createdAt: "2026-04-05T00:00:00.000Z",
        completedAt: null,
        participantCount: 2,
        bracketStatus: "draft",
      },
      participantIds: ["user_a", "user_b"],
      participants: [
        {
          userId: "user_b",
          displayName: "Bob",
          avatarUrl: null,
          elo: 1180,
          isSuggested: true,
        },
        {
          userId: "user_a",
          displayName: "Alice",
          avatarUrl: "https://example.com/a.png",
          elo: 1215,
          isSuggested: true,
        },
      ],
      rounds: [
        {
          title: "Final",
          matches: [
            {
              id: "tbm_final",
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
    });
  });
});
