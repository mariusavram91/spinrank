import { handleCreateMatchDispute } from "../../../worker/src/actions/createMatchDispute";
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
    async run() {
      return (await responder(sql, this.args)) as { success: true };
    },
  };

  return statement;
}

describe("worker createMatchDispute action", () => {
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

  it("rejects self-disputes by the match creator", async () => {
    const env = {
      DB: {
        batch: vi.fn(async () => []),
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM matches")) {
              return {
                id: "match_1",
                status: "active",
                created_by_user_id: "user_a",
                created_at: "2026-04-05T12:05:00.000Z",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
              };
            }
            return { success: true };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-05T13:00:00.000Z",
        randomId: () => "generated_1",
      },
    } as unknown as Env;

    const response = await handleCreateMatchDispute(
      {
        action: "createMatchDispute",
        requestId: "req_match_dispute_self",
        payload: {
          matchId: "match_1",
          comment: "Wrong result",
        },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("FORBIDDEN");
  });

  it("rejects disputes after 24 hours", async () => {
    const env = {
      DB: {
        batch: vi.fn(async () => []),
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM matches")) {
              return {
                id: "match_1",
                status: "active",
                created_by_user_id: "user_b",
                created_at: "2026-04-05T12:05:00.000Z",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
              };
            }
            return { success: true };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T13:00:00.000Z",
        randomId: () => "generated_1",
      },
    } as unknown as Env;

    const response = await handleCreateMatchDispute(
      {
        action: "createMatchDispute",
        requestId: "req_match_dispute_late",
        payload: {
          matchId: "match_1",
          comment: "Wrong teammate",
        },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("FORBIDDEN");
  });
});
