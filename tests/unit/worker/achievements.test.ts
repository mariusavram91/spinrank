import { evaluateAchievementsForTrigger, getAchievementOverview, rebuildAchievementsForUsers } from "../../../worker/src/services/achievements";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { Env } from "../../../worker/src/types";

describe("worker unit: achievements", () => {
  it("unlocks account creation once and keeps the overview idempotent", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });

      await evaluateAchievementsForTrigger(context.env, {
        type: "bootstrap",
        userId: "user_a",
        nowIso: "2026-04-04T12:00:00.000Z",
      });
      await evaluateAchievementsForTrigger(context.env, {
        type: "bootstrap",
        userId: "user_a",
        nowIso: "2026-04-04T12:05:00.000Z",
      });

      const overview = await getAchievementOverview(context.env, "user_a");

      expect(overview.totalUnlocked).toBe(1);
      expect(overview.totalAvailable).toBe(36);
      expect(overview.score).toBe(10);
      expect(overview.items).toHaveLength(36);
      expect(overview.items[0]).toMatchObject({
        key: "account_created",
        unlockedAt: "2026-04-04T12:00:00.000Z",
      });
      expect(overview.recentUnlocks).toEqual([
        expect.objectContaining({
          key: "account_created",
          unlockedAt: "2026-04-04T12:00:00.000Z",
          titleKey: "achievement.account_created.title",
        }),
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it("calculates time-based milestones on read without persisting them", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await context.env.DB.prepare(
        `
          UPDATE users
          SET created_at = '2025-01-01T00:00:00.000Z'
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .run();

      const overview = await getAchievementOverview(context.env, "user_a");
      const itemsByKey = new Map(overview.items.map((item) => [item.key, item]));

      expect(itemsByKey.get("days_30")).toMatchObject({
        unlockedAt: "2025-01-31T00:00:00.000Z",
        progressValue: 30,
        progressTarget: 30,
      });
      expect(itemsByKey.get("days_180")).toMatchObject({
        unlockedAt: "2025-06-30T00:00:00.000Z",
        progressValue: 180,
        progressTarget: 180,
      });
      expect(itemsByKey.get("days_365")).toMatchObject({
        unlockedAt: "2026-01-01T00:00:00.000Z",
        progressValue: 365,
        progressTarget: 365,
      });

      const persistedRows = await context.env.DB.prepare(
        `
          SELECT achievement_key
          FROM user_achievements
          WHERE user_id = ?1
            AND achievement_key IN ('days_30', 'days_180', 'days_365')
          ORDER BY achievement_key ASC
        `,
      )
        .bind("user_a")
        .all<{ achievement_key: string }>();

      expect(persistedRows.results).toEqual([]);
    } finally {
      await context.cleanup();
    }
  });

  it("tracks denser early match milestones and creator progress for seasons and tournaments", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });

      await context.env.DB.prepare(
        `
          UPDATE users
          SET global_elo = 1380, wins = 4, losses = 8, streak = 4, created_at = '2025-03-15T12:00:00.000Z'
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .run();

      for (let index = 1; index <= 3; index += 1) {
        await context.env.DB.prepare(
          `
            INSERT INTO seasons (
              id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
              created_by_user_id, created_at, completed_at, is_public
            ) VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', '["user_a"]', ?3, ?4, NULL, 1)
          `,
        )
          .bind(`season_${index}`, `Season ${index}`, "user_a", `2026-04-0${index}T10:00:00.000Z`)
          .run();
      }

      for (let index = 1; index <= 3; index += 1) {
        await context.env.DB.prepare(
          `
            INSERT INTO tournaments (
              id, name, date, status, season_id, created_by_user_id, created_at, completed_at
            ) VALUES (?1, ?2, '2026-04-05', 'active', NULL, ?3, ?4, '')
          `,
        )
          .bind(`tournament_${index}`, `Tournament ${index}`, "user_a", `2026-04-1${index}T10:00:00.000Z`)
          .run();
      }

      for (let index = 1; index <= 3; index += 1) {
        await context.env.DB.prepare(
          `
            INSERT INTO matches (
              id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
              score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
              tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
              deactivation_reason, created_at
            ) VALUES (
              ?1, 'singles', 'single_game', 11, '["user_a"]', '["user_a_opponent"]',
              '[{"teamA":11,"teamB":6}]', 'A', '{}', '{}', ?2, ?3, ?4, 'user_a', 'active', NULL, NULL, NULL, ?2
            )
          `,
        )
          .bind(
            `match_${index}`,
            `2026-04-2${index}T10:00:00.000Z`,
            `season_${index}`,
            `tournament_${index}`,
          )
          .run();
        await context.env.DB.prepare(
          `
            INSERT INTO match_players (match_id, user_id, team)
            VALUES (?1, ?2, 'A')
          `,
        )
          .bind(`match_${index}`, "user_a")
          .run();
      }
      await context.env.DB.prepare(
        `
          INSERT INTO matches (
            id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
            score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
            tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
            deactivation_reason, created_at
          ) VALUES (
            'match_doubles', 'doubles', 'single_game', 11, '["user_a","user_c"]', '["user_b","user_d"]',
            '[{"teamA":11,"teamB":7}]', 'A', '{}', '{}', '2026-04-24T10:00:00.000Z', 'season_1', 'tournament_1',
            'user_a', 'active', NULL, NULL, NULL, '2026-04-24T10:00:00.000Z'
          )
        `,
      ).run();
      await context.env.DB.prepare(
        `
          INSERT INTO match_players (match_id, user_id, team)
          VALUES ('match_doubles', ?1, 'A')
        `,
      )
        .bind("user_a")
        .run();

      await evaluateAchievementsForTrigger(context.env, {
        type: "match_created",
        userIds: ["user_a"],
        actorUserId: "user_a",
        matchId: "match_progress",
        nowIso: "2026-04-20T12:00:00.000Z",
      });
      await evaluateAchievementsForTrigger(context.env, {
        type: "season_created",
        actorUserId: "user_a",
        seasonId: "season_3",
        nowIso: "2026-04-20T12:01:00.000Z",
      });
      await evaluateAchievementsForTrigger(context.env, {
        type: "tournament_created",
        actorUserId: "user_a",
        tournamentId: "tournament_3",
        nowIso: "2026-04-20T12:02:00.000Z",
      });
      await evaluateAchievementsForTrigger(context.env, {
        type: "rankings_recomputed",
        userIds: ["user_a"],
        nowIso: "2026-04-20T12:03:00.000Z",
      });

      const overview = await getAchievementOverview(context.env, "user_a");
      const itemsByKey = new Map(overview.items.map((item) => [item.key, item]));

      expect(itemsByKey.get("matches_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 3,
        progressTarget: 3,
      });
      expect(itemsByKey.get("matches_10")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 10,
        progressTarget: 10,
      });
      expect(itemsByKey.get("matches_25")).toMatchObject({
        unlockedAt: null,
        progressValue: 12,
        progressTarget: 25,
      });
      expect(itemsByKey.get("first_singles")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
      });
      expect(itemsByKey.get("singles_10")).toMatchObject({
        unlockedAt: null,
        progressValue: 3,
        progressTarget: 10,
      });
      expect(itemsByKey.get("first_doubles")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
      });
      expect(itemsByKey.get("doubles_10")).toMatchObject({
        unlockedAt: null,
        progressValue: 1,
        progressTarget: 10,
      });
      expect(itemsByKey.get("season_creator")).toMatchObject({
        unlockedAt: "2026-04-20T12:01:00.000Z",
        progressValue: 1,
      });
      expect(itemsByKey.get("seasons_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:01:00.000Z",
        progressValue: 3,
        progressTarget: 3,
      });
      expect(itemsByKey.get("seasons_5")).toMatchObject({
        unlockedAt: null,
        progressValue: 3,
        progressTarget: 5,
      });
      expect(itemsByKey.get("season_played")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
      });
      expect(itemsByKey.get("seasons_played_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 3,
        progressTarget: 3,
      });
      expect(itemsByKey.get("seasons_played_5")).toMatchObject({
        unlockedAt: null,
        progressValue: 3,
        progressTarget: 5,
      });
      expect(itemsByKey.get("tournaments_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:02:00.000Z",
        progressValue: 3,
        progressTarget: 3,
      });
      expect(itemsByKey.get("tournaments_5")).toMatchObject({
        unlockedAt: null,
        progressValue: 3,
        progressTarget: 5,
      });
      expect(itemsByKey.get("tournament_played")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
      });
      expect(itemsByKey.get("tournaments_played_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:00:00.000Z",
        progressValue: 3,
        progressTarget: 3,
      });
      expect(itemsByKey.get("tournaments_played_5")).toMatchObject({
        unlockedAt: null,
        progressValue: 3,
        progressTarget: 5,
      });
      expect(itemsByKey.get("elo_1250")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1250,
        progressTarget: 1250,
      });
      expect(itemsByKey.get("elo_1350")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1350,
        progressTarget: 1350,
      });
      expect(itemsByKey.get("elo_1500")).toMatchObject({
        unlockedAt: null,
        progressValue: 1380,
        progressTarget: 1500,
      });
      expect(itemsByKey.get("days_30")).toMatchObject({
        unlockedAt: "2025-04-14T12:00:00.000Z",
        progressValue: 30,
        progressTarget: 30,
      });
      expect(itemsByKey.get("days_180")).toMatchObject({
        unlockedAt: "2025-09-11T12:00:00.000Z",
        progressValue: 180,
        progressTarget: 180,
      });
      expect(itemsByKey.get("days_365")).toMatchObject({
        unlockedAt: "2026-03-15T12:00:00.000Z",
        progressValue: 365,
        progressTarget: 365,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("flushes match-triggered achievement progress through a single batch write", async () => {
    const batchCalls: string[][] = [];
    const runCalls: string[] = [];

    const env = {
      DB: {
        prepare: vi.fn((sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async <T>() => {
              if (sql.includes("SELECT\n        u.id,")) {
                return { id: "user_a", rank: 1 } as T;
              }
              if (sql.includes("SELECT created_at")) {
                return { created_at: "2025-01-01T00:00:00.000Z" } as T;
              }
              return null as T;
            },
            all: async <T>() => {
              if (sql.includes("SELECT\n        u.id,")) {
                return {
                  results: [{ id: "user_a", rank: 1, global_elo: 1380 }],
                } as T;
              }
              if (sql.includes("SELECT id, wins, losses, streak")) {
                return {
                  results: [{ id: "user_a", wins: 4, losses: 8, streak: 4, matches_played: 12 }],
                } as T;
              }
              if (sql.includes("COUNT(DISTINCT m.season_id)")) {
                return { results: [{ user_id: "user_a", played_count: 3 }] } as T;
              }
              if (sql.includes("COUNT(DISTINCT m.tournament_id)")) {
                return { results: [{ user_id: "user_a", played_count: 3 }] } as T;
              }
              if (sql.includes("SUM(CASE WHEN m.match_type = 'singles'")) {
                return { results: [{ user_id: "user_a", singles_count: 3, doubles_count: 1 }] } as T;
              }
              return { results: [] } as T;
            },
            run: async () => {
              runCalls.push(sql);
              return { results: [], success: true, meta: {} };
            },
            toSql: () => sql,
          }),
          first: async <T>() => {
            if (sql.includes("SELECT\n        u.id,")) {
              return { id: "user_a", rank: 1 } as T;
            }
            if (sql.includes("SELECT created_at")) {
              return { created_at: "2025-01-01T00:00:00.000Z" } as T;
            }
            return null as T;
          },
          all: async <T>() => {
            if (sql.includes("SELECT\n        u.id,")) {
              return {
                results: [{ id: "user_a", rank: 1, global_elo: 1380 }],
              } as T;
            }
            if (sql.includes("SELECT id, wins, losses, streak")) {
              return {
                results: [{ id: "user_a", wins: 4, losses: 8, streak: 4, matches_played: 12 }],
              } as T;
            }
            if (sql.includes("COUNT(DISTINCT m.season_id)")) {
              return { results: [{ user_id: "user_a", played_count: 3 }] } as T;
            }
            if (sql.includes("COUNT(DISTINCT m.tournament_id)")) {
              return { results: [{ user_id: "user_a", played_count: 3 }] } as T;
            }
            if (sql.includes("SUM(CASE WHEN m.match_type = 'singles'")) {
              return { results: [{ user_id: "user_a", singles_count: 3, doubles_count: 1 }] } as T;
            }
            return { results: [] } as T;
          },
          run: async () => {
            runCalls.push(sql);
            return { results: [], success: true, meta: {} };
          },
          toSql: () => sql,
        })),
        batch: vi.fn(async (statements: readonly D1PreparedStatement[]) => {
          batchCalls.push(statements.map((statement) => statement.toSql()));
          return statements.map(() => ({ results: [], success: true, meta: {} }));
        }),
      },
      runtime: {
        nowIso: () => "2026-04-20T12:00:00.000Z",
      },
    } as unknown as Env;

    await evaluateAchievementsForTrigger(env, {
      type: "match_created",
      userIds: ["user_a"],
      actorUserId: "user_a",
      matchId: "match_progress",
      nowIso: "2026-04-20T12:00:00.000Z",
    });

    expect(batchCalls).toHaveLength(2);
    expect(batchCalls[0]).toHaveLength(36);
    expect(batchCalls[1]).toHaveLength(20);
    expect(batchCalls[1].every((sql) => sql.includes("INSERT INTO user_achievements"))).toBe(true);
    expect(runCalls.filter((sql) => sql.includes("INSERT INTO user_achievements"))).toEqual([]);
    expect(batchCalls[1].some((sql) => sql.includes("ROW_NUMBER() OVER"))).toBe(false);
  });

  it("uses the incremental match-created path without scanning historical match tables", async () => {
    const prepareSql: string[] = [];
    const batchCalls: string[][] = [];

    const env = {
      DB: {
        prepare: vi.fn((sql: string) => {
          prepareSql.push(sql);
          return {
            bind: (...args: unknown[]) => ({
              first: async <T>() => {
                if (sql.includes("SELECT created_at")) {
                  return { created_at: "2025-01-01T00:00:00.000Z" } as T;
                }
                return null as T;
              },
              all: async <T>() => {
                if (sql.includes("SELECT id, wins, losses, streak")) {
                  return {
                    results: [{ id: "user_a", wins: 4, losses: 8, streak: 4, matches_played: 12 }],
                  } as T;
                }
                if (sql.includes("FROM user_achievements")) {
                  return { results: [] } as T;
                }
                if (sql.includes("SELECT DISTINCT mp.user_id")) {
                  return { results: [] } as T;
                }
                throw new Error(`Unexpected query: ${sql} :: ${JSON.stringify(args)}`);
              },
              run: async () => ({ results: [], success: true, meta: {} }),
              toSql: () => sql,
            }),
            first: async <T>() => {
              if (sql.includes("SELECT created_at")) {
                return { created_at: "2025-01-01T00:00:00.000Z" } as T;
              }
              return null as T;
            },
            all: async <T>() => {
              if (sql.includes("SELECT id, wins, losses, streak")) {
                return {
                  results: [{ id: "user_a", wins: 4, losses: 8, streak: 4, matches_played: 12 }],
                } as T;
              }
              if (sql.includes("FROM user_achievements")) {
                return { results: [] } as T;
              }
              if (sql.includes("SELECT DISTINCT mp.user_id")) {
                return { results: [] } as T;
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
            run: async () => ({ results: [], success: true, meta: {} }),
            toSql: () => sql,
          };
        }),
        batch: vi.fn(async (statements: readonly D1PreparedStatement[]) => {
          batchCalls.push(statements.map((statement) => statement.toSql()));
          return statements.map(() => ({ results: [], success: true, meta: {} }));
        }),
      },
      runtime: {
        nowIso: () => "2026-04-20T12:00:00.000Z",
      },
    } as unknown as Env;

    await evaluateAchievementsForTrigger(env, {
      type: "match_created",
      userIds: ["user_a"],
      actorUserId: "user_a",
      matchId: "match_incremental",
      nowIso: "2026-04-20T12:00:00.000Z",
      matchType: "singles",
      seasonId: "season_1",
      tournamentId: "tournament_1",
    });

    expect(batchCalls).toHaveLength(2);
    expect(batchCalls[1]).toHaveLength(18);
    expect(
      prepareSql.some(
        (sql) => sql.includes("COUNT(DISTINCT m.season_id)") || sql.includes("COUNT(DISTINCT m.tournament_id)"),
      ),
    ).toBe(false);
    expect(prepareSql.some((sql) => sql.includes("SUM(CASE WHEN m.match_type = 'singles'"))).toBe(false);
  });

  it("rebuilds achievement state for users through the explicit repair path", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await context.env.DB.prepare(
        `
          UPDATE users
          SET global_elo = 1380, wins = 4, losses = 8, streak = 4, created_at = '2025-03-15T12:00:00.000Z'
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .run();
      await context.env.DB.prepare(
        `
          INSERT INTO seasons (
            id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
            created_by_user_id, created_at, completed_at, is_public
          ) VALUES ('season_1', 'Season 1', '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', '["user_a"]', 'user_a', '2026-04-01T10:00:00.000Z', NULL, 1)
        `,
      ).run();
      await context.env.DB.prepare(
        `
          INSERT INTO tournaments (
            id, name, date, status, season_id, created_by_user_id, created_at, completed_at
          ) VALUES ('tournament_1', 'Tournament 1', '2026-04-05', 'active', 'season_1', 'user_a', '2026-04-11T10:00:00.000Z', '')
        `,
      ).run();
      await context.env.DB.prepare(
        `
          INSERT INTO matches (
            id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
            score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
            tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
            deactivation_reason, created_at
          ) VALUES (
            'match_1', 'singles', 'single_game', 11, '["user_a"]', '["user_b"]',
            '[{"teamA":11,"teamB":6}]', 'A', '{}', '{}', '2026-04-21T10:00:00.000Z', 'season_1', 'tournament_1',
            'user_a', 'active', NULL, NULL, NULL, '2026-04-21T10:00:00.000Z'
          )
        `,
      ).run();
      await context.env.DB.prepare(
        `
          INSERT INTO match_players (match_id, user_id, team)
          VALUES ('match_1', 'user_a', 'A')
        `,
      ).run();

      await rebuildAchievementsForUsers(context.env, ["user_a"], "2026-04-20T12:03:00.000Z");

      const overview = await getAchievementOverview(context.env, "user_a");
      const itemsByKey = new Map(overview.items.map((item) => [item.key, item]));

      expect(itemsByKey.get("account_created")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1,
      });
      expect(itemsByKey.get("first_match")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1,
      });
      expect(itemsByKey.get("first_win")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1,
      });
      expect(itemsByKey.get("rank_top_3")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 3,
      });
      expect(itemsByKey.get("elo_1350")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1350,
      });
    } finally {
      await context.cleanup();
    }
  });
});
