vi.mock("../../../worker/src/services/visibility", () => ({
  canAccessSeason: vi.fn(() => true),
  canAccessTournament: vi.fn(async () => true),
  getSeasonById: vi.fn(async () => ({ id: "season_1" })),
  getTournamentById: vi.fn(async () => ({ id: "tournament_1" })),
}));

vi.mock("../../../worker/src/services/brackets", () => ({
  getBracketRounds: vi.fn(async () => [
    {
      title: "Semifinals",
      matches: [
        {
          id: "semi_1",
          leftPlayerId: "user_a",
          rightPlayerId: "user_b",
          createdMatchId: "match_1",
          winnerPlayerId: "user_a",
          locked: true,
          isFinal: false,
        },
      ],
    },
    {
      title: "Final",
      matches: [
        {
          id: "final_1",
          leftPlayerId: "user_a",
          rightPlayerId: "user_c",
          createdMatchId: null,
          winnerPlayerId: null,
          locked: false,
          isFinal: true,
        },
      ],
    },
  ]),
}));

vi.mock("../../../worker/src/services/elo", () => ({
  MINIMUM_LEADERBOARD_MATCHES: 10,
  MINIMUM_MATCHES_TO_QUALIFY: 3,
  calculateSeasonScore: vi.fn(({ rating }: { rating: number }) => rating),
}));

import { handleGetSegmentLeaderboard } from "../../../worker/src/actions/getSegmentLeaderboard";
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
  };

  return statement;
}

