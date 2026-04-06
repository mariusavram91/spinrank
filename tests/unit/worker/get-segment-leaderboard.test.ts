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
  it("derives tournament ordering and stats from bracket results plus segment match rows", async () => {
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
                    wins: 0,
                    losses: 0,
                    streak: 0,
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
                    losses: 0,
                    streak: 0,
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

            if (statementSql.includes("FROM matches m")) {
              return {
                results: [
                  {
                    match_id: "match_1",
                    match_type: "singles",
                    winner_team: "A",
                    played_at: "2026-04-05T10:00:00.000Z",
                    created_at: "2026-04-05T10:00:00.000Z",
                    user_id: "user_a",
                    team: "A",
                  },
                  {
                    match_id: "match_1",
                    match_type: "singles",
                    winner_team: "A",
                    played_at: "2026-04-05T10:00:00.000Z",
                    created_at: "2026-04-05T10:00:00.000Z",
                    user_id: "user_b",
                    team: "B",
                  },
                ],
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
});
