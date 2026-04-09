import { randomId } from "./db";
import { isTestAuthEnabled } from "./auth";
import { errorResponse, json, successResponse } from "./responses";
import { saveTournamentBracket } from "./services/brackets";
import type { Env, UserRow } from "./types";

type DashboardSeedScenario =
  | "scope-fixtures"
  | "inactive"
  | "low-volume"
  | "global-rank-gt11";

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

const TEST_SEED_DASHBOARD_ROUTE = "/test/seed-dashboard";

export const isTestSeedDashboardRequest = (request: Request): boolean => {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname === TEST_SEED_DASHBOARD_ROUTE;
};

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
    nowIso: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO users (
        id, provider, provider_user_id, email, display_name, avatar_url,
        global_elo, wins, losses, streak, created_at, updated_at
      )
      VALUES (?1, 'google', ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, ?9)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        global_elo = excluded.global_elo,
        wins = excluded.wins,
        losses = excluded.losses,
        streak = excluded.streak,
        updated_at = excluded.updated_at
    `,
  )
    .bind(
      args.userId,
      args.providerUserId,
      args.email,
      args.displayName,
      args.globalElo ?? 1200,
      args.wins ?? 0,
      args.losses ?? 0,
      args.streak ?? 0,
      args.nowIso,
    )
    .run();
}

async function seedInactiveDashboard(env: Env, ownerId: string, nowIso: string): Promise<SeedDashboardResponse> {
  await env.DB.prepare(
    `
      UPDATE users
      SET global_elo = 1200, wins = 0, losses = 0, streak = 0, updated_at = ?2
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
    env.DB.prepare(
      `
        DELETE FROM matches
        WHERE id LIKE ?1
      `,
    ).bind(`${namespace}-low-volume-match-%`),
  ]);

  for (let index = 0; index < 4; index += 1) {
    await insertMatch(env, {
      matchId: `${namespace}-low-volume-match-${index + 1}`,
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
        SET global_elo = 1240, wins = 4, losses = 0, streak = 4, updated_at = ?2
        WHERE id = ?1
      `,
    ).bind(owner.id, nowIso),
    env.DB.prepare(
      `
        UPDATE users
        SET global_elo = 1160, wins = 0, losses = 4, streak = -4, updated_at = ?2
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
      SET global_elo = 1210, wins = 5, losses = 0, streak = 3, updated_at = ?2
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
