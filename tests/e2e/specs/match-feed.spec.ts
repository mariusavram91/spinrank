import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  AchievementOverview,
  ApiResponse,
  GetDashboardData,
  GetMatchesData,
  GetUserProgressData,
  LeaderboardEntry,
  MatchFeedFilter,
  MatchRecord,
} from "../../../src/api/contract";
import { gotoDashboard } from "../helpers/dashboard";
import { createTestToken, signInAsPersona } from "../helpers/personas";

const TIMESTAMP = "2026-04-10T10:00:00.000Z";

type FeedScenario = "mine-vs-recent" | "empty-filters" | "recent-short-list";

const makePlayer = (
  userId: string,
  displayName: string,
  rank: number,
  elo = 1200,
): LeaderboardEntry => ({
  userId,
  displayName,
  avatarUrl: null,
  elo,
  wins: Math.max(0, 5 - rank),
  losses: Math.max(0, rank - 1),
  streak: 0,
  rank,
});

const makeMatch = (args: {
  id: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  createdByUserId: string;
  playedAt: string;
  winnerTeam?: "A" | "B";
}): MatchRecord => ({
  id: args.id,
  matchType: "singles",
  formatType: "single_game",
  pointsToWin: 11,
  teamAPlayerIds: args.teamAPlayerIds,
  teamBPlayerIds: args.teamBPlayerIds,
  score: [{ teamA: args.winnerTeam === "B" ? 8 : 11, teamB: args.winnerTeam === "B" ? 11 : 7 }],
  winnerTeam: args.winnerTeam ?? "A",
  playedAt: args.playedAt,
  seasonId: null,
  tournamentId: null,
  createdByUserId: args.createdByUserId,
  status: "active",
  createdAt: args.playedAt,
});

const emptyProgress: GetUserProgressData = {
  currentRank: 1,
  currentElo: 1200,
  bestRank: 1,
  bestElo: 1200,
  currentStreak: 0,
  bestStreak: 0,
  wins: 0,
  losses: 0,
  singles: { matches: 0, wins: 0, losses: 0 },
  doubles: { matches: 0, wins: 0, losses: 0 },
  points: [],
  activityHeatmap: null,
};

const emptyAchievements: AchievementOverview = {
  totalUnlocked: 0,
  totalAvailable: 0,
  score: 0,
  items: [],
  recentUnlocks: [],
  featured: [],
  nextUp: null,
};

const buildDashboardData = (args: {
  players: LeaderboardEntry[];
  matches: MatchRecord[];
  nextCursor?: string | null;
}): GetDashboardData => ({
  seasons: [],
  tournaments: [],
  leaderboard: args.players.slice(0, 3),
  players: args.players,
  leaderboardUpdatedAt: TIMESTAMP,
  userProgress: emptyProgress,
  achievements: emptyAchievements,
  matches: args.matches,
  nextCursor: args.nextCursor ?? null,
  matchBracketContextByMatchId: {},
});

const fulfillApi = async <T>(route: Route, requestId: string, data: T): Promise<void> => {
  const response: ApiResponse<T> = {
    ok: true,
    data,
    error: null,
    requestId,
  };
  await route.fulfill({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(response),
  });
};

