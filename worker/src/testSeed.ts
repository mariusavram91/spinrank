import { randomId } from "./db";
import { isTestAuthEnabled } from "./auth";
import { errorResponse, json, successResponse } from "./responses";
import { ensureAchievementCatalog } from "./services/achievements";
import { saveTournamentBracket } from "./services/brackets";
import type { Env, UserRow } from "./types";

type DashboardSeedScenario =
  | "scope-fixtures"
  | "inactive"
  | "low-volume"
  | "global-rank-gt11";

type MatchLockSeedScenario =
  | "completed-season"
  | "completed-tournament"
  | "no-eligible-bracket"
  | "locked-bracket";

interface SeedDashboardPayload {
  ownerId?: string;
  namespace?: string;
  scenario?: DashboardSeedScenario;
}

interface SeedDashboardResponse {
  seasonId?: string;
  tournamentId?: string;
  emptyTournamentId?: string;
  rivalId?: string;
}

interface SeedMatchLocksPayload {
  ownerId?: string;
  namespace?: string;
  scenario?: MatchLockSeedScenario;
}

interface SeedMatchLocksResponse {
  seasonId?: string;
  tournamentId?: string;
}

const TEST_SEED_DASHBOARD_ROUTE = "/test/seed-dashboard";
const TEST_SEED_PROFILE_ROUTE = "/test/seed-profile";
const TEST_SEED_ACHIEVEMENTS_ROUTE = "/test/seed-achievements";
const TEST_SEED_MATCH_LOCKS_ROUTE = "/test/seed-match-locks";

export const isTestSeedDashboardRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_SEED_DASHBOARD_ROUTE;
};

export const isTestSeedProfileRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_SEED_PROFILE_ROUTE;
};

export const isTestSeedAchievementsRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_SEED_ACHIEVEMENTS_ROUTE;
};

export const isTestSeedMatchLocksRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_SEED_MATCH_LOCKS_ROUTE;
};

interface SeedProfilePayload {
  ownerId?: string;
  namespace?: string;
}

interface SeedProfileResponse {
  seasonId: string;
  seasonName: string;
  rivalId: string;
  rivalDisplayName: string;
}

interface SeedAchievementsPayload {
  ownerId?: string;
  namespace?: string;
}

async function requireAuthorizedTestRequest(
  request: Request,
  env: Env,
): Promise<{ requestOrigin: string | null } | Response> {
  const requestOrigin = request.headers.get("origin");

  if (!isTestAuthEnabled(env)) {
    return json(env, errorResponse("test-seed", "NOT_FOUND", "Not found."), 404, requestOrigin);
  }

  const suppliedSecret = request.headers.get("x-test-auth-secret");
  if (!suppliedSecret || suppliedSecret !== env.TEST_AUTH_SECRET) {
    return json(
      env,
      errorResponse("test-seed", "UNAUTHORIZED", "Missing or invalid test auth secret."),
      401,
      requestOrigin,
    );
  }

  return { requestOrigin };
}

async function parseSeedDashboardPayload(
  request: Request,
  env: Env,
  requestOrigin: string | null,
): Promise<SeedDashboardPayload | Response> {
  const rawBody = await request.text();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as SeedDashboardPayload;
  } catch {
    return json(
      env,
      errorResponse("test-seed", "BAD_REQUEST", "Request body contains invalid JSON."),
      400,
      requestOrigin,
    );
  }
}

async function parseJsonPayload<T>(
  request: Request,
  env: Env,
  requestOrigin: string | null,
): Promise<T | Response> {
  const rawBody = await request.text();
  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return json(
      env,
      errorResponse("test-seed", "BAD_REQUEST", "Request body contains invalid JSON."),
      400,
      requestOrigin,
    );
  }
}

async function getRequiredUser(env: Env, userId: string): Promise<UserRow | null> {
  return env.DB.prepare(
    `
      SELECT *
      FROM users
      WHERE id = ?1
    `,
  )
    .bind(userId)
    .first<UserRow>();
}

