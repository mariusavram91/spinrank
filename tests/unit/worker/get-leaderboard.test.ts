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
      highest_global_elo: 1200,
      wins: 3,
      losses: 1,
      streak: 2,
      best_win_streak: 2,
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
                  highest_global_elo: 1455,
                  wins: 20,
                  losses: 2,
                  streak: 7,
                  best_win_streak: 12,
                  updated_at: "2026-04-06T12:00:00.000Z",
                  rank: 1,
                },
                {
                  id: "user_42",
                  display_name: "Ada",
                  avatar_url: null,
                  global_elo: 1200,
                  highest_global_elo: 1280,
                  wins: 3,
                  losses: 1,
                  streak: 2,
                  best_win_streak: 5,
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
        expect.objectContaining({ userId: "user_1", rank: 1, bestWinStreak: 12, highestElo: 1455 }),
        expect.objectContaining({ userId: "user_42", rank: 18, bestWinStreak: 5, highestElo: 1280 }),
      ],
      updatedAt: "2026-04-06T12:00:00.000Z",
    });
  });

  it("sorts unqualified players below qualified players in default mode", async () => {
    const sessionUser = {
      id: "user_42",
      provider: "google",
      provider_user_id: "google:user_42",
      email: "user_42@example.com",
      display_name: "Ada",
      avatar_url: null,
      global_elo: 1200,
      highest_global_elo: 1200,
      wins: 3,
      losses: 1,
      streak: 2,
      best_win_streak: 2,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-06T00:00:00.000Z",
    } as UserRow;

    const env = {
      DB: {
        prepare: vi.fn(() =>
          createPreparedStatement("", async () => ({
            results: [
              {
                id: "user_high_elo_low_matches",
                display_name: "High Elo",
                avatar_url: null,
                global_elo: 1500,
                highest_global_elo: 1510,
                wins: 4,
                losses: 0,
                streak: 4,
                best_win_streak: 9,
                updated_at: "2026-04-06T12:00:00.000Z",
              },
              {
                id: "user_qualified",
                display_name: "Qualified",
                avatar_url: null,
                global_elo: 1300,
                highest_global_elo: 1325,
                wins: 5,
                losses: 0,
                streak: 1,
                best_win_streak: 5,
                updated_at: "2026-04-06T12:00:00.000Z",
              },
              {
                id: "user_more_matches",
                display_name: "More Matches",
                avatar_url: null,
                global_elo: 1210,
                highest_global_elo: 1230,
                wins: 3,
                losses: 1,
                streak: 0,
                best_win_streak: 3,
                updated_at: "2026-04-06T12:00:00.000Z",
              },
            ],
          })),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetLeaderboard(
      {
        action: "getLeaderboard",
        requestId: "req_get_leaderboard_default",
        payload: { mode: "default" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data?.leaderboard.map((entry) => entry.userId)).toEqual([
      "user_qualified",
      "user_high_elo_low_matches",
      "user_more_matches",
    ]);
    expect(response.data?.leaderboard.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });
});
