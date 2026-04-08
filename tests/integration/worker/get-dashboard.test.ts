import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { computeEloDeltaForTeams, recomputeAllRankings } from "../../../worker/src/services/elo";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { TestWorkerEnv } from "../../helpers/worker/make-test-env";

const getUserById = async (env: TestWorkerEnv, id: string) => {
  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind(id).first<any>();
  if (!user) {
    throw new Error(`Expected user ${id} to exist`);
  }
  return user;
};

const runBatches = async (env: Parameters<typeof seedUser>[0], statements: D1PreparedStatement[], chunkSize = 200) => {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await env.DB.batch(statements.slice(index, index + chunkSize));
  }
};

const buildRoundRobinOrder = (playerIds: string[]): string[] => {
  if (playerIds.length <= 2) {
    return playerIds.slice();
  }

  const [fixedPlayerId, ...rest] = playerIds;
  return [fixedPlayerId, rest[rest.length - 1], ...rest.slice(0, -1)];
};

const seedLargeLeaderboardFixture = async (
  env: Parameters<typeof seedUser>[0],
  totalUsers = 100,
  rounds = 5,
): Promise<{ requestingUserId: string }> => {
  const playerIds = Array.from({ length: totalUsers }, (_, index) => `user_${String(index + 1).padStart(3, "0")}`);
  const nowIso = env.runtime.nowIso();
  const requestingUserId = playerIds[0];
  const statements: D1PreparedStatement[] = playerIds.map((playerId, index) =>
    env.DB.prepare(
      `
        INSERT INTO users (
          id, provider, provider_user_id, email, display_name, avatar_url,
          global_elo, wins, losses, streak, created_at, updated_at
        )
        VALUES (?1, 'google', ?2, ?3, ?4, NULL, 1200, 0, 0, 0, ?5, ?5)
      `,
    ).bind(
      playerId,
      `test:${playerId}`,
      `${playerId}@test.spinrank.local`,
      `Player ${String(index + 1).padStart(3, "0")}`,
      nowIso,
    ),
  );

  const ratingMap = Object.fromEntries(
    playerIds.map((playerId, index) => [
      playerId,
      {
        id: playerId,
        provider: "google",
        provider_user_id: `test:${playerId}`,
        email: `${playerId}@test.spinrank.local`,
        display_name: `Player ${String(index + 1).padStart(3, "0")}`,
        avatar_url: null,
        global_elo: 1200,
        wins: 0,
        losses: 0,
        streak: 0,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]),
  ) as Record<string, any>;

  let pairingOrder = playerIds.slice();
  let matchCounter = 0;
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < pairingOrder.length / 2; pairIndex += 1) {
      const teamAPlayerId = pairingOrder[pairIndex];
      const teamBPlayerId = pairingOrder[pairingOrder.length - 1 - pairIndex];
      const winnerTeam = (roundIndex + pairIndex) % 2 === 0 ? "A" : "B";
      const globalDelta = computeEloDeltaForTeams(
        [teamAPlayerId],
        [teamBPlayerId],
        ratingMap,
        winnerTeam,
        "singles",
      );
      const matchId = `match_perf_${roundIndex}_${pairIndex}`;
      const playedAt = new Date(Date.UTC(2026, 3, 5, 10, matchCounter, 0)).toISOString();
      const teamAScore = winnerTeam === "A" ? 11 : 8;
      const teamBScore = winnerTeam === "B" ? 11 : 7;

      statements.push(
        env.DB.prepare(
          `
            INSERT INTO matches (
              id, match_type, format_type, points_to_win, team_a_player_ids_json, team_b_player_ids_json,
              score_json, winner_team, global_elo_delta_json, segment_elo_delta_json, played_at, season_id,
              tournament_id, created_by_user_id, status, deactivated_at, deactivated_by_user_id,
              deactivation_reason, created_at
            ) VALUES (?1, 'singles', 'single_game', 11, ?2, ?3, ?4, ?5, ?6, '{}', ?7, NULL, NULL, ?8, 'active', NULL, NULL, NULL, ?7)
          `,
        ).bind(
          matchId,
          JSON.stringify([teamAPlayerId]),
          JSON.stringify([teamBPlayerId]),
          JSON.stringify([{ teamA: teamAScore, teamB: teamBScore }]),
          winnerTeam,
          JSON.stringify(globalDelta),
          playedAt,
          teamAPlayerId,
        ),
        env.DB.prepare(`INSERT INTO match_players (match_id, user_id, team) VALUES (?1, ?2, 'A')`).bind(
          matchId,
          teamAPlayerId,
        ),
        env.DB.prepare(`INSERT INTO match_players (match_id, user_id, team) VALUES (?1, ?2, 'B')`).bind(
          matchId,
          teamBPlayerId,
        ),
      );

      ratingMap[teamAPlayerId].global_elo += Number(globalDelta[teamAPlayerId] ?? 0);
      ratingMap[teamBPlayerId].global_elo += Number(globalDelta[teamBPlayerId] ?? 0);
      if (winnerTeam === "A") {
        ratingMap[teamAPlayerId].wins += 1;
        ratingMap[teamBPlayerId].losses += 1;
      } else {
        ratingMap[teamAPlayerId].losses += 1;
        ratingMap[teamBPlayerId].wins += 1;
      }
      matchCounter += 1;
    }

    pairingOrder = buildRoundRobinOrder(pairingOrder);
  }

  await runBatches(env, statements);
  await recomputeAllRankings(env);

  return {
    requestingUserId,
  };
};