async function upsertUser(
  env: Env,
  args: {
    userId: string;
    providerUserId: string;
    displayName: string;
    email: string;
    globalElo?: number;
    wins?: number;
    losses?: number;
    streak?: number;
    bestWinStreak?: number;
    nowIso: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (
        id, provider, provider_user_id, email, display_name, avatar_url,
        global_elo, highest_global_elo, wins, losses, streak, best_win_streak, created_at, updated_at
      )
      VALUES (?1, 'google', ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        global_elo = excluded.global_elo,
        highest_global_elo = excluded.highest_global_elo,
        wins = excluded.wins,
        losses = excluded.losses,
        streak = excluded.streak,
        best_win_streak = excluded.best_win_streak,
        updated_at = excluded.updated_at
    `,
  )
    .bind(
      args.userId,
      args.providerUserId,
      args.email,
      args.displayName,
      args.globalElo ?? 1200,
      args.globalElo ?? 1200,
      args.wins ?? 0,
      args.losses ?? 0,
      args.streak ?? 0,
      args.bestWinStreak ?? Math.max(args.streak ?? 0, 0),
      args.nowIso,
    )
    .run();
}

async function seedInactiveDashboard(env: Env, ownerId: string, nowIso: string): Promise<SeedDashboardResponse> {
  await env.DB.prepare(
    `
      UPDATE users
      SET global_elo = 1200, wins = 0, losses = 0, streak = 0, best_win_streak = 0, updated_at = ?2
      WHERE id = ?1
    `,
  )
    .bind(ownerId, nowIso)
    .run();

  return {};
}

async function insertMatch(
  env: Env,
  args: {
    matchId: string;
    ownerId: string;
    rivalId: string;
    ownerDelta: number;
    rivalDelta: number;
    playedAt: string;
    nowIso: string;
  },
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO matches (
          id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
          score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at,
          season_id, tournament_id, created_by_user_id, status, created_at
        )
        VALUES (?1, 'singles', 'single_game', 11, ?2, ?3, ?4, 'A', ?5, '{}', ?6, NULL, NULL, ?7, 'active', ?8)
      `,
    ).bind(
      args.matchId,
      JSON.stringify([args.ownerId]),
      JSON.stringify([args.rivalId]),
      JSON.stringify([{ teamA: 11, teamB: 7 }]),
      JSON.stringify({
        [args.ownerId]: args.ownerDelta,
        [args.rivalId]: args.rivalDelta,
      }),
      args.playedAt,
      args.ownerId,
      args.nowIso,
    ),
    env.DB.prepare(`INSERT INTO match_players (match_id, user_id, team) VALUES (?1, ?2, 'A')`).bind(
      args.matchId,
      args.ownerId,
    ),
    env.DB.prepare(`INSERT INTO match_players (match_id, user_id, team) VALUES (?1, ?2, 'B')`).bind(
      args.matchId,
      args.rivalId,
    ),
  ]);
}

async function seedLowVolumeDashboard(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedDashboardResponse> {
  const rivalId = `${namespace}-low-volume-rival`;
  const matchIds = Array.from({ length: 4 }, (_, index) => `${namespace}-low-volume-match-${index + 1}`);

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Low Volume Rival",
    email: `${rivalId}@test.spinrank.local`,
    globalElo: 1160,
    wins: 0,
    losses: 4,
    streak: -4,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM match_players WHERE user_id IN (?1, ?2)`).bind(owner.id, rivalId),
    ...matchIds.map((matchId) => env.DB.prepare(`DELETE FROM match_players WHERE match_id = ?1`).bind(matchId)),
    ...matchIds.map((matchId) => env.DB.prepare(`DELETE FROM matches WHERE id = ?1`).bind(matchId)),
  ]);

  for (let index = 0; index < 4; index += 1) {
    await insertMatch(env, {
      matchId: matchIds[index],
      ownerId: owner.id,
      rivalId,
      ownerDelta: 10,
      rivalDelta: -10,
      playedAt: `2026-04-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      nowIso,
    });
  }

  await env.DB.batch([
    env.DB.prepare(
      `
      UPDATE users
      SET global_elo = 1240, wins = 4, losses = 0, streak = 4, best_win_streak = 4, updated_at = ?2
      WHERE id = ?1
      `,
    ).bind(owner.id, nowIso),
    env.DB.prepare(
      `
      UPDATE users
      SET global_elo = 1160, wins = 0, losses = 4, streak = -4, best_win_streak = 0, updated_at = ?2
      WHERE id = ?1
      `,
    ).bind(rivalId, nowIso),
  ]);

  return { rivalId };
}

