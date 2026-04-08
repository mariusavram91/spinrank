import { evaluateAchievementsForTrigger, getAchievementOverview, rebuildAchievementsForUsers } from "../../../worker/src/services/achievements";
import { buildAchievementState } from "../../../worker/src/services/achievementRebuildShared.js";
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
      expect(overview.totalAvailable).toBe(76);
      expect(overview.score).toBe(10);
      expect(overview.items).toHaveLength(76);
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

  it("does not grant rank achievements to users with no matches played", () => {
    const items = buildAchievementState(
      {
        id: "user_a",
        matches_played: 0,
        wins: 0,
        losses: 0,
        streak: 0,
        rank: 1,
        global_elo: 1200,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      "2026-04-07T12:00:00.000Z",
      {
        seasonsCreated: new Map(),
        tournamentsCreated: new Map(),
        seasonsPlayed: new Map(),
        tournamentsPlayed: new Map(),
        singlesCount: new Map(),
        doublesCount: new Map(),
        perfect11Count: new Map(),
        perfect21Count: new Map(),
        blowout11Count: new Map(),
        blowout21Count: new Map(),
        seasonWinnerCount: new Map(),
        seasonPodiumCount: new Map(),
        tournamentWinnerCount: new Map(),
        tournamentFinalCount: new Map(),
      },
    );

    expect(items.find((item) => item.key === "rank_top_10")).toMatchObject({
      unlock: false,
      progressValue: 0,
    });
    expect(items.find((item) => item.key === "rank_top_3")).toMatchObject({
      unlock: false,
      progressValue: 0,
    });
    expect(items.find((item) => item.key === "rank_1")).toMatchObject({
      unlock: false,
      progressValue: 0,
    });
  });

  it("grants rank achievements only after the configured match thresholds", () => {
    const items = buildAchievementState(
      {
        id: "user_a",
        matches_played: 60,
        wins: 40,
        losses: 20,
        streak: 4,
        rank: 1,
        global_elo: 1280,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      "2026-04-07T12:00:00.000Z",
      {
        seasonsCreated: new Map(),
        tournamentsCreated: new Map(),
        seasonsPlayed: new Map(),
        tournamentsPlayed: new Map(),
        singlesCount: new Map(),
        doublesCount: new Map(),
        perfect11Count: new Map(),
        perfect21Count: new Map(),
        blowout11Count: new Map(),
        blowout21Count: new Map(),
        seasonWinnerCount: new Map(),
        seasonPodiumCount: new Map(),
        tournamentWinnerCount: new Map(),
        tournamentFinalCount: new Map(),
      },
    );

    expect(items.find((item) => item.key === "rank_top_10")).toMatchObject({
      unlock: true,
      progressValue: 10,
      context: { rank: 1 },
    });
    expect(items.find((item) => item.key === "rank_top_3")).toMatchObject({
      unlock: true,
      progressValue: 3,
      context: { rank: 1 },
    });
    expect(items.find((item) => item.key === "rank_1")).toMatchObject({
      unlock: true,
      progressValue: 1,
      context: { rank: 1 },
    });
  });

  it("requires 60 matches for rank #1 and 7 wins for unstoppable", () => {
    const items = buildAchievementState(
      {
        id: "user_a",
        matches_played: 59,
        wins: 35,
        losses: 24,
        streak: 6,
        rank: 1,
        global_elo: 1280,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      "2026-04-07T12:00:00.000Z",
      {
        seasonsCreated: new Map(),
        tournamentsCreated: new Map(),
        seasonsPlayed: new Map(),
        tournamentsPlayed: new Map(),
        singlesCount: new Map(),
        doublesCount: new Map(),
        perfect11Count: new Map(),
        perfect21Count: new Map(),
        blowout11Count: new Map(),
        blowout21Count: new Map(),
        seasonWinnerCount: new Map(),
        seasonPodiumCount: new Map(),
        tournamentWinnerCount: new Map(),
        tournamentFinalCount: new Map(),
      },
    );

    expect(items.find((item) => item.key === "rank_1")).toMatchObject({
      unlock: false,
      progressValue: 0,
    });
    expect(items.find((item) => item.key === "win_streak_7")).toMatchObject({
      unlock: false,
      progressValue: 6,
      progressTarget: 7,
    });
  });

  it("maps top contender and season champion to any completed season finish", () => {
    const items = buildAchievementState(
      {
        id: "user_a",
        matches_played: 20,
        wins: 12,
        losses: 8,
        streak: 2,
        rank: 8,
        global_elo: 1240,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      "2026-04-07T12:00:00.000Z",
      {
        seasonsCreated: new Map(),
        tournamentsCreated: new Map(),
        seasonsPlayed: new Map(),
        tournamentsPlayed: new Map(),
        singlesCount: new Map(),
        doublesCount: new Map(),
        perfect11Count: new Map(),
        perfect21Count: new Map(),
        blowout11Count: new Map(),
        blowout21Count: new Map(),
        seasonWinnerCount: new Map([["user_a", 1]]),
        seasonPodiumCount: new Map([["user_a", 1]]),
        tournamentWinnerCount: new Map(),
        tournamentFinalCount: new Map(),
      },
    );

    expect(items.find((item) => item.key === "season_top3")).toMatchObject({
      unlock: true,
      progressValue: 1,
    });
    expect(items.find((item) => item.key === "season_champion")).toMatchObject({
      unlock: true,
      progressValue: 1,
    });
  });

  it("does not persist rank milestones for users who have not played matches", async () => {
    const batchCalls: string[][] = [];

    const env = {
      DB: {
        prepare: vi.fn((sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async <T>() => null as T,
            all: async <T>() => {
              if (sql.includes("SELECT\n        u.id,")) {
                return {
                  results: [{ id: "user_a", rank: 1, global_elo: 1200 }],
                } as T;
              }
              if (sql.includes("SELECT id, wins, losses, streak")) {
                return {
                  results: [{ id: "user_a", wins: 0, losses: 0, streak: 0, matches_played: 0 }],
                } as T;
              }
              return { results: [] } as T;
            },
            run: async () => ({ results: [], success: true, meta: {} }),
            toSql: () => sql,
          }),
          first: async <T>() => null as T,
          all: async <T>() => {
            if (sql.includes("SELECT\n        u.id,")) {
              return {
                results: [{ id: "user_a", rank: 1, global_elo: 1200 }],
              } as T;
            }
            if (sql.includes("SELECT id, wins, losses, streak")) {
              return {
                results: [{ id: "user_a", wins: 0, losses: 0, streak: 0, matches_played: 0 }],
              } as T;
            }
            return { results: [] } as T;
          },
          run: async () => ({ results: [], success: true, meta: {} }),
          toSql: () => sql,
        })),
        batch: vi.fn(async (statements: readonly D1PreparedStatement[]) => {
          batchCalls.push(statements.map((statement) => statement.toSql()));
          return statements.map(() => ({ results: [], success: true, meta: {} }));
        }),
      },
    } as unknown as Env;

    await evaluateAchievementsForTrigger(env, {
      type: "rankings_recomputed",
      userIds: ["user_a"],
      nowIso: "2026-04-07T12:00:00.000Z",
    });

    const rankStatements = batchCalls
      .flat()
      .filter((sql) => sql.includes("rank_top_10") || sql.includes("rank_top_3") || sql.includes("rank_1"));
    expect(rankStatements).toEqual([]);
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

  it("counts rivalry and mirror match only from singles history", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Caro" });
      await seedUser(context.env, { id: "user_d", displayName: "Drew" });

      const matches = [
        {
          id: "double_win",
          matchType: "doubles",
          teamA: '["user_a","user_c"]',
          teamB: '["user_b","user_d"]',
          score: '[{"teamA":11,"teamB":8}]',
          winner: "A",
          playedAt: "2026-04-08T09:00:00.000Z",
        },
        {
          id: "double_loss",
          matchType: "doubles",
          teamA: '["user_a","user_c"]',
          teamB: '["user_b","user_d"]',
          score: '[{"teamA":7,"teamB":11}]',
          winner: "B",
          playedAt: "2026-04-08T10:00:00.000Z",
        },
        {
          id: "single_1",
          matchType: "singles",
          teamA: '["user_a"]',
          teamB: '["user_b"]',
          score: '[{"teamA":11,"teamB":7}]',
          winner: "A",
          playedAt: "2026-04-08T11:00:00.000Z",
        },
        {
          id: "single_2",
          matchType: "singles",
          teamA: '["user_a"]',
          teamB: '["user_b"]',
          score: '[{"teamA":8,"teamB":11}]',
          winner: "B",
          playedAt: "2026-04-08T12:00:00.000Z",
        },
        {
          id: "single_3",
          matchType: "singles",
          teamA: '["user_a"]',
          teamB: '["user_b"]',
          score: '[{"teamA":11,"teamB":9}]',
          winner: "A",
          playedAt: "2026-04-08T13:00:00.000Z",
        },
        {
          id: "single_4",
          matchType: "singles",
          teamA: '["user_a"]',
          teamB: '["user_b"]',
          score: '[{"teamA":11,"teamB":6}]',
          winner: "A",
          playedAt: "2026-04-08T14:00:00.000Z",
        },
        {
          id: "single_5",
          matchType: "singles",
          teamA: '["user_a"]',
          teamB: '["user_b"]',
          score: '[{"teamA":9,"teamB":11}]',
          winner: "B",
          playedAt: "2026-04-08T15:00:00.000Z",
        },
      ];

      for (const match of matches) {
        await context.env.DB.prepare(
          `
            INSERT INTO matches (
              id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
              score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
              tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
              deactivation_reason, created_at
            ) VALUES (
              ?1, ?2, 'single_game', 11, ?3, ?4, ?5, ?6, '{}', '{}', ?7, NULL, NULL, 'user_a',
              'active', NULL, NULL, NULL, ?7
            )
          `,
        )
          .bind(match.id, match.matchType, match.teamA, match.teamB, match.score, match.winner, match.playedAt)
          .run();
      }

      const matchPlayers = [
        ["double_win", "user_a", "A"],
        ["double_win", "user_c", "A"],
        ["double_win", "user_b", "B"],
        ["double_win", "user_d", "B"],
        ["double_loss", "user_a", "A"],
        ["double_loss", "user_c", "A"],
        ["double_loss", "user_b", "B"],
        ["double_loss", "user_d", "B"],
        ["single_1", "user_a", "A"],
        ["single_1", "user_b", "B"],
        ["single_2", "user_a", "A"],
        ["single_2", "user_b", "B"],
        ["single_3", "user_a", "A"],
        ["single_3", "user_b", "B"],
        ["single_4", "user_a", "A"],
        ["single_4", "user_b", "B"],
        ["single_5", "user_a", "A"],
        ["single_5", "user_b", "B"],
      ] as const;

      for (const [matchId, userId, team] of matchPlayers) {
        await context.env.DB.prepare(
          `
            INSERT INTO match_players (match_id, user_id, team)
            VALUES (?1, ?2, ?3)
          `,
        )
          .bind(matchId, userId, team)
          .run();
      }

      await evaluateAchievementsForTrigger(context.env, {
        type: "match_created",
        userIds: ["user_a"],
        actorUserId: "user_a",
        matchId: "single_5",
        nowIso: "2026-04-08T16:00:00.000Z",
      });

      const overview = await getAchievementOverview(context.env, "user_a");
      const itemsByKey = new Map(overview.items.map((item) => [item.key, item]));

      expect(itemsByKey.get("rivalry_begins")).toMatchObject({
        unlockedAt: "2026-04-08T16:00:00.000Z",
        progressValue: 5,
        progressTarget: 5,
      });
      expect(itemsByKey.get("mirror_match")).toMatchObject({
        unlockedAt: "2026-04-08T16:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
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

    expect(batchCalls).toHaveLength(6);
    expect(batchCalls[0]).toHaveLength(76);
    expect(batchCalls[1]).toHaveLength(25);
    expect(batchCalls[1].every((sql) => sql.includes("INSERT INTO user_achievements"))).toBe(true);
    expect(batchCalls[2]).toHaveLength(4);
    expect(batchCalls[3]).toHaveLength(14);
    expect(batchCalls[4]).toHaveLength(10);
    expect(batchCalls[5]).toHaveLength(4);
    expect(runCalls.filter((sql) => sql.includes("INSERT INTO user_achievements"))).toEqual([]);
    expect(batchCalls[1].some((sql) => sql.includes("ROW_NUMBER() OVER"))).toBe(false);
  });

  it("uses the incremental match-created path with targeted history reconciliation queries", async () => {
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
                if (sql.includes("SUM(CASE WHEN m.match_type = 'singles'")) {
                  return { results: [{ user_id: "user_a", singles_count: 12, doubles_count: 0 }] } as T;
                }
                if (sql.includes("COUNT(DISTINCT m.season_id)")) {
                  return { results: [] } as T;
                }
                if (sql.includes("COUNT(DISTINCT m.tournament_id)")) {
                  return { results: [] } as T;
                }
                if (sql.includes("SELECT mp.user_id, COUNT(DISTINCT m.id) AS count")) {
                  return { results: [] } as T;
                }
                if (sql.includes("FROM elo_segments es") && sql.includes("JOIN seasons s")) {
                  return { results: [] } as T;
                }
                if (sql.includes("FROM tournament_bracket_matches tbm")) {
                  return { results: [] } as T;
                }
                if (sql.includes("FROM user_achievements")) {
                  return { results: [] } as T;
                }
                if (sql.includes("mp.team AS player_team")) {
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
              if (sql.includes("SUM(CASE WHEN m.match_type = 'singles'")) {
                return { results: [{ user_id: "user_a", singles_count: 12, doubles_count: 0 }] } as T;
              }
              if (sql.includes("COUNT(DISTINCT m.season_id)")) {
                return { results: [] } as T;
              }
              if (sql.includes("COUNT(DISTINCT m.tournament_id)")) {
                return { results: [] } as T;
              }
              if (sql.includes("SELECT mp.user_id, COUNT(DISTINCT m.id) AS count")) {
                return { results: [] } as T;
              }
              if (sql.includes("FROM elo_segments es") && sql.includes("JOIN seasons s")) {
                return { results: [] } as T;
              }
              if (sql.includes("FROM tournament_bracket_matches tbm")) {
                return { results: [] } as T;
              }
              if (sql.includes("FROM user_achievements")) {
                return { results: [] } as T;
              }
              if (sql.includes("mp.team AS player_team")) {
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

    expect(batchCalls).toHaveLength(6);
    expect(batchCalls[1]).toHaveLength(23);
    expect(batchCalls[2]).toHaveLength(4);
    expect(batchCalls[3]).toHaveLength(14);
    expect(batchCalls[4]).toHaveLength(10);
    expect(batchCalls[5]).toHaveLength(4);
    expect(
      prepareSql.some(
        (sql) => sql.includes("COUNT(DISTINCT m.season_id)") || sql.includes("COUNT(DISTINCT m.tournament_id)"),
      ),
    ).toBe(true);
    expect(prepareSql.some((sql) => sql.includes("SUM(CASE WHEN m.match_type = 'singles'"))).toBe(true);
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
      expect(itemsByKey.get("rank_top_10")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 10,
      });
      expect(itemsByKey.get("rank_top_3")).toMatchObject({
        unlockedAt: null,
        progressValue: 0,
      });
      expect(itemsByKey.get("elo_1350")).toMatchObject({
        unlockedAt: "2026-04-20T12:03:00.000Z",
        progressValue: 1350,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("repairs season participation achievements from actual history when earlier progress was missed", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      await context.env.DB.prepare(
        `
          INSERT INTO seasons (
            id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
            created_by_user_id, created_at, completed_at, is_public
          ) VALUES ('season_1', 'Season 1', '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', '["user_a","user_b"]', 'user_a', '2026-04-01T00:00:00.000Z', NULL, 1)
        `,
      ).run();

      for (const matchId of ["match_1", "match_2"]) {
        await context.env.DB.prepare(
          `
            INSERT INTO matches (
              id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
              score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
              tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
              deactivation_reason, created_at
            ) VALUES (
              ?1, 'singles', 'single_game', 11, '["user_a"]', '["user_b"]',
              '[{"teamA":11,"teamB":6}]', 'A', '{}', '{}', '2026-04-05T10:00:00.000Z', 'season_1',
              NULL, 'user_a', 'active', NULL, NULL, NULL, '2026-04-05T10:00:00.000Z'
            )
          `,
        )
          .bind(matchId)
          .run();
        await context.env.DB.prepare(
          `
            INSERT INTO match_players (match_id, user_id, team)
            VALUES (?1, 'user_a', 'A'), (?1, 'user_b', 'B')
          `,
        )
          .bind(matchId)
          .run();
      }

      await evaluateAchievementsForTrigger(context.env, {
        type: "match_created",
        userIds: ["user_a"],
        actorUserId: "user_a",
        matchId: "match_2",
        nowIso: "2026-04-05T12:00:00.000Z",
        matchType: "singles",
        seasonId: "season_1",
      });

      const overview = await getAchievementOverview(context.env, "user_a");
      const item = overview.items.find((entry) => entry.key === "season_played");
      expect(item).toMatchObject({
        key: "season_played",
        unlockedAt: "2026-04-05T12:00:00.000Z",
        progressValue: 1,
        progressTarget: 1,
      });
    } finally {
      await context.cleanup();
    }
  });
});
