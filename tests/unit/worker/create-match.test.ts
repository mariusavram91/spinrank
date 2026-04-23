vi.mock("../../../worker/src/services/elo", () => ({
  computeEloDeltaForTeams: vi.fn(() => ({ user_a: 20, user_b: -20 })),
  createBlankRatingState: vi.fn(() => ({
    elo: 1200,
    wins: 0,
    losses: 0,
    streak: 0,
    matchesPlayed: 0,
    matchesPlayedEquivalent: 0,
    updatedAt: "2026-04-06T12:00:00.000Z",
  })),
  recomputeAllRankings: vi.fn(async () => ({
    globalState: {},
    segmentStates: new Map(),
  })),
  invalidateUserMatchImpactCache: vi.fn(),
}));

vi.mock("../../../worker/src/services/achievements", () => ({
  createEnqueueAchievementTriggerStatement: vi.fn(() => ({
    bind: () => {
      throw new Error("Unexpected bind on mocked achievement enqueue statement.");
    },
    first: async () => null,
    all: async () => ({ results: [], success: true, meta: {} }),
    run: async () => ({ results: [], success: true, meta: {} }),
    toSql: () => "INSERT INTO achievement_jobs (...)",
  })),
}));

vi.mock("../../../worker/src/services/brackets", () => ({
  applyBracketResult: vi.fn(),
  getBracketRounds: vi.fn(async () => []),
  isTournamentBracketCompleted: vi.fn(async () => false),
  saveTournamentBracket: vi.fn(async () => undefined),
}));

vi.mock("../../../worker/src/services/visibility", () => ({
  canAccessSeason: vi.fn(() => true),
  canAccessTournament: vi.fn(async () => true),
  getSeasonById: vi.fn(async () => null),
  getTournamentById: vi.fn(async () => null),
}));

import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
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

describe("worker createMatch action", () => {
  it("uses at most one full ranking recomputation per successful match creation", async () => {
    const usersById: Record<string, UserRow> = {
      user_a: {
        id: "user_a",
        provider: "google",
        provider_user_id: "google:user_a",
        email: "user_a@example.com",
        display_name: "Alice",
        avatar_url: null,
        locale: "en",
        global_elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-06T00:00:00.000Z",
      },
      user_b: {
        id: "user_b",
        provider: "google",
        provider_user_id: "google:user_b",
        email: "user_b@example.com",
        display_name: "Bob",
        avatar_url: null,
        locale: "en",
        global_elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-06T00:00:00.000Z",
      },
    };

    const env = {
      DB: {
        batch: vi.fn(async () => []),
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql, args) => {
            if (statementSql.includes("FROM users")) {
              return {
                results: args.map((userId) => usersById[String(userId)]).filter(Boolean),
              };
            }

            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
        randomUUID: (() => {
          let index = 0;
          return () => `generated_${++index}`;
        })(),
      },
    } as unknown as Env;

    const sessionUser = usersById.user_a;
    const response = await handleCreateMatch(
      {
        action: "createMatch",
        requestId: "req_create_match_single_recompute",
        payload: {
          matchType: "singles",
          formatType: "single_game",
          pointsToWin: 11,
          teamAPlayerIds: ["user_a"],
          teamBPlayerIds: ["user_b"],
          score: [{ teamA: 11, teamB: 8 }],
          winnerTeam: "A",
          playedAt: "2026-04-05T12:00:00.000Z",
        },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(recomputeAllRankings).toHaveBeenCalledTimes(1);
  });

  it("rejects potential duplicates unless the warning is explicitly ignored", async () => {
    const usersById: Record<string, UserRow> = {
      user_a: {
        id: "user_a",
        provider: "google",
        provider_user_id: "google:user_a",
        email: "user_a@example.com",
        display_name: "Alice",
        avatar_url: null,
        locale: "en",
        global_elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-06T00:00:00.000Z",
      },
      user_b: {
        id: "user_b",
        provider: "google",
        provider_user_id: "google:user_b",
        email: "user_b@example.com",
        display_name: "Bob",
        avatar_url: null,
        locale: "en",
        global_elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-06T00:00:00.000Z",
      },
    };

    const env = {
      DB: {
        batch: vi.fn(async () => []),
        prepare: vi.fn((sql: string) =>
          createPreparedStatement(sql, async (statementSql, args) => {
            if (statementSql.includes("FROM users")) {
              return {
                results: args.map((userId) => usersById[String(userId)]).filter(Boolean),
              };
            }

            if (statementSql.includes("m.matchup_key = ?1")) {
              return {
                results: [{
                  id: "match_existing",
                  match_type: "singles",
                  format_type: "single_game",
                  points_to_win: 11,
                  team_a_player_ids_json: JSON.stringify(["user_a"]),
                  team_b_player_ids_json: JSON.stringify(["user_b"]),
                  score_json: JSON.stringify([{ teamA: 11, teamB: 8 }]),
                  winner_team: "A",
                  played_at: "2026-04-05T12:00:00.000Z",
                  season_id: null,
                  tournament_id: null,
                  created_by_user_id: "user_a",
                  created_by_display_name: "Alice",
                  status: "active",
                  created_at: "2026-04-05T12:05:00.000Z",
                  delete_locked_at: "2026-04-05T12:50:00.000Z",
                  has_active_dispute: 0,
                }],
              };
            }

            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
        randomUUID: (() => {
          let index = 0;
          return () => `generated_${++index}`;
        })(),
      },
    } as unknown as Env;

    const sessionUser = usersById.user_a;
    const payload = {
      matchType: "singles" as const,
      formatType: "single_game" as const,
      pointsToWin: 11 as const,
      teamAPlayerIds: ["user_a"],
      teamBPlayerIds: ["user_b"],
      score: [{ teamA: 11, teamB: 8 }],
      winnerTeam: "A" as const,
      playedAt: "2026-04-05T12:00:00.000Z",
    };

    const conflict = await handleCreateMatch(
      {
        action: "createMatch",
        requestId: "req_create_match_duplicate_conflict",
        payload,
      },
      sessionUser,
      env,
    );

    expect(conflict.ok).toBe(false);
    expect(conflict.error?.code).toBe("CONFLICT");

    const override = await handleCreateMatch(
      {
        action: "createMatch",
        requestId: "req_create_match_duplicate_override",
        payload: {
          ...payload,
          ignoreDuplicateWarning: true,
        },
      },
      sessionUser,
      env,
    );

    expect(override.ok).toBe(true);
  });
});
