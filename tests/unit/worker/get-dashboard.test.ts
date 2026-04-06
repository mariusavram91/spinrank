vi.mock("../../../worker/src/actions/getSeasons", () => ({
  handleGetSeasons: vi.fn(),
}));

vi.mock("../../../worker/src/actions/getTournaments", () => ({
  handleGetTournaments: vi.fn(),
}));

vi.mock("../../../worker/src/actions/getLeaderboard", () => ({
  handleGetLeaderboard: vi.fn(),
}));

vi.mock("../../../worker/src/actions/getMatches", () => ({
  handleGetMatches: vi.fn(),
}));

vi.mock("../../../worker/src/actions/getUserProgress", () => ({
  handleGetUserProgress: vi.fn(),
}));

import { handleGetDashboard } from "../../../worker/src/actions/getDashboard";
import { handleGetLeaderboard } from "../../../worker/src/actions/getLeaderboard";
import { handleGetMatches } from "../../../worker/src/actions/getMatches";
import { handleGetSeasons } from "../../../worker/src/actions/getSeasons";
import { handleGetTournaments } from "../../../worker/src/actions/getTournaments";
import { handleGetUserProgress } from "../../../worker/src/actions/getUserProgress";
import type { Env, UserRow } from "../../../worker/src/types";

const sessionUser = {
  id: "user_1",
  provider: "google",
  provider_user_id: "google_1",
  email: "ada@example.com",
  display_name: "Ada",
  avatar_url: null,
  global_elo: 1200,
  wins: 3,
  losses: 1,
  streak: 2,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-06T00:00:00.000Z",
} as UserRow;

const env = {
  runtime: {
    nowIso: () => "2026-04-06T12:00:00.000Z",
  },
} as Env;

describe("worker getDashboard action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("composes subresponses, applies defaults, and extracts bracket context", async () => {
    vi.mocked(handleGetSeasons).mockResolvedValue({
      ok: true,
      data: {
        seasons: [{ id: "season_1", name: "Spring" }],
      },
    } as never);
    vi.mocked(handleGetTournaments).mockResolvedValue({
      ok: true,
      data: {
        tournaments: [{ id: "tournament_1", name: "Cup" }],
      },
    } as never);
    vi.mocked(handleGetLeaderboard).mockResolvedValue({
      ok: true,
      data: {
        leaderboard: [{ userId: "user_1", rank: 1 }],
      },
    } as never);
    vi.mocked(handleGetMatches).mockResolvedValue({
      ok: true,
      data: {
        matches: [
          { id: "match_1", bracketContext: { roundTitle: "Final", isFinal: true } },
          { id: "match_2", bracketContext: null },
        ],
      },
    } as never);
    vi.mocked(handleGetUserProgress).mockResolvedValue({
      ok: true,
      data: {
        currentRank: 1,
      },
    } as never);

    const response = await handleGetDashboard(
      {
        action: "getDashboard",
        requestId: "req_dashboard",
        payload: {},
      },
      sessionUser,
      env,
    );

    expect(handleGetMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "getMatches",
        payload: { filter: "recent", limit: 4 },
      }),
      sessionUser,
      env,
    );
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      seasons: [{ id: "season_1", name: "Spring" }],
      tournaments: [{ id: "tournament_1", name: "Cup" }],
      leaderboard: [{ userId: "user_1", rank: 1 }],
      leaderboardUpdatedAt: "2026-04-06T12:00:00.000Z",
      userProgress: { currentRank: 1 },
      matches: [
        { id: "match_1", bracketContext: { roundTitle: "Final", isFinal: true } },
        { id: "match_2", bracketContext: null },
      ],
      nextCursor: null,
      matchBracketContextByMatchId: {
        match_1: { roundTitle: "Final", isFinal: true },
      },
    });
  });

  it("throws when any dashboard subrequest fails", async () => {
    vi.mocked(handleGetSeasons).mockResolvedValue({ ok: true, data: { seasons: [] } } as never);
    vi.mocked(handleGetTournaments).mockResolvedValue({ ok: true, data: { tournaments: [] } } as never);
    vi.mocked(handleGetLeaderboard).mockResolvedValue({ ok: false, data: null } as never);
    vi.mocked(handleGetMatches).mockResolvedValue({ ok: true, data: { matches: [], nextCursor: null } } as never);
    vi.mocked(handleGetUserProgress).mockResolvedValue({ ok: true, data: { currentRank: null } } as never);

    await expect(
      handleGetDashboard(
        {
          action: "getDashboard",
          requestId: "req_dashboard_failure",
          payload: { matchesLimit: 10, matchesFilter: "all" },
        },
        sessionUser,
        env,
      ),
    ).rejects.toThrow("Dashboard composition failed.");
  });
});
