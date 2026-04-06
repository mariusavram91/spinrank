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
  DB: {
    batch: vi.fn(async () => []),
    prepare: vi.fn(() => ({
      bind() {
        return this;
      },
      first: async () => null,
      all: async () => ({ results: [] }),
    })),
  },
  runtime: {
    nowIso: () => "2026-04-06T12:00:00.000Z",
  },
} as Env;

describe("worker getDashboard action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

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
        players: [{ userId: "user_2", rank: 2 }],
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
        payload: { filter: "recent", limit: 4, mode: "dashboard_preview" },
      }),
      sessionUser,
      env,
    );
    expect(handleGetUserProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "getUserProgress",
        payload: { mode: "summary" },
      }),
      sessionUser,
      env,
    );
    expect(handleGetLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "getLeaderboard",
        payload: { mode: "dashboard_preview" },
      }),
      sessionUser,
      env,
    );
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({
      seasons: [{ id: "season_1", name: "Spring" }],
      tournaments: [{ id: "tournament_1", name: "Cup" }],
      leaderboard: [{ userId: "user_1", rank: 1 }],
      players: [{ userId: "user_1", rank: 1 }, { userId: "user_2", rank: 2 }],
      leaderboardUpdatedAt: "2026-04-06T12:00:00.000Z",
      userProgress: { currentRank: 1 },
      achievements: {
        totalUnlocked: 0,
        totalAvailable: 0,
        score: 0,
        items: [],
        recentUnlocks: [],
        featured: [],
        nextUp: null,
      },
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

  it("forwards explicit match feed options and preserves leaderboard timestamps", async () => {
    vi.mocked(handleGetSeasons).mockResolvedValue({ ok: true, data: { seasons: [] } } as never);
    vi.mocked(handleGetTournaments).mockResolvedValue({ ok: true, data: { tournaments: [] } } as never);
    vi.mocked(handleGetLeaderboard).mockResolvedValue({
      ok: true,
      data: {
        leaderboard: [{ userId: "user_1", rank: 1 }],
        updatedAt: "2026-04-05T10:00:00.000Z",
      },
    } as never);
    vi.mocked(handleGetMatches).mockResolvedValue({
      ok: true,
      data: {
        matches: [{ id: "match_9", bracketContext: null }],
        players: [{ userId: "user_9", rank: 9 }],
        nextCursor: "cursor_2",
      },
    } as never);
    vi.mocked(handleGetUserProgress).mockResolvedValue({
      ok: true,
      data: { currentRank: 1, currentElo: 1210 },
    } as never);

    const response = await handleGetDashboard(
      {
        action: "getDashboard",
        requestId: "req_dashboard_custom_feed",
        payload: { matchesLimit: 9, matchesFilter: "mine" },
      },
      sessionUser,
      env,
    );

    expect(handleGetMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "getMatches",
        payload: { filter: "mine", limit: 9, mode: "dashboard_preview" },
      }),
      sessionUser,
      env,
    );
    expect(response.ok).toBe(true);
    expect(response.data?.leaderboardUpdatedAt).toBe("2026-04-05T10:00:00.000Z");
    expect(response.data?.nextCursor).toBe("cursor_2");
    expect(response.data?.matches).toEqual([{ id: "match_9", bracketContext: null }]);
    expect(response.data?.players).toEqual([{ userId: "user_1", rank: 1 }, { userId: "user_9", rank: 9 }]);
  });

  it("starts dashboard subrequests in parallel so composition does not serialize slow reads", async () => {
    const seasons = deferred<any>();
    const tournaments = deferred<any>();
    const leaderboard = deferred<any>();
    const matches = deferred<any>();
    const userProgress = deferred<any>();

    vi.mocked(handleGetSeasons).mockReturnValue(seasons.promise);
    vi.mocked(handleGetTournaments).mockReturnValue(tournaments.promise);
    vi.mocked(handleGetLeaderboard).mockReturnValue(leaderboard.promise);
    vi.mocked(handleGetMatches).mockReturnValue(matches.promise);
    vi.mocked(handleGetUserProgress).mockReturnValue(userProgress.promise);

    const responsePromise = handleGetDashboard(
      {
        action: "getDashboard",
        requestId: "req_dashboard_parallel_reads",
        payload: {},
      },
      sessionUser,
      env,
    );

    expect(handleGetSeasons).toHaveBeenCalledTimes(1);
    expect(handleGetTournaments).toHaveBeenCalledTimes(1);
    expect(handleGetLeaderboard).toHaveBeenCalledTimes(1);
    expect(handleGetMatches).toHaveBeenCalledTimes(1);
    expect(handleGetUserProgress).toHaveBeenCalledTimes(1);

    seasons.resolve({ ok: true, data: { seasons: [] } } as never);
    tournaments.resolve({ ok: true, data: { tournaments: [] } } as never);
    leaderboard.resolve({ ok: true, data: { leaderboard: [] } } as never);
    matches.resolve({ ok: true, data: { matches: [], nextCursor: null } } as never);
    userProgress.resolve({ ok: true, data: { currentRank: 1, currentElo: 1200 } } as never);

    const response = await responsePromise;
    expect(response.ok).toBe(true);
  });
});