async function stubMatchFeed(page: Page, ownerId: string, ownerName: string, scenario: FeedScenario): Promise<void> {
  const owner = makePlayer(ownerId, ownerName, 1, 1230);
  const rival = makePlayer(`${ownerId}-rival`, "Feed Rival", 2, 1210);
  const mineOne = makeMatch({
    id: "mine-1",
    teamAPlayerIds: [owner.userId],
    teamBPlayerIds: [rival.userId],
    createdByUserId: owner.userId,
    playedAt: "2026-04-10T08:00:00.000Z",
  });
  const mineTwo = makeMatch({
    id: "mine-2",
    teamAPlayerIds: [rival.userId],
    teamBPlayerIds: [owner.userId],
    createdByUserId: owner.userId,
    playedAt: "2026-04-09T08:00:00.000Z",
    winnerTeam: "B",
  });

  const recentPlayers = [
    makePlayer("recent-a", "Recent Alpha", 3, 1270),
    makePlayer("recent-b", "Recent Bravo", 4, 1260),
    makePlayer("recent-c", "Recent Charlie", 5, 1250),
    makePlayer("recent-d", "Recent Delta", 6, 1240),
    makePlayer("recent-e", "Recent Echo", 7, 1235),
    makePlayer("recent-f", "Recent Foxtrot", 8, 1225),
    makePlayer("recent-g", "Recent Golf", 9, 1215),
    makePlayer("recent-h", "Recent Hotel", 10, 1205),
  ];

  const recentPageOne = [
    makeMatch({
      id: "recent-1",
      teamAPlayerIds: ["recent-a"],
      teamBPlayerIds: ["recent-b"],
      createdByUserId: "recent-a",
      playedAt: "2026-04-10T09:00:00.000Z",
    }),
    makeMatch({
      id: "recent-2",
      teamAPlayerIds: ["recent-c"],
      teamBPlayerIds: ["recent-d"],
      createdByUserId: "recent-c",
      playedAt: "2026-04-10T08:45:00.000Z",
    }),
    makeMatch({
      id: "recent-3",
      teamAPlayerIds: ["recent-e"],
      teamBPlayerIds: ["recent-f"],
      createdByUserId: "recent-e",
      playedAt: "2026-04-10T08:30:00.000Z",
    }),
    makeMatch({
      id: "recent-4",
      teamAPlayerIds: ["recent-g"],
      teamBPlayerIds: ["recent-h"],
      createdByUserId: "recent-g",
      playedAt: "2026-04-10T08:15:00.000Z",
    }),
  ];

  const recentPageTwo = [
    makeMatch({
      id: "recent-5",
      teamAPlayerIds: ["recent-a"],
      teamBPlayerIds: ["recent-c"],
      createdByUserId: "recent-a",
      playedAt: "2026-04-10T08:00:00.000Z",
    }),
    makeMatch({
      id: "recent-6",
      teamAPlayerIds: ["recent-b"],
      teamBPlayerIds: ["recent-d"],
      createdByUserId: "recent-b",
      playedAt: "2026-04-10T07:45:00.000Z",
      winnerTeam: "B",
    }),
    makeMatch({
      id: "recent-7",
      teamAPlayerIds: ["recent-e"],
      teamBPlayerIds: ["recent-g"],
      createdByUserId: "recent-e",
      playedAt: "2026-04-10T07:30:00.000Z",
    }),
  ];

  const shortRecentPlayers = [
    makePlayer("short-a", "Short Recent Alpha", 3, 1240),
    makePlayer("short-b", "Short Recent Bravo", 4, 1230),
    makePlayer("short-c", "Short Recent Charlie", 5, 1220),
    makePlayer("short-d", "Short Recent Delta", 6, 1210),
    makePlayer("short-e", "Short Recent Echo", 7, 1200),
    makePlayer("short-f", "Short Recent Foxtrot", 8, 1190),
  ];

  const shortRecentMatches = [
    makeMatch({
      id: "short-1",
      teamAPlayerIds: ["short-a"],
      teamBPlayerIds: ["short-b"],
      createdByUserId: "short-a",
      playedAt: "2026-04-10T06:00:00.000Z",
    }),
    makeMatch({
      id: "short-2",
      teamAPlayerIds: ["short-c"],
      teamBPlayerIds: ["short-d"],
      createdByUserId: "short-c",
      playedAt: "2026-04-10T05:45:00.000Z",
    }),
    makeMatch({
      id: "short-3",
      teamAPlayerIds: ["short-e"],
      teamBPlayerIds: ["short-f"],
      createdByUserId: "short-e",
      playedAt: "2026-04-10T05:30:00.000Z",
    }),
  ];

  await page.route("**/api", async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    const body = request.postDataJSON();
    if (body?.action === "getDashboard") {
      if (scenario === "mine-vs-recent") {
        await fulfillApi(route, body.requestId, buildDashboardData({
          players: [owner, rival],
          matches: [mineOne, mineTwo],
        }));
        return;
      }

      await fulfillApi(route, body.requestId, buildDashboardData({
        players: [owner],
        matches: [],
      }));
      return;
    }

    if (body?.action === "getMatches") {
      const filter = body.payload?.filter as MatchFeedFilter | undefined;
      const cursor = typeof body.payload?.cursor === "string" ? body.payload.cursor : null;

      if (scenario === "mine-vs-recent" && filter === "recent" && !cursor) {
        await fulfillApi<GetMatchesData>(route, body.requestId, {
          matches: recentPageOne,
          nextCursor: "recent-page-2",
          players: recentPlayers,
        });
        return;
      }

      if (scenario === "mine-vs-recent" && filter === "recent" && cursor === "recent-page-2") {
        await fulfillApi<GetMatchesData>(route, body.requestId, {
          matches: recentPageTwo,
          nextCursor: null,
          players: recentPlayers,
        });
        return;
      }

      if (scenario === "empty-filters" && filter === "recent") {
        await fulfillApi<GetMatchesData>(route, body.requestId, {
          matches: [],
          nextCursor: null,
          players: [],
        });
        return;
      }

      if (scenario === "recent-short-list" && filter === "recent") {
        await fulfillApi<GetMatchesData>(route, body.requestId, {
          matches: shortRecentMatches,
          nextCursor: null,
          players: shortRecentPlayers,
        });
        return;
      }
    }

    await route.continue();
  });
}