describe("worker integration: getDashboard", () => {
  it("orders dashboard leaderboard entries using the leaderboard sort rules", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_budget_match_a",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_budget_match_b",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 9 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_sorting",
          payload: { matchesLimit: 2, matchesFilter: "recent" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.leaderboard.slice(0, 3)).toEqual([
        expect.objectContaining({ userId: "user_b", rank: 1 }),
        expect.objectContaining({ userId: "user_a", rank: 2 }),
        expect.objectContaining({ userId: "user_c", rank: 3 }),
      ]);
    } finally {
      await context.cleanup();
    }
  });

  it(
    "stays within a coarse latency budget while composing dashboard summaries",
    async () => {
    const context = await createWorkerTestContext();
    try {
      const { requestingUserId } = await seedLargeLeaderboardFixture(context.env, 100, 5);
      const refreshedAlice = await getUserById(context.env, requestingUserId);
      const startedAt = performance.now();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_budget",
          payload: { matchesLimit: 10, matchesFilter: "recent" },
        },
        refreshedAlice,
        context.env,
      );
      const elapsedMs = performance.now() - startedAt;

      expect(response.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(10000);
      expect(response.data?.matches).toHaveLength(10);
      expect(response.data?.leaderboard.length).toBeGreaterThan(0);
      expect(response.data?.players.length).toBeGreaterThanOrEqual(response.data?.leaderboard.length ?? 0);
      expect(response.data?.userProgress).not.toBeNull();
    } finally {
      await context.cleanup();
    }
    },
    120000,
  );

  it("returns composed season, leaderboard, match, and progress data from persisted state", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const alice = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<any>();

      await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_season",
          payload: {
            name: "April Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        alice,
        context.env,
      );

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 5 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
            seasonId: "season_uuid_1",
          },
        },
        alice,
        context.env,
      );
      const matchId = matchResponse.data?.match.id;

      const refreshedAlice = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<any>();

      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard",
          payload: { matchesLimit: 4, matchesFilter: "recent" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.seasons).toEqual([
        expect.objectContaining({
          id: "season_uuid_1",
          name: "April Season",
        }),
      ]);
      expect(response.data?.matches).toEqual([
        expect.objectContaining({
          id: matchId,
          winnerTeam: "A",
          seasonId: "season_uuid_1",
        }),
      ]);
      expect(response.data?.leaderboard[0]).toMatchObject({
        userId: "user_a",
        elo: 1220,
        rank: 1,
      });
      expect(response.data?.userProgress).toMatchObject({
        currentRank: 1,
        currentElo: 1220,
        wins: 1,
        losses: 0,
      });
      expect(response.data?.nextCursor).toBeNull();
    } finally {
      await context.cleanup();
    }
  });

  it("respects mine filtering and match limits while keeping achievement data available", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_c", displayName: "Cara" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_mine_match_a",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        alice,
        context.env,
      );

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_mine_match_b",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_c"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T11:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_mine_only",
          payload: { matchesLimit: 1, matchesFilter: "mine" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toHaveLength(1);
      expect(response.data?.matches[0]).toMatchObject({
        winnerTeam: "A",
      });
      expect([response.data?.matches[0].teamAPlayerIds, response.data?.matches[0].teamBPlayerIds].flat()).toContain("user_a");
      expect(response.data?.achievements.items).toHaveLength(76);
      expect(response.data?.userProgress).toMatchObject({
        wins: 1,
        losses: 0,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("includes match players outside the dashboard leaderboard preview in the player directory", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      await seedUser(context.env, { id: "user_z", displayName: "Zed" });

      const alice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const bob = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_b").first<any>();

      for (let index = 0; index < 10; index += 1) {
        await seedUser(context.env, { id: `user_rank_${index}`, displayName: `Rank ${index}` });
      }

      await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_dashboard_preview_hidden_player_match_1",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_b"],
            teamBPlayerIds: ["user_z"],
            score: [{ teamA: 11, teamB: 8 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T10:00:00.000Z",
          },
        },
        bob,
        context.env,
      );

      const refreshedAlice = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("user_a").first<any>();
      const response = await handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_hidden_match_players",
          payload: { matchesLimit: 4, matchesFilter: "all" },
        },
        refreshedAlice,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.matches).toHaveLength(1);
      expect(response.data?.players).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: "user_b", displayName: "Bob" }),
          expect.objectContaining({ userId: "user_z", displayName: "Zed" }),
        ]),
      );
    } finally {
      await context.cleanup();
    }
  });
});
