import { renderSharedUserProfileScreen } from "../../../src/ui/features/profile/sharedRender";
import type { AchievementSummaryItem, GetSharedUserProfileData } from "../../../src/api/contract";

const createAchievement = ({ key, ...overrides }: Partial<AchievementSummaryItem> & { key: string }): AchievementSummaryItem => ({
  category: "activity",
  tier: "bronze",
  icon: "single_dot",
  unlockedAt: "2026-04-01T00:00:00.000Z",
  progressValue: 1,
  progressTarget: 1,
  titleKey: key,
  descriptionKey: `${key}.description`,
  points: 10,
  key,
  ...overrides,
});

const createProfile = (achievements: AchievementSummaryItem[]): GetSharedUserProfileData => ({
  user: {
    userId: "user_2",
    displayName: "Friend",
    avatarUrl: null,
    currentRank: 2,
    currentElo: 1234,
    bestWinStreak: 6,
  },
  achievements,
  activityHeatmap: {
    startDate: "2025-04-07",
    endDate: "2026-04-15",
    totalMatches: 2,
    totalWins: 1,
    totalLosses: 1,
    activeDays: 1,
    days: [{ date: "2026-04-05", matches: 2, wins: 1, losses: 1 }],
  },
  sharedUserProgressPoints: [
    {
      playedAt: "2026-04-05T09:00:00.000Z",
      elo: 1220,
      delta: 20,
      label: "2026-04-05T09:00:00.000Z",
      rank: null,
    },
  ],
  seasons: [],
  tournaments: [],
  matches: [],
  nextCursor: null,
  players: [],
  matchBracketContextByMatchId: {},
});