async function seedGlobalRankGt11Dashboard(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedDashboardResponse> {
  await env.DB.prepare(
    `
      DELETE FROM users
      WHERE provider_user_id LIKE 'test:%-ranked-%'
    `,
  ).run();

  const statements = [];

  for (let index = 0; index < 11; index += 1) {
    const userId = `${namespace}-ranked-${index + 1}`;
    statements.push(
      upsertUser(env, {
        userId,
        providerUserId: `test:${userId}`,
        displayName: `Ranked Player ${String(index + 1).padStart(2, "0")}`,
        email: `${userId}@test.spinrank.local`,
        globalElo: 1360 - index * 8,
        wins: 5 + (index % 3),
        losses: index % 2,
        streak: 2,
        nowIso,
      }),
    );
  }

  await Promise.all(statements);

  await env.DB.prepare(
    `
      UPDATE users
      SET global_elo = 1210, wins = 5, losses = 0, streak = 3, best_win_streak = 3, updated_at = ?2
      WHERE id = ?1
    `,
  )
    .bind(owner.id, nowIso)
    .run();

  return {};
}

async function seedScopeFixtures(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedDashboardResponse> {
  const rivalId = `${namespace}-scope-rival`;
  const seasonId = `${namespace}-season`;
  const tournamentId = `${namespace}-tournament`;
  const emptyTournamentId = `${namespace}-empty-tournament`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Scope Rival",
    email: `${rivalId}@test.spinrank.local`,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json
      `,
    ).bind(
      seasonId,
      `Dashboard Scope Season ${namespace}`,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        )
        VALUES (?1, ?2, '2026-04-12', 'active', ?3, ?4, ?5, '')
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id
      `,
    ).bind(tournamentId, `Bracket Tournament ${namespace}`, seasonId, owner.id, nowIso),
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        )
        VALUES (?1, ?2, '2026-04-13', 'active', ?3, ?4, ?5, '')
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id
      `,
    ).bind(emptyTournamentId, `Empty Tournament ${namespace}`, seasonId, owner.id, nowIso),
    env.DB.prepare(`DELETE FROM tournament_participants WHERE tournament_id IN (?1, ?2)`).bind(
      tournamentId,
      emptyTournamentId,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      owner.id,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      rivalId,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      emptyTournamentId,
      owner.id,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      emptyTournamentId,
      rivalId,
    ),
  ]);

  await saveTournamentBracket(
    env,
    tournamentId,
    [owner.id, rivalId],
    [
      {
        title: "Final",
        matches: [
          {
            id: `${namespace}-final`,
            leftPlayerId: owner.id,
            rightPlayerId: rivalId,
            createdMatchId: null,
            winnerPlayerId: null,
            locked: false,
            isFinal: true,
          },
        ],
      },
    ],
    owner.id,
    nowIso,
  );

  await env.DB.prepare(`DELETE FROM tournament_plans WHERE tournament_id = ?1`).bind(emptyTournamentId).run();
  await env.DB.prepare(`DELETE FROM tournament_bracket_matches WHERE tournament_id = ?1`).bind(emptyTournamentId).run();

  return { seasonId, tournamentId, emptyTournamentId, rivalId };
}

async function seedCompletedSeasonLock(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedMatchLocksResponse> {
  const rivalId = `${namespace}-season-lock-rival`;
  const seasonId = `${namespace}-completed-season`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Season Lock Rival",
    email: `${rivalId}@test.spinrank.local`,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-09', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json,
          completed_at = excluded.completed_at
      `,
    ).bind(
      seasonId,
      `Completed Season ${namespace}`,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
  ]);

  return { seasonId };
}

