import { createFormOrchestration } from "../../../src/ui/features/app/formOrchestration";
import { createMatchPlayerSearchInputs } from "../../../src/ui/features/app/matchPlayerSearchInputs";
import type { DashboardState, TournamentPlannerState, ViewState } from "../../../src/ui/shared/types/app";

const createDashboardStateStub = (): DashboardState =>
  ({
    players: [],
    seasons: [],
    tournaments: [],
    selectedSeasonId: "",
    selectedTournamentId: "",
    editingSeasonId: "",
  } as unknown as DashboardState);

const createTournamentPlannerStateStub = (): TournamentPlannerState =>
  ({
    tournamentId: "",
  } as unknown as TournamentPlannerState);

describe("match player search inputs", () => {
  it("shows selected bracket players after match options are populated", () => {
    const dashboardState = createDashboardStateStub();
    const tournamentPlannerState = createTournamentPlannerStateStub();
    const authState: ViewState = {
      status: "authenticated",
      message: "Signed in",
      session: {
        sessionToken: "token",
        expiresAt: "2026-04-05T00:00:00.000Z",
        user: {
          id: "user_a",
          provider: "google",
          displayName: "Alice",
          email: null,
          avatarUrl: null,
        },
      },
    };

    const loadSeasonSelect = document.createElement("select");
    const loadTournamentSelect = document.createElement("select");
    const seasonSelect = document.createElement("select");
    const tournamentSelect = document.createElement("select");
    const matchTypeSelect = document.createElement("select");
    const formatTypeSelect = document.createElement("select");
    const pointsToWinSelect = document.createElement("select");
    const formSeasonSelect = document.createElement("select");
    const formTournamentSelect = document.createElement("select");
    const matchBracketSelect = document.createElement("select");
    const tournamentSeasonSelect = document.createElement("select");
    const teamA1Select = document.createElement("select");
    const teamA2Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamB2Select = document.createElement("select");
    const winnerTeamSelect = document.createElement("select");
    const seasonNameInput = document.createElement("input");
    const seasonStartDateInput = document.createElement("input");
    const seasonEndDateInput = document.createElement("input");
    const seasonBaseEloSelect = document.createElement("select");
    const seasonIsActiveInput = document.createElement("input");
    const seasonIsPublicInput = document.createElement("input");
    const tournamentNameInput = document.createElement("input");
    const tournamentDateInput = document.createElement("input");
    const teamA1Field = document.createElement("div");
    const teamA2Field = document.createElement("div");
    const teamB1Field = document.createElement("div");
    const teamB2Field = document.createElement("div");
    const suggestMatchButton = document.createElement("button");
    const submitMatchButton = document.createElement("button");

    matchTypeSelect.value = "singles";
    formatTypeSelect.value = "single_game";
    pointsToWinSelect.value = "11";
    teamA1Select.dataset.pendingValue = "user_a";
    teamB1Select.dataset.pendingValue = "user_b";

    const { populateMatchFormOptions } = createFormOrchestration({
      dashboardState,
      tournamentPlannerState,
      getViewState: () => authState,
      getCurrentUserId: () => "user_a",
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      getActiveTournamentBracketMatchId: () => "bracket_1",
      loadSeasonSelect,
      loadTournamentSelect,
      seasonSelect,
      tournamentSelect,
      matchTypeSelect,
      formatTypeSelect,
      pointsToWinSelect,
      formSeasonSelect,
      formTournamentSelect,
      matchBracketSelect,
      tournamentSeasonSelect,
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
      winnerTeamSelect,
      scoreInputs: [{ teamA: document.createElement("input"), teamB: document.createElement("input") }],
      seasonNameInput,
      seasonStartDateInput,
      seasonEndDateInput,
      seasonBaseEloSelect,
      seasonIsActiveInput,
      seasonIsPublicInput,
      tournamentNameInput,
      tournamentDateInput,
      suggestMatchButton,
      submitMatchButton,
      setSeasonSharePanelTargetId: () => {},
      setTournamentSharePanelTargetId: () => {},
      getMatchScreenRefs: () => ({
        teamA2Field,
        teamB2Field,
        scoreGrid: null,
        contextToggle: null,
        matchTypeToggle: null,
        formatTypeToggle: null,
        pointsToggle: null,
        seasonField: null,
        seasonInfoField: null,
        seasonInfoValue: null,
        tournamentField: null,
        bracketField: null,
      }),
      getAllowedMatchPlayerIds: () => ["user_a", "user_b"],
      getMatchPlayerEntries: () => [
        {
          userId: "user_a",
          displayName: "Alice",
          avatarUrl: null,
          elo: 1200,
          rank: Number.MAX_SAFE_INTEGER,
        },
        {
          userId: "user_b",
          displayName: "Bob",
          avatarUrl: null,
          elo: 1180,
          rank: Number.MAX_SAFE_INTEGER,
        },
      ],
      formatDate: (value) => value,
      t: (key) => key,
    });

    populateMatchFormOptions();

    const sync = createMatchPlayerSearchInputs({
      dashboardState,
      getCurrentUserId: () => "user_a",
      getAllowedMatchPlayerIds: () => ["user_a", "user_b"],
      getMatchPlayerEntries: () => [
        {
          userId: "user_a",
          displayName: "Alice",
          avatarUrl: null,
          elo: 1200,
          rank: Number.MAX_SAFE_INTEGER,
        },
        {
          userId: "user_b",
          displayName: "Bob",
          avatarUrl: null,
          elo: 1180,
          rank: Number.MAX_SAFE_INTEGER,
        },
      ],
      formSeasonSelect,
      formTournamentSelect,
      teamA1Field,
      teamA2Field,
      teamB1Field,
      teamB2Field,
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
    }).sync;

    sync();

    const teamA1Input = teamA1Field.querySelector<HTMLInputElement>('[data-testid="match-player-search-team-a-1"]');
    const teamB1Input = teamB1Field.querySelector<HTMLInputElement>('[data-testid="match-player-search-team-b-1"]');

    expect(teamA1Select.value).toBe("user_a");
    expect(teamB1Select.value).toBe("user_b");
    expect(teamA1Input?.value).toBe("Alice (1200) (You)");
    expect(teamB1Input?.value).toBe("Bob (1180)");
  });

  it("locks tournament matches to singles and disables editing when no bracket is selected", () => {
    const dashboardState = createDashboardStateStub();
    const tournamentPlannerState = createTournamentPlannerStateStub();
    const authState: ViewState = {
      status: "authenticated",
      message: "Signed in",
      session: {
        sessionToken: "token",
        expiresAt: "2026-04-05T00:00:00.000Z",
        user: {
          id: "user_a",
          provider: "google",
          displayName: "Alice",
          email: null,
          avatarUrl: null,
        },
      },
    };

    const matchTypeSelect = document.createElement("select");
    const formatTypeSelect = document.createElement("select");
    const pointsToWinSelect = document.createElement("select");
    const formSeasonSelect = document.createElement("select");
    const formTournamentSelect = document.createElement("select");
    const matchBracketSelect = document.createElement("select");
    const tournamentSeasonSelect = document.createElement("select");
    const teamA1Select = document.createElement("select");
    const teamA2Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamB2Select = document.createElement("select");
    const winnerTeamSelect = document.createElement("select");
    const suggestMatchButton = document.createElement("button");
    const submitMatchButton = document.createElement("button");
    const scoreA = document.createElement("input");
    const scoreB = document.createElement("input");
    const matchTypeToggle = document.createElement("div");
    matchTypeToggle.innerHTML = '<button data-value="singles"></button><button data-value="doubles"></button>';
    const formatTypeToggle = document.createElement("div");
    formatTypeToggle.innerHTML = '<button data-value="single_game"></button><button data-value="best_of_3"></button>';
    const pointsToggle = document.createElement("div");
    pointsToggle.innerHTML = '<button data-value="11"></button><button data-value="21"></button>';

    matchTypeSelect.value = "doubles";
    formatTypeSelect.value = "best_of_3";
    pointsToWinSelect.value = "21";
    const tournamentOption = document.createElement("option");
    tournamentOption.value = "tournament_1";
    tournamentOption.textContent = "Tournament 1";
    formTournamentSelect.append(tournamentOption);
    formTournamentSelect.value = "tournament_1";

    const { populateMatchFormOptions } = createFormOrchestration({
      dashboardState,
      tournamentPlannerState,
      getViewState: () => authState,
      getCurrentUserId: () => "user_a",
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      getActiveTournamentBracketMatchId: () => null,
      loadSeasonSelect: document.createElement("select"),
      loadTournamentSelect: document.createElement("select"),
      seasonSelect: document.createElement("select"),
      tournamentSelect: document.createElement("select"),
      matchTypeSelect,
      formatTypeSelect,
      pointsToWinSelect,
      formSeasonSelect,
      formTournamentSelect,
      matchBracketSelect,
      tournamentSeasonSelect,
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
      winnerTeamSelect,
      scoreInputs: [{ teamA: scoreA, teamB: scoreB }],
      seasonNameInput: document.createElement("input"),
      seasonStartDateInput: document.createElement("input"),
      seasonEndDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsActiveInput: document.createElement("input"),
      seasonIsPublicInput: document.createElement("input"),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      suggestMatchButton,
      submitMatchButton,
      setSeasonSharePanelTargetId: () => {},
      setTournamentSharePanelTargetId: () => {},
      getMatchScreenRefs: () => ({
        teamA2Field: null,
        teamB2Field: null,
        scoreGrid: null,
        contextToggle: null,
        matchTypeToggle,
        formatTypeToggle,
        pointsToggle,
        seasonField: null,
        seasonInfoField: null,
        seasonInfoValue: null,
        tournamentField: null,
        bracketField: null,
      }),
      getAllowedMatchPlayerIds: () => [],
      getMatchPlayerEntries: () => [],
      formatDate: (value) => value,
      t: (key) => key,
    });

    populateMatchFormOptions();

    expect(matchTypeSelect.value).toBe("singles");
    expect(suggestMatchButton.hidden).toBe(true);
    expect(teamA1Select.disabled).toBe(true);
    expect(teamB1Select.disabled).toBe(true);
    expect(formatTypeSelect.disabled).toBe(true);
    expect(pointsToWinSelect.disabled).toBe(true);
    expect(scoreA.disabled).toBe(true);
    expect(scoreB.disabled).toBe(true);
    expect(submitMatchButton.disabled).toBe(true);
    expect(
      Array.from(matchTypeToggle.querySelectorAll<HTMLButtonElement>("button")).every((button) => button.disabled),
    ).toBe(true);
  });

  it("auto-selects the first visible season in season mode with no blank option", () => {
    const dashboardState = createDashboardStateStub();
    dashboardState.seasons = [
      {
        id: "season_1",
        name: "Season 1",
        startDate: "2026-04-01",
        endDate: "2026-05-01",
        isActive: true,
        status: "active",
        baseEloMode: "carry_over",
        participantIds: ["user_a"],
        createdByUserId: "user_a",
        createdAt: "2026-04-01T00:00:00.000Z",
        completedAt: null,
        isPublic: true,
      },
      {
        id: "season_2",
        name: "Season 2",
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        isActive: true,
        status: "active",
        baseEloMode: "carry_over",
        participantIds: ["user_a"],
        createdByUserId: "user_a",
        createdAt: "2026-06-01T00:00:00.000Z",
        completedAt: null,
        isPublic: true,
      },
    ];

    const authState: ViewState = {
      status: "authenticated",
      message: "Signed in",
      session: {
        sessionToken: "token",
        expiresAt: "2026-04-05T00:00:00.000Z",
        user: {
          id: "user_a",
          provider: "google",
          displayName: "Alice",
          email: null,
          avatarUrl: null,
        },
      },
    };
    const contextToggle = document.createElement("div");
    contextToggle.dataset.mode = "season";
    const formSeasonSelect = document.createElement("select");

    const { populateMatchFormOptions } = createFormOrchestration({
      dashboardState,
      tournamentPlannerState: createTournamentPlannerStateStub(),
      getViewState: () => authState,
      getCurrentUserId: () => "user_a",
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      getActiveTournamentBracketMatchId: () => null,
      loadSeasonSelect: document.createElement("select"),
      loadTournamentSelect: document.createElement("select"),
      seasonSelect: document.createElement("select"),
      tournamentSelect: document.createElement("select"),
      matchTypeSelect: document.createElement("select"),
      formatTypeSelect: document.createElement("select"),
      pointsToWinSelect: document.createElement("select"),
      formSeasonSelect,
      formTournamentSelect: document.createElement("select"),
      matchBracketSelect: document.createElement("select"),
      tournamentSeasonSelect: document.createElement("select"),
      teamA1Select: document.createElement("select"),
      teamA2Select: document.createElement("select"),
      teamB1Select: document.createElement("select"),
      teamB2Select: document.createElement("select"),
      winnerTeamSelect: document.createElement("select"),
      scoreInputs: [{ teamA: document.createElement("input"), teamB: document.createElement("input") }],
      seasonNameInput: document.createElement("input"),
      seasonStartDateInput: document.createElement("input"),
      seasonEndDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsActiveInput: document.createElement("input"),
      seasonIsPublicInput: document.createElement("input"),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      suggestMatchButton: document.createElement("button"),
      submitMatchButton: document.createElement("button"),
      setSeasonSharePanelTargetId: () => {},
      setTournamentSharePanelTargetId: () => {},
      getMatchScreenRefs: () => ({
        teamA2Field: null,
        teamB2Field: null,
        scoreGrid: null,
        contextToggle,
        matchTypeToggle: null,
        formatTypeToggle: null,
        pointsToggle: null,
        seasonField: null,
        seasonInfoField: null,
        seasonInfoValue: null,
        tournamentField: null,
        bracketField: null,
      }),
      getAllowedMatchPlayerIds: () => null,
      getMatchPlayerEntries: () => [],
      formatDate: (value) => value,
      t: (key) => key,
    });

    populateMatchFormOptions();

    expect(formSeasonSelect.value).toBe("season_1");
    expect(Array.from(formSeasonSelect.options).map((option) => option.value)).toEqual(["season_1", "season_2"]);
  });

  it("auto-selects the first visible tournament in tournament mode with no blank option", () => {
    const dashboardState = createDashboardStateStub();
    dashboardState.tournaments = [
      {
        id: "tournament_1",
        name: "Tournament 1",
        date: "2026-04-01",
        seasonId: null,
        seasonName: null,
        status: "active",
        createdByUserId: "user_a",
        createdAt: "2026-04-01T00:00:00.000Z",
        completedAt: null,
        participantCount: 2,
        participantIds: ["user_a", "user_b"],
        bracketStatus: "draft",
      },
      {
        id: "tournament_2",
        name: "Tournament 2",
        date: "2026-04-02",
        seasonId: null,
        seasonName: null,
        status: "active",
        createdByUserId: "user_a",
        createdAt: "2026-04-02T00:00:00.000Z",
        completedAt: null,
        participantCount: 2,
        participantIds: ["user_a", "user_c"],
        bracketStatus: "draft",
      },
    ];

    const authState: ViewState = {
      status: "authenticated",
      message: "Signed in",
      session: {
        sessionToken: "token",
        expiresAt: "2026-04-05T00:00:00.000Z",
        user: {
          id: "user_a",
          provider: "google",
          displayName: "Alice",
          email: null,
          avatarUrl: null,
        },
      },
    };
    const contextToggle = document.createElement("div");
    contextToggle.dataset.mode = "tournament";
    const formTournamentSelect = document.createElement("select");
    const seasonInfoField = document.createElement("div");
    const seasonInfoValue = document.createElement("div");

    const { populateMatchFormOptions } = createFormOrchestration({
      dashboardState,
      tournamentPlannerState: createTournamentPlannerStateStub(),
      getViewState: () => authState,
      getCurrentUserId: () => "user_a",
      isAuthedState: (
        state: ViewState,
      ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
      getActiveTournamentBracketMatchId: () => null,
      loadSeasonSelect: document.createElement("select"),
      loadTournamentSelect: document.createElement("select"),
      seasonSelect: document.createElement("select"),
      tournamentSelect: document.createElement("select"),
      matchTypeSelect: document.createElement("select"),
      formatTypeSelect: document.createElement("select"),
      pointsToWinSelect: document.createElement("select"),
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect,
      matchBracketSelect: document.createElement("select"),
      tournamentSeasonSelect: document.createElement("select"),
      teamA1Select: document.createElement("select"),
      teamA2Select: document.createElement("select"),
      teamB1Select: document.createElement("select"),
      teamB2Select: document.createElement("select"),
      winnerTeamSelect: document.createElement("select"),
      scoreInputs: [{ teamA: document.createElement("input"), teamB: document.createElement("input") }],
      seasonNameInput: document.createElement("input"),
      seasonStartDateInput: document.createElement("input"),
      seasonEndDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsActiveInput: document.createElement("input"),
      seasonIsPublicInput: document.createElement("input"),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      suggestMatchButton: document.createElement("button"),
      submitMatchButton: document.createElement("button"),
      setSeasonSharePanelTargetId: () => {},
      setTournamentSharePanelTargetId: () => {},
      getMatchScreenRefs: () => ({
        teamA2Field: null,
        teamB2Field: null,
        scoreGrid: null,
        contextToggle,
        matchTypeToggle: null,
        formatTypeToggle: null,
        pointsToggle: null,
        seasonField: null,
        seasonInfoField,
        seasonInfoValue,
        tournamentField: null,
        bracketField: null,
      }),
      getAllowedMatchPlayerIds: () => null,
      getMatchPlayerEntries: () => [],
      formatDate: (value) => value,
      t: (key) => key,
    });

    populateMatchFormOptions();

    expect(formTournamentSelect.value).toBe("tournament_1");
    expect(Array.from(formTournamentSelect.options).map((option) => option.value)).toEqual([
      "tournament_1",
      "tournament_2",
    ]);
    expect(seasonInfoField.hidden).toBe(true);
    expect(seasonInfoValue.textContent).toBe("");
  });

  it("closes the menu on blur after clearing a selected player", async () => {
    const dashboardState = createDashboardStateStub();
    const teamA1Field = document.createElement("div");
    const teamA2Field = document.createElement("div");
    const teamB1Field = document.createElement("div");
    const teamB2Field = document.createElement("div");
    const teamA1Select = document.createElement("select");
    const option = document.createElement("option");
    option.value = "user_a";
    option.textContent = "Alice (1200) (You)";
    option.selected = true;
    teamA1Select.append(option);

    const sync = createMatchPlayerSearchInputs({
      dashboardState,
      getCurrentUserId: () => "user_a",
      getAllowedMatchPlayerIds: () => ["user_a", "user_b"],
      getMatchPlayerEntries: () => [
        { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
        { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      ],
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect: document.createElement("select"),
      teamA1Field,
      teamA2Field,
      teamB1Field,
      teamB2Field,
      teamA1Select,
      teamA2Select: document.createElement("select"),
      teamB1Select: document.createElement("select"),
      teamB2Select: document.createElement("select"),
    }).sync;

    sync();

    const input = teamA1Field.querySelector<HTMLInputElement>('[data-testid="match-player-search-team-a-1"]');
    const clearButton = teamA1Field.querySelector<HTMLButtonElement>(".score-card__player-search-clear");
    const field = teamA1Field.querySelector<HTMLElement>(".match-player-search-field");
    expect(input).not.toBeNull();
    expect(clearButton).not.toBeNull();
    expect(field).not.toBeNull();

    input?.dispatchEvent(new Event("focus"));
    clearButton?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    clearButton?.click();
    input?.dispatchEvent(new Event("blur"));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(field?.classList.contains("score-card__player-search-field--open")).toBe(false);
    expect(input?.getAttribute("aria-expanded")).toBe("false");
  });

  it("searches remote players for open matches and keeps selected players in later slots", async () => {
    const dashboardState = createDashboardStateStub();
    const teamA1Field = document.createElement("div");
    const teamA2Field = document.createElement("div");
    const teamB1Field = document.createElement("div");
    const teamB2Field = document.createElement("div");
    const teamA1Select = document.createElement("select");
    const teamA2Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamB2Select = document.createElement("select");

    [teamA1Select, teamA2Select, teamB1Select, teamB2Select].forEach((select) => {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "empty";
      select.append(emptyOption);
    });

    const remotePlayer = {
      userId: "user_c",
      displayName: "Carla",
      avatarUrl: null,
      elo: 1175,
      rank: Number.MAX_SAFE_INTEGER,
    };

    const sync = createMatchPlayerSearchInputs({
      dashboardState,
      getCurrentUserId: () => "user_a",
      getAllowedMatchPlayerIds: () => null,
      getMatchPlayerEntries: () => [
        { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
        { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      ],
      searchPlayers: vi.fn(async (query: string) => (
        query.toLowerCase() === "car" ? [remotePlayer] : []
      )),
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect: document.createElement("select"),
      teamA1Field,
      teamA2Field,
      teamB1Field,
      teamB2Field,
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
    }).sync;

    sync();

    const input = teamB1Field.querySelector<HTMLInputElement>('[data-testid="match-player-search-team-b-1"]');
    expect(input).not.toBeNull();

    input!.dispatchEvent(new Event("focus"));
    input!.value = "car";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const optionButton = teamB1Field.querySelector<HTMLButtonElement>('[data-testid="match-player-search-option"]');
    expect(optionButton?.textContent).toBe("Carla (1175)");

    optionButton?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    optionButton?.click();

    expect(teamB1Select.value).toBe("user_c");
    expect(Array.from(teamB1Select.options).some((option) => option.value === "user_c")).toBe(true);
    sync();
    expect(input?.value).toBe("Carla (1175)");
  });
});
