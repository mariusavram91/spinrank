vi.mock("../../../worker/src/services/elo", () => ({
  recomputeAllRankings: vi.fn(async () => undefined),
  invalidateUserMatchImpactCache: vi.fn(),
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

describe("worker deactivateMatch action", () => {
  it("uses the incremental rollback path for a latest non-season match", async () => {
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
            if (statementSql.includes("FROM matches") && statementSql.includes("WHERE id = ?1")) {
              return {
                id: "match_1",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: null,
                season_id: null,
                match_type: "singles",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: "A",
                global_elo_delta_json: JSON.stringify({ user_a: 20, user_b: -20 }),
                segment_elo_delta_json: JSON.stringify({}),
                played_at: "2026-04-05T12:00:00.000Z",
                created_at: "2026-04-05T12:05:00.000Z",
                delete_locked_at: "2026-04-06T13:00:00.000Z",
                has_active_dispute: 0,
              };
            }

            if (statementSql.includes("SELECT 1") && statementSql.includes("INNER JOIN match_players mp")) {
              return null;
            }

            if (statementSql.includes("SELECT") && statementSql.includes("m.global_elo_delta_json")) {
              return {
                results: [],
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
    expect(rebuildTournamentBracket).not.toHaveBeenCalled();
    expect(recomputeAllRankings).not.toHaveBeenCalled();
  });

  it("falls back to a full recomputation for season-backed match deletions", async () => {
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
            if (statementSql.includes("FROM matches") && statementSql.includes("WHERE id = ?1")) {
              return {
                id: "match_1",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: "tournament_1",
                season_id: "season_1",
                match_type: "singles",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: "A",
                global_elo_delta_json: JSON.stringify({ user_a: 20, user_b: -20 }),
                segment_elo_delta_json: JSON.stringify({ season_1: {}, tournament_1: { user_a: 20, user_b: -20 } }),
                played_at: "2026-04-05T12:00:00.000Z",
                created_at: "2026-04-05T12:05:00.000Z",
                delete_locked_at: "2026-04-06T13:00:00.000Z",
                has_active_dispute: 0,
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
        requestId: "req_deactivate_match_season_fallback",
        payload: { id: "match_1", reason: "cleanup" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(rebuildTournamentBracket).toHaveBeenCalledWith(env, "tournament_1");
    expect(recomputeAllRankings).toHaveBeenCalledTimes(1);
  });

  it("rejects deleting a tournament match when a later bracket round match already exists", async () => {
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
            if (statementSql.includes("FROM matches") && statementSql.includes("WHERE id = ?1")) {
              return {
                id: "match_semi",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: "tournament_1",
                season_id: null,
                match_type: "singles",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: "A",
                global_elo_delta_json: JSON.stringify({ user_a: 20, user_b: -20 }),
                segment_elo_delta_json: JSON.stringify({ tournament_1: { user_a: 20, user_b: -20 } }),
                played_at: "2026-04-05T12:00:00.000Z",
                created_at: "2026-04-05T12:05:00.000Z",
                delete_locked_at: "2026-04-06T13:00:00.000Z",
                has_active_dispute: 0,
              };
            }

            if (statementSql.includes("FROM tournament_bracket_matches current")) {
              return { 1: 1 };
            }

            return { success: true };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
        randomId: () => "generated_1",
      },
    } as unknown as Env;

    const response = await handleDeactivateMatch(
      {
        action: "deactivateMatch",
        requestId: "req_deactivate_match_tournament_guard",
        payload: { id: "match_semi", reason: "cleanup" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: "CONFLICT",
      message: "Only the latest tournament match can be deleted.",
    });
    expect(env.DB.batch).not.toHaveBeenCalled();
  });

  it("blocks deletion after the grace period when there is no active dispute", async () => {
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
            if (statementSql.includes("FROM matches") && statementSql.includes("WHERE id = ?1")) {
              return {
                id: "match_1",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: null,
                season_id: null,
                match_type: "singles",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: "A",
                global_elo_delta_json: JSON.stringify({ user_a: 20, user_b: -20 }),
                segment_elo_delta_json: JSON.stringify({}),
                played_at: "2026-04-05T12:00:00.000Z",
                created_at: "2026-04-05T12:05:00.000Z",
                delete_locked_at: "2026-04-05T12:50:00.000Z",
                has_active_dispute: 0,
              };
            }
            return { success: true };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
        randomId: () => "generated_1",
      },
    } as unknown as Env;

    const response = await handleDeactivateMatch(
      {
        action: "deactivateMatch",
        requestId: "req_deactivate_match_locked",
        payload: { id: "match_1", reason: "cleanup" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: "FORBIDDEN",
      message: "This match can no longer be deleted unless it has an active dispute.",
    });
  });

  it("allows deletion after the grace period when the match is disputed", async () => {
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
            if (statementSql.includes("FROM matches") && statementSql.includes("WHERE id = ?1")) {
              return {
                id: "match_1",
                created_by_user_id: "user_a",
                status: "active",
                tournament_id: null,
                season_id: null,
                match_type: "singles",
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: "A",
                global_elo_delta_json: JSON.stringify({ user_a: 20, user_b: -20 }),
                segment_elo_delta_json: JSON.stringify({}),
                played_at: "2026-04-05T12:00:00.000Z",
                created_at: "2026-04-05T12:05:00.000Z",
                delete_locked_at: "2026-04-05T12:50:00.000Z",
                has_active_dispute: 1,
              };
            }

            if (statementSql.includes("SELECT 1") && statementSql.includes("INNER JOIN match_players mp")) {
              return null;
            }

            if (statementSql.includes("SELECT") && statementSql.includes("m.global_elo_delta_json")) {
              return {
                results: [],
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
        requestId: "req_deactivate_match_disputed",
        payload: { id: "match_1", reason: "cleanup" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
  });
});
