vi.mock("../../../worker/src/services/elo", () => ({
  recomputeAllRankings: vi.fn(async () => undefined),
}));

vi.mock("../../../worker/src/services/brackets", () => ({
  rebuildTournamentBracket: vi.fn(async () => undefined),
}));

import { handleDeactivateMatch } from "../../../worker/src/actions/deactivateMatch";
import { rebuildTournamentBracket } from "../../../worker/src/services/brackets";
import { recomputeAllRankings } from "../../../worker/src/services/elo";
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
    async first<T>() {
      return (await responder(sql, this.args)) as T;
    },
    async run() {
      return (await responder(sql, this.args)) as { success: true };
    },
  };

  return statement;
}

describe("worker deactivateMatch action", () => {
  it("rebuilds dependent state with a single ranking recomputation", async () => {
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
        batch: vi.fn(async () => []),
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM matches")) {
              return {
                id: "match_1",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: "tournament_1",
              };
            }

            return { success: true };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
        randomId: (() => {
          let index = 0;
          return () => `generated_${++index}`;
        })(),
      },
    } as unknown as Env;

    const response = await handleDeactivateMatch(
      {
        action: "deactivateMatch",
        requestId: "req_deactivate_match_single_recompute",
        payload: { id: "match_1", reason: "cleanup" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(rebuildTournamentBracket).toHaveBeenCalledWith(env, "tournament_1");
    expect(recomputeAllRankings).toHaveBeenCalledTimes(1);
  });
});