describe("worker getSegmentLeaderboard action", () => {
  it("derives tournament ordering and stats from bracket results plus persisted segment rows", async () => {
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
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM elo_segments es")) {
              return {
                results: [
                  {
                    user_id: "user_a",
                    elo: 1250,
                    matches_played: 1,
                    matches_played_equivalent: 1,
                    wins: 1,
                    losses: 0,
                    streak: 1,
                    best_win_streak: 1,
                    highest_score: 0,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: null,
                    season_glicko_rd: null,
                    season_conservative_rating: null,
                    season_attended_weeks: 0,
                    season_total_weeks: 0,
                    season_attendance_penalty: 0,
                    display_name: "Alice",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_b",
                    elo: 1210,
                    matches_played: 1,
                    matches_played_equivalent: 1,
                    wins: 0,
                    losses: 1,
                    streak: -1,
                    best_win_streak: 0,
                    highest_score: 0,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: null,
                    season_glicko_rd: null,
                    season_conservative_rating: null,
                    season_attended_weeks: 0,
                    season_total_weeks: 0,
                    season_attendance_penalty: 0,
                    display_name: "Bob",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_c",
                    elo: 1190,
                    matches_played: 0,
                    matches_played_equivalent: 0,
                    wins: 0,
                    losses: 0,
                    streak: 0,
                    best_win_streak: 0,
                    highest_score: 0,
                    last_match_at: null,
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: null,
                    season_glicko_rd: null,
                    season_conservative_rating: null,
                    season_attended_weeks: 0,
                    season_total_weeks: 0,
                    season_attendance_penalty: 0,
                    display_name: "Cara",
                    avatar_url: null,
                  },
                ],
              };
            }

            if (statementSql.includes("COUNT(*) AS total_matches")) {
              return {
                total_matches: 1,
              };
            }

            if (statementSql.includes("FROM tournament_bracket_matches")) {
              return {
                user_id: "user_a",
                display_name: "Alice",
                avatar_url: null,
              };
            }

            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetSegmentLeaderboard(
      {
        action: "getSegmentLeaderboard",
        requestId: "req_segment_unit_tournament",
        payload: { segmentType: "tournament", segmentId: "tournament_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data?.leaderboard.map((entry) => entry.userId)).toEqual(["user_a", "user_c", "user_b"]);
    expect(response.data?.leaderboard[0]).toMatchObject({
      userId: "user_a",
      wins: 1,
      losses: 0,
      placementLabelKey: "leaderboardPlacementFinal",
      rank: 1,
    });
    expect(response.data?.leaderboard[1]).toMatchObject({
      userId: "user_c",
      placementLabelKey: "leaderboardPlacementFinal",
      rank: 2,
    });
    expect(response.data?.stats).toMatchObject({
      totalMatches: 1,
      mostMatchesPlayer: {
        userId: "user_a",
        matchesPlayed: 1,
      },
      mostWinsPlayer: {
        userId: "user_a",
        wins: 1,
      },
      tournamentWinnerPlayer: {
        userId: "user_a",
        displayName: "Alice",
      },
    });
  });

  it("keeps season players with fewer than ten matches below qualified players", async () => {
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
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM elo_segments es")) {
              return {
                results: [
                  {
                    user_id: "user_unqualified_high_score",
                    elo: 1500,
                    matches_played: 9,
                    matches_played_equivalent: 9,
                    wins: 9,
                    losses: 0,
                    streak: 9,
                    best_win_streak: 9,
                    highest_score: 1490,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1500,
                    season_glicko_rd: 30,
                    season_conservative_rating: 1440,
                    season_attended_weeks: 4,
                    season_total_weeks: 4,
                    season_attendance_penalty: 0,
                    display_name: "High Score",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_qualified",
                    elo: 1300,
                    matches_played: 10,
                    matches_played_equivalent: 10,
                    wins: 10,
                    losses: 0,
                    streak: 2,
                    best_win_streak: 10,
                    highest_score: 1335,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1300,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1210,
                    season_attended_weeks: 5,
                    season_total_weeks: 5,
                    season_attendance_penalty: 0,
                    display_name: "Qualified",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_more_matches",
                    elo: 1280,
                    matches_played: 3,
                    matches_played_equivalent: 3,
                    wins: 2,
                    losses: 1,
                    streak: 1,
                    best_win_streak: 2,
                    highest_score: 1210,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1280,
                    season_glicko_rd: 50,
                    season_conservative_rating: 1180,
                    season_attended_weeks: 3,
                    season_total_weeks: 5,
                    season_attendance_penalty: 8,
                    display_name: "More Matches",
                    avatar_url: null,
                  },
                ],
              };
            }

            if (statementSql.includes("COUNT(*) AS total_matches")) {
              return {
                total_matches: 5,
              };
            }

            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetSegmentLeaderboard(
      {
        action: "getSegmentLeaderboard",
        requestId: "req_segment_unit_season",
        payload: { segmentType: "season", segmentId: "season_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data?.leaderboard.map((entry) => entry.userId)).toEqual([
      "user_qualified",
      "user_unqualified_high_score",
      "user_more_matches",
    ]);
    expect(response.data?.leaderboard.map((entry) => entry.isQualified)).toEqual([true, false, false]);
    expect(response.data?.leaderboard.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(response.data?.leaderboard[0]).toMatchObject({ userId: "user_qualified", highestScore: 1335 });
  });

  it("derives best singles player and best doubles pair awards from segment matches", async () => {
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
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM elo_segments es")) {
              return {
                results: [
                  {
                    user_id: "user_a",
                    elo: 1300,
                    matches_played: 3,
                    matches_played_equivalent: 3,
                    wins: 3,
                    losses: 0,
                    streak: 3,
                    best_win_streak: 3,
                    highest_score: 1300,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1300,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1210,
                    season_attended_weeks: 3,
                    season_total_weeks: 3,
                    season_attendance_penalty: 0,
                    display_name: "Alice",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_b",
                    elo: 1250,
                    matches_played: 3,
                    matches_played_equivalent: 3,
                    wins: 1,
                    losses: 2,
                    streak: -1,
                    best_win_streak: 1,
                    highest_score: 1260,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1250,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1160,
                    season_attended_weeks: 3,
                    season_total_weeks: 3,
                    season_attendance_penalty: 0,
                    display_name: "Bob",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_c",
                    elo: 1210,
                    matches_played: 2,
                    matches_played_equivalent: 2,
                    wins: 1,
                    losses: 1,
                    streak: 1,
                    best_win_streak: 1,
                    highest_score: 1210,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1210,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1120,
                    season_attended_weeks: 2,
                    season_total_weeks: 3,
                    season_attendance_penalty: 0,
                    display_name: "Cara",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_d",
                    elo: 1190,
                    matches_played: 2,
                    matches_played_equivalent: 2,
                    wins: 0,
                    losses: 2,
                    streak: -2,
                    best_win_streak: 0,
                    highest_score: 1200,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1190,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1100,
                    season_attended_weeks: 2,
                    season_total_weeks: 3,
                    season_attendance_penalty: 0,
                    display_name: "Dina",
                    avatar_url: null,
                  },
                ],
              };
            }
            if (statementSql.includes("COUNT(*) AS total_matches")) {
              return { total_matches: 20 };
            }
            if (statementSql.includes("SELECT m.match_type")) {
              const singles = Array.from({ length: 10 }, (_, index) => ({
                match_type: "singles" as const,
                team_a_player_ids_json: JSON.stringify(["user_a"]),
                team_b_player_ids_json: JSON.stringify(["user_b"]),
                winner_team: (index < 8 ? "A" : "B") as "A" | "B",
              }));
              const doubles = Array.from({ length: 10 }, (_, index) => ({
                match_type: "doubles" as const,
                team_a_player_ids_json: JSON.stringify(["user_a", "user_b"]),
                team_b_player_ids_json: JSON.stringify(["user_c", "user_d"]),
                winner_team: (index < 7 ? "A" : "B") as "A" | "B",
              }));
              return {
                results: [...singles, ...doubles],
              };
            }
            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetSegmentLeaderboard(
      {
        action: "getSegmentLeaderboard",
        requestId: "req_segment_awards",
        payload: { segmentType: "season", segmentId: "season_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data?.stats.bestSinglesPlayer).toMatchObject({
      userId: "user_a",
      displayName: "Alice",
      wins: 8,
      losses: 2,
    });
    expect(response.data?.stats.bestDoublesPair).toMatchObject({
      playerIds: ["user_a", "user_b"],
      displayName: "Alice & Bob",
      wins: 7,
      losses: 3,
    });
  });

  it("does not assign singles or doubles awards below the ten-match threshold", async () => {
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
          createPreparedStatement(sql, async (statementSql) => {
            if (statementSql.includes("FROM elo_segments es")) {
              return {
                results: [
                  {
                    user_id: "user_a",
                    elo: 1300,
                    matches_played: 2,
                    matches_played_equivalent: 2,
                    wins: 2,
                    losses: 0,
                    streak: 2,
                    best_win_streak: 2,
                    highest_score: 1300,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1300,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1210,
                    season_attended_weeks: 1,
                    season_total_weeks: 1,
                    season_attendance_penalty: 0,
                    display_name: "Alice",
                    avatar_url: null,
                  },
                  {
                    user_id: "user_b",
                    elo: 1200,
                    matches_played: 2,
                    matches_played_equivalent: 2,
                    wins: 0,
                    losses: 2,
                    streak: -2,
                    best_win_streak: 0,
                    highest_score: 1200,
                    last_match_at: "2026-04-05T10:00:00.000Z",
                    updated_at: "2026-04-05T10:05:00.000Z",
                    season_glicko_rating: 1200,
                    season_glicko_rd: 45,
                    season_conservative_rating: 1110,
                    season_attended_weeks: 1,
                    season_total_weeks: 1,
                    season_attendance_penalty: 0,
                    display_name: "Bob",
                    avatar_url: null,
                  },
                ],
              };
            }
            if (statementSql.includes("COUNT(*) AS total_matches")) {
              return { total_matches: 2 };
            }
            if (statementSql.includes("SELECT m.match_type")) {
              return {
                results: [
                  {
                    match_type: "singles",
                    team_a_player_ids_json: JSON.stringify(["user_a"]),
                    team_b_player_ids_json: JSON.stringify(["user_b"]),
                    winner_team: "A",
                  },
                  {
                    match_type: "doubles",
                    team_a_player_ids_json: JSON.stringify(["user_a", "user_b"]),
                    team_b_player_ids_json: JSON.stringify(["user_c", "user_d"]),
                    winner_team: "A",
                  },
                ],
              };
            }
            return { results: [] };
          }),
        ),
      },
      runtime: {
        nowIso: () => "2026-04-06T12:00:00.000Z",
      },
    } as unknown as Env;

    const response = await handleGetSegmentLeaderboard(
      {
        action: "getSegmentLeaderboard",
        requestId: "req_segment_awards_threshold",
        payload: { segmentType: "season", segmentId: "season_1" },
      },
      sessionUser,
      env,
    );

    expect(response.ok).toBe(true);
    expect(response.data?.stats.bestSinglesPlayer).toBeNull();
    expect(response.data?.stats.bestDoublesPair).toBeNull();
  });
});