describe("shared profile render", () => {
  it("renders the shared profile best streak alongside elo", () => {
    const elo = document.createElement("span");
    const progressComparison = document.createElement("div");

    renderSharedUserProfileScreen({
      sharedUserProfile: createProfile([]),
      currentUserId: "user_1",
      meta: document.createElement("p"),
      avatar: document.createElement("img"),
      name: document.createElement("h4"),
      rank: document.createElement("span"),
      elo,
      achievementsSubtitle: document.createElement("p"),
      achievementsSummary: document.createElement("div"),
      achievementsPreview: document.createElement("div"),
      activityHeatmap: document.createElement("div"),
      progressComparison,
      currentUserDisplayName: "Owner",
      currentUserElo: 1250,
      currentUserProgressPoints: [
        {
          playedAt: "2026-04-04T09:00:00.000Z",
          elo: 1240,
          delta: 40,
          label: "2026-04-04T09:00:00.000Z",
          rank: null,
        },
      ],
      currentUserHasMatches: true,
      selectedAchievementKey: "",
      seasonsList: document.createElement("div"),
      tournamentsList: document.createElement("div"),
      matchesList: document.createElement("div"),
      loadMoreButton: document.createElement("button"),
      matchesLoading: false,
      avatarBaseUrl: "/",
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      locale: "en",
    });

    const chips = [...elo.querySelectorAll(".profile-stat-chip")].map((chip) => chip.textContent);
    expect(chips).toEqual(["Elo 1234", "progressBestStreak 6"]);
    expect(progressComparison.querySelectorAll(".progress-line--self")).toHaveLength(1);
    expect(progressComparison.querySelectorAll(".progress-line--shared")).toHaveLength(1);
  });

  it("renders a dotted comparison line for players without matches", () => {
    const progressComparison = document.createElement("div");

    renderSharedUserProfileScreen({
      sharedUserProfile: {
        ...createProfile([]),
        sharedUserProgressPoints: [],
      },
      currentUserId: "user_1",
      meta: document.createElement("p"),
      avatar: document.createElement("img"),
      name: document.createElement("h4"),
      rank: document.createElement("span"),
      elo: document.createElement("span"),
      achievementsSubtitle: document.createElement("p"),
      achievementsSummary: document.createElement("div"),
      achievementsPreview: document.createElement("div"),
      activityHeatmap: document.createElement("div"),
      progressComparison,
      currentUserDisplayName: "Owner",
      currentUserElo: 1250,
      currentUserProgressPoints: [
        {
          playedAt: "2026-04-04T09:00:00.000Z",
          elo: 1240,
          delta: 40,
          label: "2026-04-04T09:00:00.000Z",
          rank: null,
        },
      ],
      currentUserHasMatches: true,
      selectedAchievementKey: "",
      seasonsList: document.createElement("div"),
      tournamentsList: document.createElement("div"),
      matchesList: document.createElement("div"),
      loadMoreButton: document.createElement("button"),
      matchesLoading: false,
      avatarBaseUrl: "/",
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      locale: "en",
    });

    expect(progressComparison.querySelector(".progress-line--shared.progress-line--dotted")).not.toBeNull();
    expect(progressComparison.querySelector(".progress-line--self.progress-line--dotted")).toBeNull();
  });

  it("renders unlocked shared-profile achievements as icon buttons with no expanded list", () => {
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesList = document.createElement("div");
    const loadMoreButton = document.createElement("button");

    renderSharedUserProfileScreen({
      sharedUserProfile: createProfile([
        createAchievement({ key: "account_created", icon: "user_plus" }),
        createAchievement({ key: "first_match", icon: "ping_pong" }),
      ]),
      currentUserId: "user_1",
      meta: document.createElement("p"),
      avatar: document.createElement("img"),
      name: document.createElement("h4"),
      rank: document.createElement("span"),
      elo: document.createElement("span"),
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      activityHeatmap: document.createElement("div"),
      progressComparison: document.createElement("div"),
      currentUserDisplayName: "Owner",
      currentUserElo: 1250,
      currentUserProgressPoints: [],
      currentUserHasMatches: false,
      selectedAchievementKey: "",
      seasonsList,
      tournamentsList,
      matchesList,
      loadMoreButton,
      matchesLoading: false,
      avatarBaseUrl: "/",
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      locale: "en",
    });

    const icons = [...achievementsSummary.querySelectorAll<HTMLElement>("[data-achievement-key]")];
    expect(icons.map((icon) => icon.dataset.achievementKey)).toEqual(["account_created", "first_match"]);
    expect(achievementsSubtitle.textContent).toBe("achievementsTotalPointsLabel 20");
    expect(achievementsPreview.hidden).toBe(true);
    expect(achievementsSummary.querySelector(".achievement-card")).toBeNull();
  });

  it("renders the selected unlocked achievement in the shared-profile preview strip", () => {
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesList = document.createElement("div");
    const loadMoreButton = document.createElement("button");

    renderSharedUserProfileScreen({
      sharedUserProfile: createProfile([
        createAchievement({ key: "account_created", icon: "user_plus" }),
        createAchievement({ key: "first_match", icon: "ping_pong" }),
      ]),
      currentUserId: "user_1",
      meta: document.createElement("p"),
      avatar: document.createElement("img"),
      name: document.createElement("h4"),
      rank: document.createElement("span"),
      elo: document.createElement("span"),
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      activityHeatmap: document.createElement("div"),
      progressComparison: document.createElement("div"),
      currentUserDisplayName: "Owner",
      currentUserElo: 1250,
      currentUserProgressPoints: [],
      currentUserHasMatches: false,
      selectedAchievementKey: "first_match",
      seasonsList,
      tournamentsList,
      matchesList,
      loadMoreButton,
      matchesLoading: false,
      avatarBaseUrl: "/",
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      locale: "en",
    });

    expect(achievementsPreview.hidden).toBe(false);
    expect(achievementsPreview.querySelector(".profile-segment-card__title")?.textContent).toBe("first_match");
    expect(
      achievementsSummary.querySelector('[data-achievement-key="first_match"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("marks completed shared seasons and tournaments like the self profile", () => {
    const achievementsSubtitle = document.createElement("p");
    const achievementsSummary = document.createElement("div");
    const achievementsPreview = document.createElement("div");
    const seasonsList = document.createElement("div");
    const tournamentsList = document.createElement("div");
    const matchesList = document.createElement("div");
    const loadMoreButton = document.createElement("button");

    renderSharedUserProfileScreen({
      sharedUserProfile: {
        ...createProfile([]),
        seasons: [
          {
            season: {
              id: "season_1",
              name: "Completed Season",
              startDate: "2026-03-01",
              endDate: "2026-03-31",
              isActive: false,
              status: "completed",
              baseEloMode: "carry_over",
              participantIds: ["user_1", "user_2"],
              isPublic: true,
              createdByUserId: "user_1",
              createdAt: "2026-03-01T00:00:00.000Z",
              completedAt: "2026-03-31T00:00:00.000Z",
            },
            summary: {
              segmentType: "season",
              segmentId: "season_1",
              wins: 5,
              losses: 2,
              rank: 1,
              participantCount: 2,
            },
          },
        ],
        tournaments: [
          {
            tournament: {
              id: "tournament_1",
              name: "Completed Cup",
              date: "2026-03-15",
              seasonId: null,
              seasonName: null,
              participantIds: ["user_1", "user_2"],
              participantCount: 2,
              status: "completed",
              bracketStatus: "completed",
              createdByUserId: "user_1",
              createdAt: "2026-03-01T00:00:00.000Z",
              completedAt: "2026-03-15T00:00:00.000Z",
            },
            summary: {
              segmentType: "tournament",
              segmentId: "tournament_1",
              wins: 2,
              losses: 1,
              rank: 2,
              participantCount: 2,
            },
          },
        ],
      },
      currentUserId: "user_1",
      meta: document.createElement("p"),
      avatar: document.createElement("img"),
      name: document.createElement("h4"),
      rank: document.createElement("span"),
      elo: document.createElement("span"),
      achievementsSubtitle,
      achievementsSummary,
      achievementsPreview,
      activityHeatmap: document.createElement("div"),
      progressComparison: document.createElement("div"),
      currentUserDisplayName: "Owner",
      currentUserElo: 1250,
      currentUserProgressPoints: [],
      currentUserHasMatches: false,
      selectedAchievementKey: "",
      seasonsList,
      tournamentsList,
      matchesList,
      loadMoreButton,
      matchesLoading: false,
      avatarBaseUrl: "/",
      t: (key) => key,
      renderMatchScore: () => "",
      renderPlayerNames: () => "",
      renderMatchContext: () => "",
      formatDateTime: (value) => value,
      onOpenSeason: () => undefined,
      onOpenTournament: () => undefined,
      locale: "en",
    });

    const completedSeason = seasonsList.querySelector<HTMLButtonElement>(".profile-segment-card");
    const completedTournament = tournamentsList.querySelector<HTMLButtonElement>(".profile-segment-card");

    expect(completedSeason?.classList.contains("profile-segment-card--completed")).toBe(true);
    expect(completedSeason?.disabled).toBe(true);
    expect(seasonsList.querySelector(".profile-segment-card__medal")?.textContent).toBe("🥇");

    expect(completedTournament?.classList.contains("profile-segment-card--completed")).toBe(true);
    expect(completedTournament?.disabled).toBe(true);
    expect(tournamentsList.querySelector(".profile-segment-card__medal")?.textContent).toBe("🥈");
  });
});
