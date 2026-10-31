import { findDuplicateMatches, isDuplicateScore } from "../../../worker/src/services/matchGuards";
import type { Env, MatchScoreGame } from "../../../worker/src/types";

describe("duplicate match scoring", () => {
  it("treats an identical score as a duplicate", () => {
    const score: MatchScoreGame[] = [{ teamA: 11, teamB: 8 }];
    expect(isDuplicateScore(score, [{ teamA: 11, teamB: 8 }])).toBe(true);
  });

  it("treats a mirrored score as a duplicate", () => {
    const proposed: MatchScoreGame[] = [
      { teamA: 11, teamB: 9 },
      { teamA: 12, teamB: 10 },
    ];
    const existing: MatchScoreGame[] = [
      { teamA: 9, teamB: 11 },
      { teamA: 10, teamB: 12 },
    ];
    expect(isDuplicateScore(proposed, existing)).toBe(true);
  });

  it("rejects a different score for the same players", () => {
    expect(isDuplicateScore([{ teamA: 11, teamB: 8 }], [{ teamA: 11, teamB: 5 }])).toBe(false);
  });

  it("rejects a different number of games", () => {
    const proposed: MatchScoreGame[] = [
      { teamA: 11, teamB: 5 },
      { teamA: 9, teamB: 11 },
      { teamA: 11, teamB: 7 },
    ];
    const existing: MatchScoreGame[] = [{ teamA: 11, teamB: 5 }];
    expect(isDuplicateScore(proposed, existing)).toBe(false);
  });

  it("rejects when either score is empty", () => {
    expect(isDuplicateScore([], [])).toBe(false);
    expect(isDuplicateScore([{ teamA: 11, teamB: 8 }], [])).toBe(false);
  });
});

const buildCandidateRow = (overrides: Record<string, unknown> = {}) => ({
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
  created_at: "2026-04-05T12:00:30.000Z",
  delete_locked_at: "2026-04-05T12:45:30.000Z",
  has_active_dispute: 0,
  ...overrides,
});

const createEnvWithCandidates = (rows: Array<Record<string, unknown>>): Env =>
  ({
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: rows }),
        }),
      }),
    },
  }) as unknown as Env;

const basePayload = {
  matchType: "singles" as const,
  formatType: "single_game" as const,
  pointsToWin: 11 as const,
  teamAPlayerIds: ["user_a"],
  teamBPlayerIds: ["user_b"],
  score: [{ teamA: 11, teamB: 8 }],
  playedAt: "2026-04-05T12:00:00.000Z",
};

describe("findDuplicateMatches", () => {
  it("flags a candidate with the same players and score", async () => {
    const duplicates = await findDuplicateMatches(createEnvWithCandidates([buildCandidateRow()]), basePayload);
    expect(duplicates.map((match) => match.id)).toEqual(["match_existing"]);
  });

  it("ignores the same players when the score differs", async () => {
    const env = createEnvWithCandidates([
      buildCandidateRow({ score_json: JSON.stringify([{ teamA: 11, teamB: 3 }]) }),
    ]);
    await expect(findDuplicateMatches(env, basePayload)).resolves.toEqual([]);
  });

  it("ignores the same players when the format or target score differs", async () => {
    const env = createEnvWithCandidates([
      buildCandidateRow({ format_type: "best_of_3" }),
      buildCandidateRow({ points_to_win: 21 }),
    ]);
    await expect(findDuplicateMatches(env, basePayload)).resolves.toEqual([]);
  });

  it("still flags a mirrored score", async () => {
    const env = createEnvWithCandidates([
      buildCandidateRow({
        team_a_player_ids_json: JSON.stringify(["user_b"]),
        team_b_player_ids_json: JSON.stringify(["user_a"]),
        score_json: JSON.stringify([{ teamA: 8, teamB: 11 }]),
        winner_team: "B",
      }),
    ]);
    const duplicates = await findDuplicateMatches(env, basePayload);
    expect(duplicates.map((match) => match.id)).toEqual(["match_existing"]);
  });
});
