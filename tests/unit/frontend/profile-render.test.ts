import { renderProfileScreen } from "../../../src/ui/features/profile/render";
import type { AchievementSummaryItem, MatchRecord } from "../../../src/api/contract";
import type { DashboardState } from "../../../src/ui/shared/types/app";

const createAchievement = (overrides: Partial<AchievementSummaryItem> & { key: string }): AchievementSummaryItem => ({
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

const createMatch = (id: string): MatchRecord => ({
  id,
  matchType: "singles",
  formatType: "best_of_3",
  seasonId: null,
  tournamentId: null,
  teamAPlayerIds: ["user_1"],
  teamBPlayerIds: ["user_2"],
  winnerTeam: "A",
  score: [],
  pointsToWin: 11,
  playedAt: "2026-04-01T00:00:00.000Z",
  status: "active",
  createdAt: "2026-04-01T00:00:00.000Z",
  createdByUserId: "user_1",
  bracketContext: null,
});

describe("profile render", () => {
  it("sorts visible achievements by unlocked state first and points ascending within each group", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
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
      profileRecentlySeenAchievementKeys: [],
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
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
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
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    const titles = [...achievementsList.querySelectorAll(".profile-segment-card__title")].map((node) => node.textContent);
    expect(titles).toEqual(["unlocked_low", "unlocked_high", "locked_low", "locked_high"]);
    expect(achievementsTitle.textContent).toBe("achievementsTitle");
    expect(achievementsSubtitle.textContent).toBe("achievementsTotalPointsLabel 60");
    expect(achievementsPreview.hidden).toBe(true);
    expect(achievementsUnread.hidden).toBe(true);
  });

  it("shows unread unlocked achievements in the summary without duplicating them in the profile list", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
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
        recentUnlocks: [
          createAchievement({ key: "unlocked_new", points: 20, unlockedAt: "2026-04-02T00:00:00.000Z" }),
        ],
        featured: [],
        nextUp: null,
      },
      profileAchievementsExpanded: true,
      profileSelectedAchievementKey: "",
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
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
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
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    const summaryTitles = [...achievementsSummary.querySelectorAll(".achievement-card__icon")].map((node) => node.getAttribute("aria-label"));
    const unreadTitles = [...achievementsUnread.querySelectorAll(".profile-segment-card__title")].map((node) => node.textContent);
    const titles = [...achievementsList.querySelectorAll(".profile-segment-card__title")].map((node) => node.textContent);
    expect(titles).toEqual(["unlocked_seen", "locked_mid"]);
    expect(summaryTitles).toEqual(["unlocked_seen", "unlocked_new"]);
    expect(unreadTitles).toEqual(["unlocked_new"]);
    expect(achievementsPreview.hidden).toBe(true);
    expect(achievementsUnread.hidden).toBe(false);
  });

  it("renders the selected unlocked achievement in the preview strip", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const dashboardState = {
      achievements: {
        totalUnlocked: 2,
        totalAvailable: 3,
        score: 30,
        items: [
          createAchievement({ key: "account_created", icon: "user_plus", points: 10, unlockedAt: "2026-04-01T00:00:00.000Z" }),
          createAchievement({ key: "first_match", icon: "ping_pong", points: 20, unlockedAt: "2026-04-02T00:00:00.000Z" }),
          createAchievement({ key: "locked_mid", points: 15 }),
        ],
        recentUnlocks: [],
        featured: [],
        nextUp: null,
      },
      profileAchievementsExpanded: false,
      profileSelectedAchievementKey: "account_created",
      profileRecentlySeenAchievementKeys: [],
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
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
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
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    expect(achievementsPreview.hidden).toBe(false);
    expect(achievementsPreview.querySelector(".profile-segment-card__title")?.textContent).toBe("account_created");
    expect(
      achievementsSummary.querySelector('[data-achievement-key="account_created"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(achievementsPreview.parentElement).toBe(achievementsSummary);
    expect(achievementsList.hidden).toBe(true);
  });

  it("shows the latest 8 profile matches and toggles load more from the cursor", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const dashboardState = {
      achievements: null,
      profileAchievementsExpanded: false,
      profileSelectedAchievementKey: "",
      profileRecentlySeenAchievementKeys: [],
      seasons: [],
      tournaments: [],
      profileMatches: Array.from({ length: 8 }, (_, index) => createMatch(`match_${index + 1}`)),
      profileMatchesCursor: "next-page",
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: (match) => match.id,
      renderPlayerNames: (playerIds) => playerIds.join(", "),
      renderMatchContext: () => "context",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    expect(matchesList.querySelectorAll(".profile-match-card")).toHaveLength(8);
    expect(matchesList.textContent).toContain("match_1");
    expect(matchesList.textContent).toContain("match_8");
    expect(matchesList.textContent).not.toContain("match_9");
    expect(loadMoreButton.hidden).toBe(false);
    expect(loadMoreButton.disabled).toBe(false);
  });

  it("renders collapsed rating-impact details per profile match", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const match = createMatch("match_with_impact");
    match.seasonId = "season_1";
    match.ratingImpact = {
      userId: "user_1",
      globalDelta: 14,
      globalBefore: 1210,
      globalAfter: 1224,
      globalGap: -45,
      seasonScoreDelta: 9,
      seasonGap: -38,
      expectedWinProbability: 0.38,
      effectiveKFactor: 24,
      outcome: "win",
      seasonBreakdown: {
        expectedWinProbability: 0.44,
        ratingBefore: 1200,
        ratingAfter: 1213.4,
        rdBefore: 350,
        rdAfter: 331.2,
        conservativeBefore: 500,
        conservativeAfter: 551,
        attendancePenaltyBefore: 0,
        attendancePenaltyAfter: 0,
        scoreBefore: 500,
        scoreAfter: 551,
      },
    };

    const dashboardState = {
      achievements: null,
      profileAchievementsExpanded: false,
      profileSelectedAchievementKey: "",
      profileRecentlySeenAchievementKeys: [],
      seasons: [
        {
          id: "season_1",
          name: "Spring",
          startDate: "2026-04-01",
          endDate: null,
          isActive: true,
          status: "active",
          baseEloMode: "carry_over",
          participantIds: ["user_1", "user_2"],
          createdByUserId: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          completedAt: null,
          isPublic: false,
        },
      ],
      tournaments: [],
      profileMatches: [match],
      profileMatchesCursor: null,
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: () => "11-9",
      renderPlayerNames: (playerIds) => playerIds.join(", "),
      renderMatchContext: () => "context",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    const details = matchesList.querySelector("details.profile-match-impact");
    expect(details).not.toBeNull();
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.querySelectorAll(".profile-match-impact__group")).toHaveLength(2);
    expect(details?.textContent).toContain("profileMatchImpactGlobal");
    expect(details?.textContent).toContain("profileMatchImpactSeason");
    expect(details?.textContent).toContain("profileMatchImpactWeight");
    expect(details?.textContent).toContain("1 (matchTypeSingles)");
    expect(details?.textContent).not.toContain("profileMatchImpactWeightMeaning");
    expect(details?.textContent).toContain("profileMatchImpactGlobalPointsSimple 1210 -> 1224 (+14)");
    expect(details?.textContent).toContain("profileMatchImpactGlobalGapSimple profileMatchImpactGapYou -45");
    expect(details?.textContent).toContain("profileMatchImpactSeasonScoreSimple 500 -> 551 (+9)");
    expect(details?.textContent).toContain("profileMatchImpactSeasonGapSimple profileMatchImpactGapYou -38");
    expect(details?.textContent).toContain("38%");
    expect(details?.textContent).not.toContain("profileMatchImpactSensitivitySimple");
    expect(details?.textContent).toContain("profileMatchImpactReasonUnderdogWin");
    expect(details?.textContent).toContain("profileMatchImpactSeasonExpectedChance");
    expect(details?.textContent).toContain("profileMatchImpactReasonUnderdogWin");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonSkillSimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonPenaltySimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonFormulaSimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonNoPenaltySimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonUncertaintySimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonMeaning");
  });

  it("shows attendance penalty rows only when season penalty exists", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const match = createMatch("match_with_penalty");
    match.seasonId = "season_1";
    match.ratingImpact = {
      userId: "user_1",
      globalDelta: -8,
      globalBefore: 1280,
      globalAfter: 1272,
      globalGap: 31,
      seasonScoreDelta: -12,
      seasonGap: 26,
      expectedWinProbability: 0.69,
      effectiveKFactor: 24,
      outcome: "loss",
      seasonBreakdown: {
        expectedWinProbability: 0.61,
        ratingBefore: 1220,
        ratingAfter: 1207.2,
        rdBefore: 320,
        rdAfter: 306.1,
        conservativeBefore: 580,
        conservativeAfter: 595,
        attendancePenaltyBefore: 80,
        attendancePenaltyAfter: 120,
        scoreBefore: 500,
        scoreAfter: 475,
      },
    };

    const dashboardState = {
      achievements: null,
      profileAchievementsExpanded: false,
      profileSelectedAchievementKey: "",
      profileRecentlySeenAchievementKeys: [],
      seasons: [
        {
          id: "season_1",
          name: "Spring",
          startDate: "2026-04-01",
          endDate: null,
          isActive: true,
          status: "active",
          baseEloMode: "carry_over",
          participantIds: ["user_1", "user_2"],
          createdByUserId: "user_1",
          createdAt: "2026-04-01T00:00:00.000Z",
          completedAt: null,
          isPublic: false,
        },
      ],
      tournaments: [],
      profileMatches: [match],
      profileMatchesCursor: null,
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: () => "11-7",
      renderPlayerNames: (playerIds) => playerIds.join(", "),
      renderMatchContext: () => "context",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    const details = matchesList.querySelector("details.profile-match-impact");
    expect(details?.textContent).toContain("profileMatchImpactSeasonPenaltySimple");
    expect(details?.textContent).toContain("profileMatchImpactSeasonFormulaSimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonSkillSimple");
    expect(details?.textContent).not.toContain("profileMatchImpactSeasonNoPenaltySimple");
  });

  it("shows appended profile matches after loading more", () => {
    const achievementsTitle = document.createElement("h4");
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const achievementsUnread = document.createElement("div");
    const achievementsToggle = document.createElement("button");
    const achievementsList = document.createElement("div");
    const activityHeatmap = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesSummary = document.createElement("div");
    const matchFilterAllButton = document.createElement("button");
    const matchFilterSinglesButton = document.createElement("button");
    const matchFilterDoublesButton = document.createElement("button");
    const matchesList = document.createElement("div");
    const status = document.createElement("p");
    const loadMoreButton = document.createElement("button");

    const dashboardState = {
      achievements: null,
      profileAchievementsExpanded: false,
      profileSelectedAchievementKey: "",
      profileRecentlySeenAchievementKeys: [],
      seasons: [],
      tournaments: [],
      profileMatches: Array.from({ length: 14 }, (_, index) => createMatch(`match_${index + 1}`)),
      profileMatchesCursor: "next-page",
      profileMatchesLoading: false,
      profileLoading: false,
      profileSegmentSummaries: {},
      profileSegmentSummaryLoadingKeys: [],
      players: [],
      matchBracketContextByMatchId: {},
    } as unknown as DashboardState;

    renderProfileScreen({
      dashboardState,
      currentUserDisplayName: "user_1",
      achievementsTitle,
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      achievementsUnread,
      achievementsToggle,
      achievementsList,
      activityHeatmap,
      currentUserId: "user_1",
      seasonsList,
      tournamentsList,
      matchesSummary,
      matchFilterAllButton,
      matchFilterSinglesButton,
      matchFilterDoublesButton,
      matchesList,
      status,
      loadMoreButton,
      t: (key) => key,
      renderMatchScore: (match) => match.id,
      renderPlayerNames: (playerIds) => playerIds.join(", "),
      renderMatchContext: () => "context",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      onLoadMoreMatches: () => undefined,
      onProfileMatchFilterChange: () => undefined,
      locale: "en",
    });

    expect(matchesList.querySelectorAll(".profile-match-card")).toHaveLength(14);
    expect(matchesList.textContent).toContain("match_14");
    expect(loadMoreButton.hidden).toBe(false);
  });
});