async function seedCompletedTournamentLock(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedMatchLocksResponse> {
  const rivalId = `${namespace}-tournament-lock-rival`;
  const seasonId = `${namespace}-tournament-lock-season`;
  const tournamentId = `${namespace}-completed-tournament`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Tournament Lock Rival",
    email: `${rivalId}@test.spinrank.local`,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json
      `,
    ).bind(
      seasonId,
      `Tournament Lock Season ${namespace}`,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        )
        VALUES (?1, ?2, '2026-04-09', 'completed', ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id,
          completed_at = excluded.completed_at
      `,
    ).bind(
      tournamentId,
      `Completed Tournament ${namespace}`,
      seasonId,
      owner.id,
      nowIso,
      "2026-04-09T18:00:00.000Z",
    ),
    env.DB.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ?1`).bind(tournamentId),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      owner.id,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      rivalId,
    ),
  ]);

  await saveTournamentBracket(
    env,
    tournamentId,
    [owner.id, rivalId],
    [
      {
        title: "Final",
        matches: [
          {
            id: `${namespace}-completed-final`,
            leftPlayerId: owner.id,
            rightPlayerId: rivalId,
            createdMatchId: null,
            winnerPlayerId: owner.id,
            locked: true,
            isFinal: true,
          },
        ],
      },
    ],
    owner.id,
    nowIso,
  );

  return { seasonId, tournamentId };
}

async function seedNoEligibleBracketLock(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedMatchLocksResponse> {
  const rivalId = `${namespace}-empty-bracket-rival`;
  const seasonId = `${namespace}-empty-bracket-season`;
  const tournamentId = `${namespace}-empty-bracket-tournament`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Empty Bracket Rival",
    email: `${rivalId}@test.spinrank.local`,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json
      `,
    ).bind(
      seasonId,
      `Empty Bracket Season ${namespace}`,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        )
        VALUES (?1, ?2, '2026-04-10', 'active', ?3, ?4, ?5, '')
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id,
          completed_at = excluded.completed_at
      `,
    ).bind(tournamentId, `Empty Bracket Tournament ${namespace}`, seasonId, owner.id, nowIso),
    env.DB.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ?1`).bind(tournamentId),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      owner.id,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      rivalId,
    ),
    env.DB.prepare(`DELETE FROM tournament_plans WHERE tournament_id = ?1`).bind(tournamentId),
    env.DB.prepare(`DELETE FROM tournament_bracket_matches WHERE tournament_id = ?1`).bind(tournamentId),
  ]);

  return { seasonId, tournamentId };
}

async function seedLockedBracketLock(
  env: Env,
  owner: UserRow,
  namespace: string,
  nowIso: string,
): Promise<SeedMatchLocksResponse> {
  const rivalId = `${namespace}-locked-bracket-rival`;
  const seasonId = `${namespace}-locked-bracket-season`;
  const tournamentId = `${namespace}-locked-bracket-tournament`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: "Locked Bracket Rival",
    email: `${rivalId}@test.spinrank.local`,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json
      `,
    ).bind(
      seasonId,
      `Locked Bracket Season ${namespace}`,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
    env.DB.prepare(
      `
        INSERT INTO tournaments (
          id, name, date, status, season_id, created_by_user_id, created_at, completed_at
        )
        VALUES (?1, ?2, '2026-04-10', 'active', ?3, ?4, ?5, '')
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          date = excluded.date,
          status = excluded.status,
          season_id = excluded.season_id,
          completed_at = excluded.completed_at
      `,
    ).bind(tournamentId, `Locked Bracket Tournament ${namespace}`, seasonId, owner.id, nowIso),
    env.DB.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ?1`).bind(tournamentId),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      owner.id,
    ),
    env.DB.prepare(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?1, ?2)`).bind(
      tournamentId,
      rivalId,
    ),
  ]);

  await saveTournamentBracket(
    env,
    tournamentId,
    [owner.id, rivalId],
    [
      {
        title: "Final",
        matches: [
          {
            id: `${namespace}-locked-final`,
            leftPlayerId: owner.id,
            rightPlayerId: rivalId,
            createdMatchId: null,
            winnerPlayerId: null,
            locked: true,
            isFinal: true,
          },
        ],
      },
    ],
    owner.id,
    nowIso,
  );

  return { seasonId, tournamentId };
}

async function upsertSeasonSegment(
  env: Env,
  args: {
    segmentId: string;
    userId: string;
    elo: number;
    wins: number;
    losses: number;
    streak: number;
    bestWinStreak?: number;
    matchesPlayedEquivalent: number;
    seasonGlickoRating: number;
    seasonGlickoRd: number;
    seasonConservativeRating: number;
    seasonAttendedWeeks: number;
    seasonTotalWeeks: number;
    seasonAttendancePenalty: number;
    lastMatchAt: string;
    nowIso: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO elo_segments (
        id, segment_type, segment_id, user_id, elo, matches_played, wins, losses, streak, best_win_streak, highest_score,
        updated_at, matches_played_equivalent, last_match_at, season_glicko_rating, season_glicko_rd,
        season_conservative_rating, season_attended_weeks, season_total_weeks, season_attendance_penalty
      )
      VALUES (?1, 'season', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
      ON CONFLICT(segment_type, segment_id, user_id) DO UPDATE SET
        elo = excluded.elo,
        matches_played = excluded.matches_played,
        wins = excluded.wins,
        losses = excluded.losses,
        streak = excluded.streak,
        best_win_streak = excluded.best_win_streak,
        highest_score = excluded.highest_score,
        updated_at = excluded.updated_at,
        matches_played_equivalent = excluded.matches_played_equivalent,
        last_match_at = excluded.last_match_at,
        season_glicko_rating = excluded.season_glicko_rating,
        season_glicko_rd = excluded.season_glicko_rd,
        season_conservative_rating = excluded.season_conservative_rating,
        season_attended_weeks = excluded.season_attended_weeks,
        season_total_weeks = excluded.season_total_weeks,
        season_attendance_penalty = excluded.season_attendance_penalty
    `,
  )
    .bind(
      randomId("es", env.runtime),
      args.segmentId,
      args.userId,
      args.elo,
      Math.round(args.matchesPlayedEquivalent),
      args.wins,
      args.losses,
      args.streak,
      args.bestWinStreak ?? Math.max(args.streak, 0),
      args.seasonConservativeRating - args.seasonAttendancePenalty,
      args.nowIso,
      args.matchesPlayedEquivalent,
      args.lastMatchAt,
      args.seasonGlickoRating,
      args.seasonGlickoRd,
      args.seasonConservativeRating,
      args.seasonAttendedWeeks,
      args.seasonTotalWeeks,
      args.seasonAttendancePenalty,
    )
    .run();
}

