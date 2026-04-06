import { handleGetTournaments } from "../../../worker/src/actions/getTournaments";
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
  };

  return statement;
}

describe("worker getTournaments action", () => {
  it("uses aggregated participant and bracket summaries without correlated subqueries", async () => {
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
          createPreparedStatement(sql, async (statementSql, args) => {
            expect(statementSql).toContain("participant_summary AS");
            expect(statementSql).toContain("bracket_summary AS");
            expect(statementSql).not.toContain("SELECT json_group_array(tp.user_id)");
            expect(statementSql).not.toContain("SELECT COUNT(*)");
            expect(statementSql).not.toContain("WHEN EXISTS (");
            expect(args).toEqual(["user_a", expect.any(String), ""]);

            return {
              results: [
                {
                  id: "tournament_1",
                  name: "Spring Cup",
                  date: "2026-04-05",
                  status: "active",
                  season_id: "season_1",
                  season_name: "Spring",
                  created_by_user_id: "user_a",
                  created_at: "2026-04-05T00:00:00.000Z",
                  completed_at: null,
                  participant_ids_json: JSON.stringify(["user_a", "user_b"]),
                  participant_count: 2,
                  bracket_status: "in_progress",
                },
              ],
            };
          }),
        ),
      },
      runtime: {
        now: () => Date.parse("2026-04-06T12:00:00.000Z"),
      },
    } as unknown as Env;

    const response = await handleGetTournaments(
      {
        action: "getTournaments",
        requestId: "req_get_tournaments_unit",
        payload: {},
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      tournaments: [
        {
          id: "tournament_1",
          name: "Spring Cup",
          date: "2026-04-05",
          seasonId: "season_1",
          seasonName: "Spring",
          status: "active",
          createdByUserId: "user_a",
          createdAt: "2026-04-05T00:00:00.000Z",
          completedAt: null,
          participantCount: 2,
          participantIds: ["user_a", "user_b"],
          bracketStatus: "in_progress",
        },
      ],
    });
  });
});
