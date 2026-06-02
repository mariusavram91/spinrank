import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveUserMatchImpactDetails, invalidateUserMatchImpactCache } from '../../../worker/src/services/elo';
import type { Env } from '../../../worker/src/types';

const createEnv = (prepareSpy: ReturnType<typeof vi.fn>): Env => ({
  DB: {
    prepare: (sql: string) => {
      prepareSpy(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async <T>() => {
            if (sql.includes('SELECT id, played_at, created_at') && sql.includes('FROM matches')) {
              return {
                id: 'match_1',
                played_at: '2026-04-20T10:00:00.000Z',
                created_at: '2026-04-20T10:00:01.000Z',
              } as T;
            }
            return null as T;
          },
          all: async <T>() => {
            if (sql.includes('SELECT id, match_type, team_a_player_ids_json, team_b_player_ids_json, winner_team')) {
              return {
                results: [
                  {
                    id: 'match_1',
                    match_type: 'singles',
                    team_a_player_ids_json: '["user_a"]',
                    team_b_player_ids_json: '["user_b"]',
                    winner_team: 'A',
                    global_elo_delta_json: '{"user_a":20,"user_b":-20}',
                    segment_elo_delta_json: '{}',
                    season_id: null,
                    tournament_id: null,
                    played_at: '2026-04-20T10:00:00.000Z',
                    created_at: '2026-04-20T10:00:01.000Z',
                    status: 'active',
                  },
                ] as T[],
              };
            }
            return { results: [] as T[] };
          },
        }),
      };
    },
    batch: async () => [],
  } as unknown as D1Database,
  GOOGLE_CLIENT_ID: '',
  APP_SESSION_SECRET: 'secret',
  APP_ORIGIN: 'http://localhost:5173',
  runtime: {
    now: () => Date.parse('2026-04-23T00:00:00.000Z'),
    nowIso: () => '2026-04-23T00:00:00.000Z',
    randomUUID: () => 'uuid',
  },
});

describe('worker elo impact cache', () => {
  beforeEach(() => {
    invalidateUserMatchImpactCache();
  });

  it('reuses cached impact details for the same user and match ids until invalidated', async () => {
    const prepareSpy = vi.fn();
    const env = createEnv(prepareSpy);

    const first = await deriveUserMatchImpactDetails(env, 'user_a', ['match_1']);
    const second = await deriveUserMatchImpactDetails(env, 'user_a', ['match_1']);

    expect(first.match_1).toMatchObject({
      globalDelta: 20,
      globalBefore: 1200,
      globalAfter: 1220,
      outcome: 'win',
    });
    expect(second).toEqual(first);
    expect(prepareSpy).toHaveBeenCalledTimes(5);

    invalidateUserMatchImpactCache();
    await deriveUserMatchImpactDetails(env, 'user_a', ['match_1']);
    expect(prepareSpy).toHaveBeenCalledTimes(10);
  });
  it("prefers persisted impact details before replaying match history", async () => {
    const prepareSpy = vi.fn();
    const env = createEnv(prepareSpy);
    env.DB = {
      prepare: (sql: string) => {
        prepareSpy(sql);
        return {
          bind: (..._args: unknown[]) => ({
            first: async <T>() => null as T,
            all: async <T>() => {
              if (sql.includes("FROM match_rating_impacts")) {
                return {
                  results: [
                    {
                      match_id: "match_1",
                      user_id: "user_a",
                      global_delta: 20,
                      global_before: 1200,
                      global_after: 1220,
                      global_gap: 0,
                      season_score_delta: null,
                      season_gap: null,
                      expected_win_probability: 0.5,
                      effective_k_factor: 40,
                      outcome: "win",
                      season_breakdown_json: null,
                    },
                  ] as T[],
                };
              }
              return { results: [] as T[] };
            },
          }),
        };
      },
    } as unknown as D1Database;

    const result = await deriveUserMatchImpactDetails(env, "user_a", ["match_1"]);

    expect(result.match_1).toMatchObject({
      globalBefore: 1200,
      globalAfter: 1220,
      outcome: "win",
    });
    expect(prepareSpy).toHaveBeenCalledTimes(1);
  });
});
