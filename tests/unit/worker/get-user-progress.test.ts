import { handleGetUserProgress } from "../../../worker/src/actions/getUserProgress";
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

describe("worker getUserProgress action", () => {
  it("uses a targeted rank query and derives summary points from the persisted current elo", async () => {
    const sessionUser = {
      id: "user_a",
      provider: "google",
      provider_user_id: "google:user_a",
      email: "user_a@example.com",
      display_name: "Alice",
      avatar_url: null,
      global_elo: 1230,
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
            if (statementSql.includes("ROW_NUMBER() OVER")) {
              expect(args).toEqual(["user_a"]);
              return { rank: 4 };
            }

            expect(statementSql).toContain("LIMIT 20");
            return {
              results: [
                {
                  played_at: "2026-04-04T10:00:00.000Z",
                  global_elo_delta_json: JSON.stringify({ user_a: 12 }),
                  winner_team: "A",
                  player_team: "A",
                },
                {
                  played_at: "2026-04-05T10:00:00.000Z",
                  global_elo_delta_json: JSON.stringify({ user_a: 18 }),
                  winner_team: "A",
                  player_team: "A",
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

    const response = await handleGetUserProgress(
      {
        action: "getUserProgress",
        requestId: "req_progress_summary_unit",
        payload: { mode: "summary" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      currentRank: 4,
      currentElo: 1230,
      wins: 3,
      losses: 1,
      points: [
        { playedAt: "2026-04-04T10:00:00.000Z", elo: 1212, delta: 12 },
        { playedAt: "2026-04-05T10:00:00.000Z", elo: 1230, delta: 18 },
      ],
    });
  });
});
