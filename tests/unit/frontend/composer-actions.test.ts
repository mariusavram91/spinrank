import { createComposerActions } from "../../../src/ui/features/app/composerActions";
import type { DashboardState, TournamentPlannerState, ViewState } from "../../../src/ui/shared/types/app";

const authState: ViewState = {
  status: "authenticated",
  message: "Signed in",
  session: {
    sessionToken: "token",
    expiresAt: "2026-04-06T00:00:00.000Z",
    user: {
      id: "user_a",
      provider: "google",
      displayName: "Alice",
      email: null,
      avatarUrl: null,
      locale: "en",
    },
  },
};

const createDashboardState = (): DashboardState =>
  ({
    players: [
      { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
      { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, rank: 3 },
    ],
    tournaments: [{ id: "tournament_1", seasonId: "season_1", status: "active" }],
    matchFormError: "",
    matchFormMessage: "",
    screen: "dashboard",
    matchTournamentBracketCache: {
      tournament_1: {
        tournament: {
          id: "tournament_1",
          name: "Cup",
          date: "2026-04-06",
          seasonId: "season_1",
          seasonName: "Season 1",
          status: "active",
          createdByUserId: "user_a",
          createdAt: "2026-04-06T00:00:00.000Z",
          completedAt: null,
          participantCount: 2,
          participantIds: ["user_a", "user_b"],
          bracketStatus: "draft",
        },
        participantIds: ["user_a", "user_b"],
        participants: [],
        rounds: [],
      },
    },
  } as unknown as DashboardState);

const createTournamentPlannerState = (): TournamentPlannerState =>
  ({
    participantIds: ["user_a", "user_b", "user_c"],
    firstRoundMatches: [],
    rounds: [],
    tournamentId: "tournament_1",
    error: "",
  } as unknown as TournamentPlannerState);

const createHarness = () => {
  const dashboardState = createDashboardState();
  const tournamentPlannerState = createTournamentPlannerState();
  const withOptions = (select: HTMLSelectElement, values: string[]) => {
    select.replaceChildren(
      ...values.map((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        return option;
      }),
    );
  };
  const matchTypeSelect = document.createElement("select");
  matchTypeSelect.append(new Option("Singles", "singles"), new Option("Doubles", "doubles"));
  matchTypeSelect.value = "singles";
  const formatTypeSelect = document.createElement("select");
  formatTypeSelect.append(new Option("Single", "single_game"), new Option("Best of 3", "best_of_3"));
  formatTypeSelect.value = "best_of_3";
  const pointsToWinSelect = document.createElement("select");
  pointsToWinSelect.append(new Option("11", "11"), new Option("21", "21"));
  pointsToWinSelect.value = "21";
  const teamA1Select = document.createElement("select");
  const teamA2Select = document.createElement("select");
  const teamB1Select = document.createElement("select");
  const teamB2Select = document.createElement("select");
  const formSeasonSelect = document.createElement("select");
  const formTournamentSelect = document.createElement("select");
  withOptions(teamA1Select, ["", "user_a", "user_b", "user_c"]);
  withOptions(teamA2Select, ["", "user_a", "user_b", "user_c"]);
  withOptions(teamB1Select, ["", "user_a", "user_b", "user_c"]);
  withOptions(teamB2Select, ["", "user_a", "user_b", "user_c"]);
  withOptions(formSeasonSelect, ["", "season_1"]);
  withOptions(formTournamentSelect, ["", "tournament_1"]);
  const winnerTeamSelect = document.createElement("select");
  winnerTeamSelect.append(new Option("A", "A"), new Option("B", "B"));
  winnerTeamSelect.value = "B";

  const args = {
    dashboardState,
    tournamentPlannerState,
    getViewState: () => authState,
    isAuthedState: (
      state: ViewState,
    ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    formSeasonSelect,
    formTournamentSelect,
    winnerTeamSelect,
    resetScoreInputs: vi.fn(),
    populateMatchFormOptions: vi.fn(),
    syncMatchBracketOptions: vi.fn(),
    applySelectedTournamentBracketMatch: vi.fn(),
    renderTournamentPlanner: vi.fn(),
    syncAuthState: vi.fn(),
    syncDashboardState: vi.fn(),
    saveTournament: vi.fn().mockResolvedValue(undefined),
    setActiveTournamentBracketMatchId: vi.fn(),
    getSuggestedMatchPlayers: vi.fn().mockResolvedValue([
      { userId: "user_a", displayName: "Alice", elo: 1200 },
      { userId: "user_b", displayName: "Bob", elo: 1180 },
    ]),
    buildFairMatchSuggestion: vi.fn(),
    buildTournamentSuggestion: vi.fn(),
    applyTournamentWinnerLocally: vi.fn(),
  };

  return { args, actions: createComposerActions(args) };
};

describe("composer actions", () => {
  it("applies and rejects fair match suggestions through shared composer state", async () => {
    const { args, actions } = createHarness();
    args.buildFairMatchSuggestion = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ teamAPlayerIds: ["user_a"], teamBPlayerIds: ["user_b"] });

    await actions.applyFairMatchSuggestion();
    expect(args.dashboardState.matchFormError).toContain("Not enough available players");
    expect(args.dashboardState.matchFormMessage).toBe("");

    await actions.applyFairMatchSuggestion();
    expect(args.teamA1Select.value).toBe("user_a");
    expect(args.teamB1Select.value).toBe("user_b");
    expect(args.teamA1Select.dataset.pendingValue).toBe("user_a");
    expect(args.teamB1Select.dataset.pendingValue).toBe("user_b");
    expect(args.dashboardState.matchFormError).toBe("");
    expect(args.dashboardState.matchFormMessage).toBe("Suggested matchup ready.");
    expect(args.populateMatchFormOptions).toHaveBeenCalled();
    expect(args.syncDashboardState).toHaveBeenCalled();
  });

  it("builds tournament brackets, advances byes, and persists saved tournaments", async () => {
    const { args, actions } = createHarness();
    args.buildTournamentSuggestion = vi.fn().mockReturnValue({
      firstRoundMatches: [{ id: "m1", leftPlayerId: "user_a", rightPlayerId: null }],
      rounds: [
        { title: "Semifinal", matches: [{ id: "m1", leftPlayerId: "user_a", rightPlayerId: null }] },
        { title: "Final", matches: [{ id: "m2", leftPlayerId: null, rightPlayerId: null }] },
      ],
    });
    args.applyTournamentWinnerLocally = vi.fn().mockReturnValue([
      {
        title: "Semifinal",
        matches: [{ id: "m1", leftPlayerId: "user_a", rightPlayerId: null, winnerPlayerId: "user_a" }],
      },
      {
        title: "Final",
        matches: [{ id: "m2", leftPlayerId: "user_a", rightPlayerId: null }],
      },
    ]);

    actions.suggestTournamentBracket();
    expect(args.tournamentPlannerState.rounds).toHaveLength(2);
    expect(args.tournamentPlannerState.error).toBe("");

    await actions.advanceTournamentBye(0, 0);
    expect(args.applyTournamentWinnerLocally).toHaveBeenCalledWith(expect.any(Array), 0, 0, "user_a");
    expect(args.saveTournament).toHaveBeenCalled();
    expect(args.dashboardState.matchTournamentBracketCache.tournament_1).toBeUndefined();
  });

  it("prefills a tournament pairing into the match composer", () => {
    const { args, actions } = createHarness();
    actions.prefillMatchFromTournamentPairing({
      id: "bracket_1",
      leftPlayerId: "user_a",
      rightPlayerId: "user_b",
    } as TournamentPlannerState["firstRoundMatches"][number]);

    expect(args.matchTypeSelect.value).toBe("singles");
    expect(args.formatTypeSelect.value).toBe("single_game");
    expect(args.pointsToWinSelect.value).toBe("11");
    expect(args.teamA1Select.value).toBe("user_a");
    expect(args.teamB1Select.value).toBe("user_b");
    expect(args.formSeasonSelect.value).toBe("season_1");
    expect(args.formTournamentSelect.value).toBe("tournament_1");
    expect(args.winnerTeamSelect.value).toBe("A");
    expect(args.dashboardState.screen).toBe("createMatch");
    expect(args.resetScoreInputs).toHaveBeenCalled();
    expect(args.setActiveTournamentBracketMatchId).toHaveBeenCalledWith("bracket_1");
    expect(args.populateMatchFormOptions).toHaveBeenCalled();
    expect(args.syncMatchBracketOptions).toHaveBeenCalled();
    expect(args.applySelectedTournamentBracketMatch).toHaveBeenCalled();
    expect(args.syncAuthState).toHaveBeenCalled();
    expect(args.syncDashboardState).toHaveBeenCalled();
    expect(args.dashboardState.matchTournamentBracketCache.tournament_1).toBeUndefined();
  });
});
