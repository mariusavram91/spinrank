import { handleGetMatches } from "../../../worker/src/actions/getMatches";
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

describe("worker getMatches action", () => {
  it("uses the lighter dashboard preview query for the first dashboard page", async () => {
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
            expect(statementSql).not.toContain("WITH visible_matches AS");
            expect(statementSql).not.toContain("EXISTS (");
            expect(statementSql).not.toContain("visible_matches.played_at");
            expect(statementSql).toContain("ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC");
            expect(args).toEqual(["user_a", 5]);

            return { results: [] };
          }),
        ),
      },
    } as unknown as Env;

    const response = await handleGetMatches(
      {
        action: "getMatches",
        requestId: "req_get_matches_dashboard_preview",
        payload: { filter: "recent", limit: 4, mode: "dashboard_preview" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ matches: [], players: [], nextCursor: null });
  });

  it("uses the dedicated mine query path for paginated personal history", async () => {
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
            expect(statementSql).not.toContain("WITH visible_matches AS");
            expect(statementSql).not.toContain("EXISTS (");
            expect(statementSql).toContain("INNER JOIN match_players viewer_mp");
            expect(statementSql).toContain("m.played_at < ?2");
            expect(args).toEqual([
              "user_a",
              "2026-04-05T10:00:00.000Z",
              "2026-04-05T10:05:00.000Z",
              "match_9",
              21,
            ]);

            return { results: [] };
          }),
        ),
      },
    } as unknown as Env;

    const response = await handleGetMatches(
      {
        action: "getMatches",
        requestId: "req_get_matches_mine_paginated",
        payload: {
          filter: "mine",
          limit: 20,
          cursor: "eyJwbGF5ZWRBdCI6IjIwMjYtMDQtMDVUMTA6MDA6MDAuMDAwWiIsImNyZWF0ZWRBdCI6IjIwMjYtMDQtMDVUMTA6MDU6MDAuMDAwWiIsImlkIjoibWF0Y2hfOSJ9",
        },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ matches: [], players: [], nextCursor: null });
  });
});
