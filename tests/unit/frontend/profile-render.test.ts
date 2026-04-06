import { renderProfileScreen } from "../../../src/ui/features/profile/render";
import type { AchievementSummaryItem } from "../../../src/api/contract";
import type { DashboardState } from "../../../src/ui/shared/types/app";

const createAchievement = (overrides: Partial<AchievementSummaryItem> & { key: string }): AchievementSummaryItem => ({
  key: overrides.key,
  category: "activity",
  tier: "bronze",
  icon: "single_dot",
  unlockedAt: null,
  progressValue: 0,
  progressTarget: 10,
  titleKey: overrides.key,
  descriptionKey: `${overrides.key}_desc`,
  points: 1,
  ...overrides,
});

describe("profile render", () => {
  it("sorts visible achievements by unlocked state and points ascending within each group", () => {
    const achievementsSummary = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const dashboardState = {
      achievements: {
        totalUnlocked: 2,
        totalAvailable: 4,
        score: 60,
        items: [
          createAchievement({ key: "locked_low", points: 5 }),
          createAchievement({ key: "unlocked_low", points: 10, unlockedAt: "2026-04-01T00:00:00.000Z" }),
          createAchievement({ key: "locked_high", points: 25 }),
          createAchievement({ key: "unlocked_high", points: 50, unlockedAt: "2026-04-02T00:00:00.000Z" }),
        ],
        recentUnlocks: [],
        featured: [],
        nextUp: null,
      },
      profileAchievementsExpanded: true,
      profileRecentlySeenAchievementKeys: ["unlocked_low", "unlocked_high"],
      seasons: [],
      tournaments: [],
      profileMatches: [],
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      achievementsSummary,
      achievementsToggle,
      achievementsList,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
    });

    const titles = [...achievementsList.querySelectorAll(".profile-segment-card__title")].map((node) => node.textContent);
    expect(titles).toEqual(["unlocked_low", "unlocked_high", "locked_low", "locked_high"]);
  });

  it("hides previously seen unlocked achievements from the profile list", () => {
    const achievementsSummary = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const dashboardState = {
      achievements: {
        totalUnlocked: 2,
        totalAvailable: 3,
        score: 60,
        items: [
          createAchievement({ key: "locked_mid", points: 15 }),
          createAchievement({ key: "unlocked_seen", points: 10, unlockedAt: "2026-04-01T00:00:00.000Z" }),
          createAchievement({ key: "unlocked_new", points: 20, unlockedAt: "2026-04-02T00:00:00.000Z" }),
        ],
        recentUnlocks: [],
        featured: [],
        nextUp: null,
      },
      profileAchievementsExpanded: true,
      profileRecentlySeenAchievementKeys: ["unlocked_new"],
      seasons: [],
      tournaments: [],
      profileMatches: [],
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      achievementsSummary,
      achievementsToggle,
      achievementsList,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
    });

    const titles = [...achievementsList.querySelectorAll(".profile-segment-card__title")].map((node) => node.textContent);
    expect(titles).toEqual(["unlocked_new", "locked_mid"]);
  });
});
