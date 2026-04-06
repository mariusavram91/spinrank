vi.mock("../../../worker/src/services/elo", () => ({
  recomputeAllRankings: vi.fn(async () => undefined),
}));

import { handleDeactivateSeason } from "../../../worker/src/actions/deactivateSeason";
import { handleDeactivateTournament } from "../../../worker/src/actions/deactivateTournament";
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

const sessionUser = {
  id: "user_owner",
  provider: "google",
  provider_user_id: "google:user_owner",
  email: "owner@example.com",
  display_name: "Owner",
  avatar_url: null,
  global_elo: 1200,
  wins: 0,
  losses: 0,
  streak: 0,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-06T00:00:00.000Z",
} as UserRow;

function createEnv(responder: (sql: string, args: unknown[]) => Promise<unknown>): Env {
  return {
    DB: {
      batch: vi.fn(async () => []),
      prepare: vi.fn((sql: string) => createPreparedStatement(sql, responder)),
    },
    runtime: {
      nowIso: () => "2026-04-06T12:00:00.000Z",
      randomUUID: (() => {
        let index = 0;
        return () => `generated_${++index}`;
      })(),
    },
  } as unknown as Env;
}

describe("worker deactivate segment actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("skips ranking recomputation when deleting a tournament with no active matches", async () => {
    const env = createEnv(async (sql) => {
      if (sql.includes("FROM tournaments")) {
        return {
          id: "tournament_1",
          created_by_user_id: "user_owner",
          status: "active",
          season_id: null,
        };
      }

      if (sql.includes("SELECT id, match_type") && sql.includes("WHERE tournament_id = ?1")) {
        return { results: [] };
      }

      return { success: true };
    });

    const response = await handleDeactivateTournament(
      {
        action: "deactivateTournament",
        requestId: "req_deactivate_empty_tournament",
        payload: { id: "tournament_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(recomputeAllRankings).not.toHaveBeenCalled();
  });

  it("skips ranking recomputation when deleting a season with no active matches", async () => {
    const env = createEnv(async (sql) => {
      if (sql.includes("FROM seasons")) {
        return {
          id: "season_1",
          name: "Spring",
          created_by_user_id: "user_owner",
          status: "active",
        };
      }

      if (sql.includes("SELECT id") && sql.includes("FROM tournaments") && sql.includes("season_id = ?1")) {
        return { results: [] };
      }

      if (sql.includes("SELECT id, match_type") && sql.includes("WHERE (season_id = ?1")) {
        return { results: [] };
      }

      return { success: true };
    });

    const response = await handleDeactivateSeason(
      {
        action: "deactivateSeason",
        requestId: "req_deactivate_empty_season",
        payload: { id: "season_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(recomputeAllRankings).not.toHaveBeenCalled();
  });

  it("uses incremental rollback for populated standalone tournament deletions", async () => {
    const env = createEnv(async (sql, args) => {
      if (sql.includes("FROM tournaments") && sql.includes("WHERE id = ?1")) {
        return {
          id: "tournament_1",
          created_by_user_id: "user_owner",
          status: "active",
          season_id: null,
        };
      }

      if (sql.includes("SELECT id, match_type") && sql.includes("WHERE tournament_id = ?1")) {
        return {
          results: [
            {
              id: "match_1",
              match_type: "singles",
              team_a_player_ids_json: JSON.stringify(["user_owner"]),
              team_b_player_ids_json: JSON.stringify(["user_friend"]),
              winner_team: "A",
              played_at: "2026-04-05T12:00:00.000Z",
              created_at: "2026-04-05T12:05:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("SELECT 1") && sql.includes("INNER JOIN match_players mp")) {
        return null;
      }

      if (sql.includes("m.global_elo_delta_json")) {
        return { results: [] };
      }

      if (sql.includes("UPDATE users")) {
        expect(args[0]).toBeTypeOf("string");
        return { success: true };
      }

      return { success: true };
    });

    const response = await handleDeactivateTournament(
      {
        action: "deactivateTournament",
        requestId: "req_deactivate_tournament_incremental",
        payload: { id: "tournament_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(recomputeAllRankings).not.toHaveBeenCalled();
  });

  it("uses incremental rollback for populated season deletions when removed matches are the latest active ones", async () => {
    const env = createEnv(async (sql, args) => {
      if (sql.includes("FROM seasons") && sql.includes("WHERE id = ?1")) {
        return {
          id: "season_1",
          name: "Spring",
          created_by_user_id: "user_owner",
          status: "active",
        };
      }

      if (sql.includes("SELECT id") && sql.includes("FROM tournaments") && sql.includes("season_id = ?1")) {
        return { results: [{ id: "tournament_1" }] };
      }

      if (sql.includes("SELECT id, match_type") && sql.includes("WHERE (season_id = ?1")) {
        return {
          results: [
            {
              id: "match_1",
              match_type: "singles",
              team_a_player_ids_json: JSON.stringify(["user_owner"]),
              team_b_player_ids_json: JSON.stringify(["user_friend"]),
              winner_team: "A",
              played_at: "2026-04-05T12:00:00.000Z",
              created_at: "2026-04-05T12:05:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("SELECT 1") && sql.includes("INNER JOIN match_players mp")) {
        return null;
      }

      if (sql.includes("m.global_elo_delta_json")) {
        return { results: [] };
      }

      if (sql.includes("UPDATE users")) {
        expect(args[0]).toBeTypeOf("string");
        return { success: true };
      }

      return { success: true };
    });

    const response = await handleDeactivateSeason(
      {
        action: "deactivateSeason",
        requestId: "req_deactivate_season_incremental",
        payload: { id: "season_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(recomputeAllRankings).not.toHaveBeenCalled();
  });
});
