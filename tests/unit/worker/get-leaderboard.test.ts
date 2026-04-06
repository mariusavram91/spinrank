import { handleGetLeaderboard } from "../../../worker/src/actions/getLeaderboard";
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

describe("worker getLeaderboard action", () => {
  it("uses the dashboard preview query and keeps top-ten plus self", async () => {
    const sessionUser = {
      id: "user_42",
      provider: "google",
      provider_user_id: "google:user_42",
      email: "user_42@example.com",
      display_name: "Ada",
      avatar_url: null,
      global_elo: 1200,
      wins: 3,
      losses: 1,
      streak: 2,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-06T00:00:00.000Z",
    } as UserRow;

    const env = {
      DB: {
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql, args) => {
            expect(statementSql).toContain("ROW_NUMBER() OVER");
            expect(statementSql).toContain("WHERE rank <= 10 OR id = ?1");
            expect(args).toEqual(["user_42"]);

            return {
              results: [
                {
                  id: "user_1",
                  display_name: "Top One",
                  avatar_url: null,
                  global_elo: 1400,
                  wins: 20,
                  losses: 2,
                  streak: 7,
                  updated_at: "2026-04-06T12:00:00.000Z",
                  rank: 1,
                },
                {
                  id: "user_42",
                  display_name: "Ada",
                  avatar_url: null,
                  global_elo: 1200,
                  wins: 3,
                  losses: 1,
                  streak: 2,
                  updated_at: "2026-04-06T12:00:00.000Z",
                  rank: 18,
                },
              ],
            };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetLeaderboard(
      {
        action: "getLeaderboard",
        requestId: "req_get_leaderboard_preview",
        payload: { mode: "dashboard_preview" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      leaderboard: [
        expect.objectContaining({ userId: "user_1", rank: 1 }),
        expect.objectContaining({ userId: "user_42", rank: 18 }),
      ],
      updatedAt: "2026-04-06T12:00:00.000Z",
    });
  });
});