async function seedProfileScenario(
  env: Env,
  owner: UserRow,
  namespace: string,
): Promise<SeedProfileResponse> {
  const nowIso = "2026-04-10T12:00:00.000Z";
  const playedAt = "2026-04-09T12:00:00.000Z";
  const rivalId = `${namespace}-profile-rival`;
  const rivalDisplayName = "Profile Rival";
  const seasonId = `${namespace}-profile-season`;
  const seasonName = `Profile Season ${namespace}`;
  const matchId = `${namespace}-profile-match`;

  await upsertUser(env, {
    userId: rivalId,
    providerUserId: `test:${rivalId}`,
    displayName: rivalDisplayName,
    email: `${rivalId}@test.spinrank.local`,
    globalElo: 1180,
    wins: 0,
    losses: 1,
    streak: -1,
    nowIso,
  });

  await env.DB.batch([
    env.DB.prepare(
      `
        INSERT INTO seasons (
          id, name, start_date, end_date, is_active, status, base_elo_mode, participant_ids_json,
          created_by_user_id, created_at, completed_at, is_public
        )
        VALUES (?1, ?2, '2026-04-01', '2026-04-30', 1, 'active', 'carry_over', ?3, ?4, ?5, NULL, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          is_active = excluded.is_active,
          status = excluded.status,
          participant_ids_json = excluded.participant_ids_json
      `,
    ).bind(
      seasonId,
      seasonName,
      JSON.stringify([owner.id, rivalId]),
      owner.id,
      nowIso,
    ),
    env.DB.prepare(`DELETE FROM season_participants WHERE season_id = ?1`).bind(seasonId),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, owner.id),
    env.DB.prepare(`INSERT INTO season_participants (season_id, user_id) VALUES (?1, ?2)`).bind(seasonId, rivalId),
    env.DB.prepare(`DELETE FROM match_players WHERE match_id = ?1`).bind(matchId),
    env.DB.prepare(`DELETE FROM matches WHERE id = ?1`).bind(matchId),
  ]);

  await insertMatch(env, {
    matchId,
    ownerId: owner.id,
    rivalId,
    ownerDelta: 20,
    rivalDelta: -20,
    playedAt,
    nowIso,
  });

  await env.DB.prepare(`UPDATE matches SET season_id = ?2 WHERE id = ?1`).bind(matchId, seasonId).run();

  await env.DB.batch([
    env.DB.prepare(
      `
      UPDATE users
      SET global_elo = 1220, wins = 1, losses = 0, streak = 1, best_win_streak = 1, updated_at = ?2
      WHERE id = ?1
      `,
    ).bind(owner.id, nowIso),
    env.DB.prepare(
      `
      UPDATE users
      SET global_elo = 1180, wins = 0, losses = 1, streak = -1, best_win_streak = 0, updated_at = ?2
      WHERE id = ?1
      `,
    ).bind(rivalId, nowIso),
  ]);

  await upsertSeasonSegment(env, {
    segmentId: seasonId,
    userId: owner.id,
    elo: 1220,
    wins: 1,
    losses: 0,
    streak: 1,
    matchesPlayedEquivalent: 1,
    seasonGlickoRating: 1220,
    seasonGlickoRd: 90,
    seasonConservativeRating: 1130,
    seasonAttendedWeeks: 1,
    seasonTotalWeeks: 4,
    seasonAttendancePenalty: 0,
    lastMatchAt: playedAt,
    nowIso,
  });
  await upsertSeasonSegment(env, {
    segmentId: seasonId,
    userId: rivalId,
    elo: 1180,
    wins: 0,
    losses: 1,
    streak: -1,
    matchesPlayedEquivalent: 1,
    seasonGlickoRating: 1180,
    seasonGlickoRd: 90,
    seasonConservativeRating: 1090,
    seasonAttendedWeeks: 1,
    seasonTotalWeeks: 4,
    seasonAttendancePenalty: 0,
    lastMatchAt: playedAt,
    nowIso,
  });

  return { seasonId, seasonName, rivalId, rivalDisplayName };
}

