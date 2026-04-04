import type { MatchRecord, SeasonRecord, TournamentRecord } from "../../../src/api/contract";
import {
  renderMatchContext,
  shouldShowSeasonInDropdown,
  shouldShowTournamentInDropdown,
  getWinnerLabel,
  matchFilterLabels,
  getMatchLimitForFilter,
} from "../../../src/ui/features/app/helpers";

const currentDateIso = "2026-04-05T00:00:00.000Z";
const currentUserId = "user_main";

const buildSeason = (overrides: Partial<SeasonRecord> = {}): SeasonRecord => ({
  id: "season_1",
  name: "Spring League",
  startDate: "2026-01-01",
  endDate: "2026-03-01",
  isActive: true,
  status: "active",
  baseEloMode: "carry_over",
  participantIds: [currentUserId],
  createdByUserId: currentUserId,
  createdAt: currentDateIso,
  completedAt: null,
  isPublic: false,
  ...overrides,
});

const buildTournament = (overrides: Partial<TournamentRecord> = {}): TournamentRecord => {
  const base: TournamentRecord = {
    id: "tournament_1",
    name: "Cup Finals",
    date: "2026-03-15",
    status: "active",
    seasonId: "season_1",
    createdByUserId: currentUserId,
    createdAt: currentDateIso,
    completedAt: null,
    seasonName: null,
    participantCount: 0,
    participantIds: [],
    bracketStatus: "draft",
  };

  return {
    ...base,
    ...overrides,
    participantIds: overrides.participantIds ?? base.participantIds,
  };
};

describe("app helpers", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(currentDateIso));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns winner labels based on team selection", () => {
    expect(getWinnerLabel("A", "Alpha", "Beta")).toBe("Alpha");
    expect(getWinnerLabel("B", "Alpha", "Beta")).toBe("Beta");
  });

  it("considers active or associated seasons visible", () => {
    const season = buildSeason({ status: "active", isActive: true, participantIds: [currentUserId] });
    expect(shouldShowSeasonInDropdown(season, currentUserId)).toBe(true);
  });

  it("hides completed seasons that finished before the recent window", () => {
    const season = buildSeason({
      status: "completed",
      endDate: "2025-11-01",
      isActive: false,
    });
    expect(shouldShowSeasonInDropdown(season, currentUserId)).toBe(false);
  });

  it("shows completed seasons within the recent window if associated", () => {
    const season = buildSeason({
      status: "completed",
      endDate: "2026-03-10",
      isActive: false,
    });
    expect(shouldShowSeasonInDropdown(season, currentUserId)).toBe(true);
  });

  it("hides seasons the user is not associated with", () => {
    const season = buildSeason({
      participantIds: ["other"],
      createdByUserId: "other",
    });
    expect(shouldShowSeasonInDropdown(season, currentUserId)).toBe(false);
  });

  it("shows active tournaments the user created", () => {
    const tournament = buildTournament({ status: "active" });
    expect(shouldShowTournamentInDropdown(tournament, currentUserId)).toBe(true);
  });

  it("shows completed tournaments that ended recently", () => {
    const tournament = buildTournament({
      status: "completed",
      completedAt: "2026-03-15",
    });
    expect(shouldShowTournamentInDropdown(tournament, currentUserId)).toBe(true);
  });

  it("hides tournaments that completed before the recent window", () => {
    const tournament = buildTournament({
      status: "completed",
      completedAt: "2025-10-15",
    });
    expect(shouldShowTournamentInDropdown(tournament, currentUserId)).toBe(false);
  });

  it("renders tournament context with round and trophy hints", () => {
    const match = {
      id: "match_1",
      matchType: "singles",
      formatType: "single_game",
      pointsToWin: 11,
      teamAPlayerIds: [],
      teamBPlayerIds: [],
      score: [],
      winnerTeam: "A",
      playedAt: currentDateIso,
      seasonId: null,
      tournamentId: "tournament_1",
      createdByUserId: currentUserId,
      status: "active",
      createdAt: currentDateIso,
    } as MatchRecord;
    const tournaments = [buildTournament({ name: "Cup Finals" })];
    const translationMap = {
      renderMatchContextTournament: "Tournament",
      renderMatchContextSeason: "Season",
      renderMatchContextOpenPlay: "Open Play",
    } as const;

    const context = renderMatchContext(
      match,
      [],
      tournaments,
      { roundTitle: "Final", isFinal: true },
      (key) => translationMap[key],
    );

    expect(context).toBe("🏆 Tournament Cup Finals • Final");
  });

  it("renders season context when no tournament is supplied", () => {
    const match = {
      id: "match_2",
      matchType: "singles",
      formatType: "single_game",
      pointsToWin: 11,
      teamAPlayerIds: [],
      teamBPlayerIds: [],
      score: [],
      winnerTeam: "A",
      playedAt: currentDateIso,
      seasonId: "season_1",
      tournamentId: null,
      createdByUserId: currentUserId,
      status: "active",
      createdAt: currentDateIso,
    } as MatchRecord;
    const seasons = [buildSeason({ name: "Spring League" })];
    const translationMap = {
      renderMatchContextTournament: "Tournament",
      renderMatchContextSeason: "Season",
      renderMatchContextOpenPlay: "Open Play",
    } as const;

    const context = renderMatchContext(
      match,
      seasons,
      [],
      null,
      (key) => translationMap[key],
    );

    expect(context).toBe("Season Spring League");
  });

  it("renders open play text when no season or tournament matches", () => {
    const match = {
      id: "match_3",
      matchType: "singles",
      formatType: "single_game",
      pointsToWin: 11,
      teamAPlayerIds: [],
      teamBPlayerIds: [],
      score: [],
      winnerTeam: "A",
      playedAt: currentDateIso,
      seasonId: null,
      tournamentId: null,
      createdByUserId: currentUserId,
      status: "active",
      createdAt: currentDateIso,
    } as MatchRecord;
    const translationMap = {
      renderMatchContextTournament: "Tournament",
      renderMatchContextSeason: "Season",
      renderMatchContextOpenPlay: "Open Play",
    } as const;

    expect(
      renderMatchContext(match, [], [], null, (key) => translationMap[key]),
    ).toBe("Open Play");
  });

  it("exposes match filter translations and limits", () => {
    expect(matchFilterLabels.recent).toBe("matchFiltersRecent");
    expect(matchFilterLabels.mine).toBe("matchFiltersMine");
    expect(matchFilterLabels.all).toBe("matchFiltersAll");
    expect(getMatchLimitForFilter("recent")).toBe(4);
    expect(getMatchLimitForFilter("mine")).toBe(4);
    expect(getMatchLimitForFilter("all")).toBe(20);
  });
});
