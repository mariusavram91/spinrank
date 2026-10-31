import type { MatchRecord, SeasonRecord, TournamentBracketRound, TournamentRecord } from "../../../src/api/contract";
import {
  renderMatchContext,
  getSeasonIdsForDropdown,
  shouldShowTournamentInDropdown,
  getWinnerLabel,
  isTournamentBracketMatchReadyForCreation,
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

  it("requires previous-round winners before later-round bracket matches are considered ready", () => {
    const rounds: TournamentBracketRound[] = [
      {
        title: "Semifinals",
        matches: [
          {
            id: "sf_1",
            leftPlayerId: "user_alex",
            rightPlayerId: "user_bea",
            createdMatchId: null,
            winnerPlayerId: null,
            locked: false,
            isFinal: false,
          },
          {
            id: "sf_2",
            leftPlayerId: "user_marius",
            rightPlayerId: "user_kai",
            createdMatchId: null,
            winnerPlayerId: "user_marius",
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
            leftPlayerId: "user_alex",
            rightPlayerId: "user_marius",
            createdMatchId: null,
            winnerPlayerId: null,
            locked: false,
            isFinal: true,
          },
        ],
      },
    ];

    expect(isTournamentBracketMatchReadyForCreation(rounds, 1, 0)).toBe(false);
  });

  it("treats later-round bracket matches as ready only when both feeder winners exist", () => {
    const rounds: TournamentBracketRound[] = [
      {
        title: "Semifinals",
        matches: [
          {
            id: "sf_1",
            leftPlayerId: "user_alex",
            rightPlayerId: "user_bea",
            createdMatchId: "match_sf_1",
            winnerPlayerId: "user_alex",
            locked: true,
            isFinal: false,
          },
          {
            id: "sf_2",
            leftPlayerId: "user_marius",
            rightPlayerId: "user_kai",
            createdMatchId: "match_sf_2",
            winnerPlayerId: "user_marius",
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
            leftPlayerId: "user_alex",
            rightPlayerId: "user_marius",
            createdMatchId: null,
            winnerPlayerId: null,
            locked: false,
            isFinal: true,
          },
        ],
      },
    ];

    expect(isTournamentBracketMatchReadyForCreation(rounds, 1, 0)).toBe(true);
  });

  it("lists every current season the user is associated with", () => {
    const seasons = [
      buildSeason({ id: "season_current", startDate: "2026-04-01", endDate: "", status: "active", isActive: true }),
      buildSeason({ id: "season_created", startDate: "2026-04-02", endDate: "", status: "active", isActive: true, participantIds: [] }),
    ];

    expect([...getSeasonIdsForDropdown(seasons, currentUserId)].sort()).toEqual(["season_created", "season_current"]);
  });

  it("caps finished seasons to the three most recently completed", () => {
    const seasons = [
      buildSeason({ id: "season_oldest", startDate: "2025-01-01", endDate: "2025-02-01", status: "completed", isActive: false }),
      buildSeason({ id: "season_second", startDate: "2025-03-01", endDate: "2025-04-01", status: "completed", isActive: false }),
      buildSeason({ id: "season_third", startDate: "2025-05-01", endDate: "2025-06-01", status: "completed", isActive: false }),
      buildSeason({ id: "season_latest", startDate: "2026-03-01", endDate: "2026-03-20", status: "completed", isActive: false }),
    ];

    expect([...getSeasonIdsForDropdown(seasons, currentUserId)].sort()).toEqual([
      "season_latest",
      "season_second",
      "season_third",
    ]);
  });

  it("combines all current seasons with the three latest finished ones", () => {
    const seasons = [
      buildSeason({ id: "season_current", startDate: "2026-04-01", endDate: "", status: "active", isActive: true }),
      buildSeason({ id: "season_oldest", startDate: "2025-01-01", endDate: "2025-02-01", status: "completed", isActive: false }),
      buildSeason({ id: "season_latest", startDate: "2026-03-01", endDate: "2026-03-20", status: "completed", isActive: false }),
    ];

    expect([...getSeasonIdsForDropdown(seasons, currentUserId)].sort()).toEqual([
      "season_current",
      "season_latest",
      "season_oldest",
    ]);
  });

  it("hides deleted and unassociated seasons", () => {
    const seasons = [
      buildSeason({ id: "season_deleted", status: "deleted" }),
      buildSeason({ id: "season_foreign", participantIds: ["other"], createdByUserId: "other" }),
    ];

    expect([...getSeasonIdsForDropdown(seasons, currentUserId)]).toEqual([]);
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
      leaderboardPlacementFinal: "Final",
      leaderboardPlacementSemifinals: "Semifinals",
      leaderboardPlacementQuarterfinals: "Quarterfinals",
      leaderboardPlacementRoundOf: "Round of {count}",
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
      leaderboardPlacementFinal: "Final",
      leaderboardPlacementSemifinals: "Semifinals",
      leaderboardPlacementQuarterfinals: "Quarterfinals",
      leaderboardPlacementRoundOf: "Round of {count}",
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
      leaderboardPlacementFinal: "Final",
      leaderboardPlacementSemifinals: "Semifinals",
      leaderboardPlacementQuarterfinals: "Quarterfinals",
      leaderboardPlacementRoundOf: "Round of {count}",
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