async function seedAchievementsScenario(env: Env, owner: UserRow): Promise<void> {
  const nowIso = "2026-04-10T12:00:00.000Z";
  await ensureAchievementCatalog(env);

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM user_achievements WHERE user_id = ?1`).bind(owner.id),
    env.DB.prepare(
      `
        INSERT INTO user_achievements (
          user_id, achievement_key, unlocked_at, progress_value, progress_target, last_evaluated_at, context_json
        )
        VALUES
          (?1, 'first_match', '2026-04-10T11:58:00.000Z', 1, 1, ?2, '{}'),
          (?1, 'first_win', '2026-04-10T11:59:00.000Z', 1, 1, ?2, '{}'),
          (?1, 'matches_10', '2026-04-01T10:00:00.000Z', 10, 10, ?2, '{}'),
          (?1, 'tournament_creator', '2026-04-02T10:00:00.000Z', 1, 1, ?2, '{}'),
          (?1, 'matches_25', NULL, 10, 25, ?2, '{}')
      `,
    ).bind(owner.id, nowIso),
  ]);
}

export async function handleTestSeedDashboardRequest(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuthorizedTestRequest(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  const { requestOrigin } = auth;
  const parsedPayload = await parseSeedDashboardPayload(request, env, requestOrigin);
  if (parsedPayload instanceof Response) {
    return parsedPayload;
  }

  const ownerId = String(parsedPayload.ownerId || "").trim();
  const scenario = parsedPayload.scenario;
  const namespace = String(parsedPayload.namespace || "").trim() || randomId("dashboard-seed", env.runtime);

  if (!ownerId || !scenario) {
    return json(
      env,
      errorResponse("test-seed", "BAD_REQUEST", "seed-dashboard requires ownerId and scenario."),
      400,
      requestOrigin,
    );
  }

  const owner = await getRequiredUser(env, ownerId);
  if (!owner) {
    return json(env, errorResponse("test-seed", "NOT_FOUND", "Seed owner was not found."), 404, requestOrigin);
  }

  const nowIso = "2026-04-10T12:00:00.000Z";
  let data: SeedDashboardResponse;

  switch (scenario) {
    case "inactive":
      data = await seedInactiveDashboard(env, owner.id, nowIso);
      break;
    case "low-volume":
      data = await seedLowVolumeDashboard(env, owner, namespace, nowIso);
      break;
    case "global-rank-gt11":
      data = await seedGlobalRankGt11Dashboard(env, owner, namespace, nowIso);
      break;
    case "scope-fixtures":
      data = await seedScopeFixtures(env, owner, namespace, nowIso);
      break;
    default:
      return json(env, errorResponse("test-seed", "BAD_REQUEST", "Unsupported dashboard seed scenario."), 400, requestOrigin);
  }

  return json(env, successResponse("test-seed", data), 200, requestOrigin);
}

export async function handleTestSeedMatchLocksRequest(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuthorizedTestRequest(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const payloadResult = await parseJsonPayload<SeedMatchLocksPayload>(request, env, authResult.requestOrigin);
  if (payloadResult instanceof Response) {
    return payloadResult;
  }

  const ownerId = payloadResult.ownerId?.trim();
  const namespace = payloadResult.namespace?.trim() || ownerId || "match-locks";
  const scenario = payloadResult.scenario;

  if (!ownerId || !scenario) {
    return json(
      env,
      errorResponse("test-seed", "BAD_REQUEST", "ownerId and scenario are required."),
      400,
      authResult.requestOrigin,
    );
  }

  const owner = await getRequiredUser(env, ownerId);
  if (!owner) {
    return json(env, errorResponse("test-seed", "NOT_FOUND", "Owner user not found."), 404, authResult.requestOrigin);
  }

  const nowIso = "2026-04-10T12:00:00.000Z";
  let data: SeedMatchLocksResponse;
  switch (scenario) {
    case "completed-season":
      data = await seedCompletedSeasonLock(env, owner, namespace, nowIso);
      break;
    case "completed-tournament":
      data = await seedCompletedTournamentLock(env, owner, namespace, nowIso);
      break;
    case "no-eligible-bracket":
      data = await seedNoEligibleBracketLock(env, owner, namespace, nowIso);
      break;
    case "locked-bracket":
      data = await seedLockedBracketLock(env, owner, namespace, nowIso);
      break;
    default:
      return json(
        env,
        errorResponse("test-seed", "BAD_REQUEST", `Unknown match lock scenario: ${String(scenario)}`),
        400,
        authResult.requestOrigin,
      );
  }

  return json(env, successResponse("test-seed", data), 200, authResult.requestOrigin);
}

export async function handleTestSeedProfileRequest(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuthorizedTestRequest(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  const { requestOrigin } = auth;
  const parsedPayload = await parseJsonPayload<SeedProfilePayload>(request, env, requestOrigin);
  if (parsedPayload instanceof Response) {
    return parsedPayload;
  }

  const ownerId = String(parsedPayload.ownerId || "").trim();
  const namespace = String(parsedPayload.namespace || "").trim() || randomId("profile-seed", env.runtime);

  if (!ownerId) {
    return json(env, errorResponse("test-seed", "BAD_REQUEST", "seed-profile requires ownerId."), 400, requestOrigin);
  }

  const owner = await getRequiredUser(env, ownerId);
  if (!owner) {
    return json(env, errorResponse("test-seed", "NOT_FOUND", "Seed owner was not found."), 404, requestOrigin);
  }

  const data = await seedProfileScenario(env, owner, namespace);
  return json(env, successResponse("test-seed", data), 200, requestOrigin);
}

export async function handleTestSeedAchievementsRequest(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuthorizedTestRequest(request, env);
  if (auth instanceof Response) {
    return auth;
  }

  const { requestOrigin } = auth;
  const parsedPayload = await parseJsonPayload<SeedAchievementsPayload>(request, env, requestOrigin);
  if (parsedPayload instanceof Response) {
    return parsedPayload;
  }

  const ownerId = String(parsedPayload.ownerId || "").trim();
  if (!ownerId) {
    return json(
      env,
      errorResponse("test-seed", "BAD_REQUEST", "seed-achievements requires ownerId."),
      400,
      requestOrigin,
    );
  }

  const owner = await getRequiredUser(env, ownerId);
  if (!owner) {
    return json(env, errorResponse("test-seed", "NOT_FOUND", "Seed owner was not found."), 404, requestOrigin);
  }

  await seedAchievementsScenario(env, owner);
  return json(env, successResponse("test-seed", {}), 200, requestOrigin);
}