test.describe("match feed", () => {
  test("switches between mine and recent and paginates recent results", async ({ page, request }) => {
    const token = createTestToken("match-feed-paginated");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Match Feed Owner",
    });

    await stubMatchFeed(page, owner.session.user.id, owner.session.user.displayName, "mine-vs-recent");
    await gotoDashboard(page);

    await expect(page.getByTestId("matches-filter-mine")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("matches-list").locator(".match-row")).toHaveCount(2);
    await expect(page.getByTestId("matches-list")).toContainText("Feed Rival");
    await expect(page.getByTestId("matches-load-more")).toBeHidden();

    await page.getByTestId("matches-filter-recent").click();

    await expect(page.getByTestId("matches-filter-recent")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("matches-list").locator(".match-row")).toHaveCount(4);
    await expect(page.getByTestId("matches-list")).toContainText("Recent Alpha");
    await expect(page.getByTestId("matches-list")).not.toContainText("Feed Rival");
    await expect(page.getByTestId("matches-load-more")).toBeVisible();

    await page.getByTestId("matches-load-more").click();

    await expect(page.getByTestId("matches-list").locator(".match-row")).toHaveCount(7);
    await expect(page.getByTestId("matches-list")).toContainText("Recent Golf");
    await expect(page.getByTestId("matches-load-more")).toBeHidden();
  });

  test("renders distinct empty states for mine and recent filters", async ({ page, request }) => {
    const token = createTestToken("match-feed-empty");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Empty Match Feed Owner",
    });

    await stubMatchFeed(page, owner.session.user.id, owner.session.user.displayName, "empty-filters");
    await gotoDashboard(page);

    await expect(page.getByTestId("matches-filter-mine")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("matches-list")).toContainText("No matches involving you yet.");

    await page.getByTestId("matches-filter-recent").click();

    await expect(page.getByTestId("matches-filter-recent")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("matches-list")).toContainText("No recent matches yet.");
    await expect(page.getByTestId("matches-load-more")).toBeHidden();
  });

  test("keeps short recent result sets fully visible without a load-more affordance", async ({ page, request }) => {
    const token = createTestToken("match-feed-short");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Short Match Feed Owner",
    });

    await stubMatchFeed(page, owner.session.user.id, owner.session.user.displayName, "recent-short-list");
    await gotoDashboard(page);
    await page.getByTestId("matches-filter-recent").click();

    await expect(page.getByTestId("matches-list").locator(".match-row")).toHaveCount(3);
    await expect(page.getByTestId("matches-list")).toContainText("Short Recent Alpha");
    await expect(page.getByTestId("matches-list")).toContainText("Short Recent Echo");
    await expect(page.getByTestId("matches-load-more")).toBeHidden();
  });
});
