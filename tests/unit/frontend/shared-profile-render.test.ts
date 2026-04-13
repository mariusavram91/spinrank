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
  },
  achievements,
  seasons: [],
  tournaments: [],
  matches: [],
  nextCursor: null,
  players: [],
  matchBracketContextByMatchId: {},
});

describe("shared profile render", () => {
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
