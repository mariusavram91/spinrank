import { createFormOrchestration } from "../../../src/ui/features/app/formOrchestration";
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

const createDashboardStateStub = (): DashboardState =>
  ({
    players: [
      { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
      { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, rank: 3 },
    ],
    seasons: [
      {
        id: "season_1",
        name: "Spring Season",
        status: "active",
        isActive: true,
        participantIds: ["user_a", "user_b", "user_c"],
        createdByUserId: "user_a",
      },
    ],
    tournaments: [
      {
        id: "tournament_1",
        name: "Spring Cup",
        seasonId: "season_1",
        status: "active",
        participantIds: ["user_a", "user_b", "user_c"],
        createdByUserId: "user_a",
      },
    ],
    editingSeasonId: "season_editing",
    editingSeasonParticipantIds: ["user_b", "user_c"],
    seasonDraftMode: "edit",
    seasonParticipantQuery: "Bob",
    seasonParticipantResults: [],
    seasonParticipantSearchLoading: true,
    seasonParticipantSearchError: "Search failed",
  } as unknown as DashboardState);

const createTournamentPlannerStateStub = (): TournamentPlannerState =>
  ({
    name: "Cup",
    tournamentId: "tournament_1",
    participantIds: ["user_b"],
    participantQuery: "Bob",
    participantResults: [],
    participantSearchLoading: true,
    participantSearchError: "Search failed",
    firstRoundMatches: [{ id: "round_1", leftPlayerId: "user_b", rightPlayerId: "user_c" }],
    rounds: [{ title: "Final", matches: [] }],
    error: "Planner error",
  } as unknown as TournamentPlannerState);

const addSelectOptions = (select: HTMLSelectElement, values: string[]) => {
  select.replaceChildren(
    ...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }),
  );
};

const createHarness = (overrides?: {
  getActiveTournamentBracketMatchId?: () => string | null;
  getCurrentUserId?: () => string;
}) => {
  const dashboardState = createDashboardStateStub();
  const tournamentPlannerState = createTournamentPlannerStateStub();
  const seasonTargetIds: string[] = [];
  const tournamentTargetIds: string[] = [];

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
  const suggestMatchButton = document.createElement("button");
  const submitMatchButton = document.createElement("button");
  const scoreGrid = document.createElement("div");
  const contextToggle = document.createElement("div");
  const scoreInputs = Array.from({ length: 3 }, () => ({
    teamA: document.createElement("input"),
    teamB: document.createElement("input"),
  }));

  contextToggle.innerHTML = [
    '<button data-value="open"></button>',
    '<button data-value="season"></button>',
    '<button data-value="tournament"></button>',
  ].join("");
  contextToggle.dataset.mode = "open";

  scoreInputs.forEach(() => {
    scoreGrid.append(document.createElement("div"));
  });

  addSelectOptions(matchTypeSelect, ["singles", "doubles"]);
  addSelectOptions(formatTypeSelect, ["single_game", "best_of_3"]);
  addSelectOptions(pointsToWinSelect, ["11", "21"]);
  addSelectOptions(formSeasonSelect, ["", "season_1"]);
  addSelectOptions(formTournamentSelect, ["", "tournament_1"]);
  addSelectOptions(teamA1Select, ["", "user_a", "user_b", "user_c"]);
  addSelectOptions(teamA2Select, ["", "user_a", "user_b", "user_c"]);
  addSelectOptions(teamB1Select, ["", "user_a", "user_b", "user_c"]);
  addSelectOptions(teamB2Select, ["", "user_a", "user_b", "user_c"]);
  addSelectOptions(seasonBaseEloSelect, ["carry_over", "reset"]);

  matchTypeSelect.value = "singles";
  formatTypeSelect.value = "single_game";
  pointsToWinSelect.value = "11";
  teamA1Select.value = "user_a";
  teamB1Select.value = "user_b";
  seasonBaseEloSelect.value = "carry_over";

  const orchestration = createFormOrchestration({
    dashboardState,
    tournamentPlannerState,
    getViewState: () => authState,
    getCurrentUserId: overrides?.getCurrentUserId ?? (() => "user_a"),
    isAuthedState: (
      state: ViewState,
    ): state is Extract<ViewState, { status: "authenticated" }> => state.status === "authenticated",
    getActiveTournamentBracketMatchId:
      overrides?.getActiveTournamentBracketMatchId ?? (() => "bracket_1"),
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
    scoreInputs,
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
    setSeasonSharePanelTargetId: (value) => {
      seasonTargetIds.push(value);
    },
    setTournamentSharePanelTargetId: (value) => {
      tournamentTargetIds.push(value);
    },
    getMatchScreenRefs: () => ({
      teamA2Field: document.createElement("div"),
      teamB2Field: document.createElement("div"),
      scoreGrid,
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
    getAllowedMatchPlayerIds: () => ["user_a", "user_b", "user_c"],
    getMatchPlayerEntries: () => [
      { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
      { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, rank: 3 },
    ],
    formatDate: (value) => value,
    t: (key) => key,
  });

  return {
    orchestration,
    dashboardState,
    tournamentPlannerState,
    formSeasonSelect,
    formTournamentSelect,
    matchTypeSelect,
    formatTypeSelect,
    pointsToWinSelect,
    contextToggle,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    scoreInputs,
    seasonNameInput,
    seasonStartDateInput,
    seasonEndDateInput,
    seasonBaseEloSelect,
    seasonIsActiveInput,
    seasonIsPublicInput,
    loadSeasonSelect,
    loadTournamentSelect,
    tournamentNameInput,
    tournamentDateInput,
    tournamentSeasonSelect,
    seasonTargetIds,
    tournamentTargetIds,
  };
};

describe("form orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:34:56.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects a valid tournament match payload with bracket metadata", () => {
    const harness = createHarness();
    harness.formatTypeSelect.value = "best_of_3";
    harness.formTournamentSelect.value = "tournament_1";
    harness.scoreInputs[0].teamA.value = "11";
    harness.scoreInputs[0].teamB.value = "7";
    harness.scoreInputs[1].teamA.value = "8";
    harness.scoreInputs[1].teamB.value = "11";
    harness.scoreInputs[2].teamA.value = "11";
    harness.scoreInputs[2].teamB.value = "9";

    expect(harness.orchestration.collectMatchPayload()).toEqual({
      matchType: "singles",
      formatType: "best_of_3",
      pointsToWin: 11,
      teamAPlayerIds: ["user_a"],
      teamBPlayerIds: ["user_b"],
      score: [
        { teamA: 11, teamB: 7 },
        { teamA: 8, teamB: 11 },
        { teamA: 11, teamB: 9 },
      ],
      winnerTeam: "A",
      playedAt: "2026-04-05T12:34:56.000Z",
      seasonId: "season_1",
      tournamentId: "tournament_1",
      tournamentBracketMatchId: "bracket_1",
    });
  });

  it("rejects doubles payloads that reuse the same player", () => {
    const harness = createHarness();
    harness.matchTypeSelect.value = "doubles";
    harness.teamA2Select.value = "user_b";
    harness.teamB2Select.value = "user_c";
    harness.scoreInputs[0].teamA.value = "11";
    harness.scoreInputs[0].teamB.value = "9";

    expect(() => harness.orchestration.collectMatchPayload()).toThrow(
      "Each selected player must be unique across both teams.",
    );
  });

  it("rejects matches when the signed-in user is not participating", () => {
    const harness = createHarness({
      getCurrentUserId: () => "user_c",
    });
    harness.scoreInputs[0].teamA.value = "11";
    harness.scoreInputs[0].teamB.value = "7";

    expect(() => harness.orchestration.collectMatchPayload()).toThrow(
      "You can only create a match if you are one of the participants.",
    );
  });

  it("requires a bracket selection before submitting tournament matches", () => {
    const harness = createHarness({
      getActiveTournamentBracketMatchId: () => null,
    });
    harness.formTournamentSelect.value = "tournament_1";
    harness.scoreInputs[0].teamA.value = "11";
    harness.scoreInputs[0].teamB.value = "8";

    expect(() => harness.orchestration.collectMatchPayload()).toThrow(
      "Select a tournament bracket match.",
    );
  });

  it("collects season payloads and resets season and tournament forms", () => {
    const harness = createHarness();
    harness.seasonNameInput.value = "Updated Season";
    harness.seasonStartDateInput.value = "2026-04-01";
    harness.seasonEndDateInput.value = "";
    harness.seasonBaseEloSelect.value = "reset";
    harness.seasonIsActiveInput.checked = true;
    harness.seasonIsPublicInput.checked = true;
    harness.loadSeasonSelect.value = "season_1";
    harness.loadTournamentSelect.value = "tournament_1";
    harness.tournamentNameInput.value = "Cup";
    harness.tournamentDateInput.value = "2026-04-08";
    harness.tournamentSeasonSelect.value = "season_1";

    expect(harness.orchestration.collectSeasonPayload()).toEqual({
      seasonId: "season_editing",
      name: "Updated Season",
      startDate: "2026-04-01",
      endDate: null,
      isActive: true,
      baseEloMode: "reset",
      participantIds: ["user_b", "user_c"],
      isPublic: true,
    });

    harness.orchestration.resetSeasonForm();
    harness.orchestration.resetTournamentForm();

    expect(harness.dashboardState.editingSeasonId).toBe("");
    expect(harness.dashboardState.editingSeasonParticipantIds).toEqual(["user_a"]);
    expect(harness.dashboardState.seasonDraftMode).toBe("create");
    expect(harness.seasonNameInput.value).toBe("");
    expect(harness.seasonStartDateInput.value).toBe("2026-04-05");
    expect(harness.seasonBaseEloSelect.value).toBe("carry_over");
    expect(harness.seasonIsPublicInput.checked).toBe(false);
    expect(harness.loadSeasonSelect.value).toBe("");
    expect(harness.tournamentPlannerState.participantIds).toEqual(["user_a"]);
    expect(harness.tournamentPlannerState.rounds).toEqual([]);
    expect(harness.tournamentNameInput.value).toBe("");
    expect(harness.tournamentDateInput.value).toBe("2026-04-05");
    expect(harness.loadTournamentSelect.value).toBe("");
    expect(harness.seasonTargetIds.at(-1)).toBe("");
    expect(harness.tournamentTargetIds.at(-1)).toBe("");
  });

  it("enables the second player slots for open doubles matches", () => {
    const harness = createHarness();
    harness.matchTypeSelect.value = "doubles";

    harness.orchestration.populateMatchFormOptions();

    expect(harness.teamA2Select.disabled).toBe(false);
    expect(harness.teamB2Select.disabled).toBe(false);
  });

  it("disables season and tournament context toggles when none are available", () => {
    const harness = createHarness();
    harness.dashboardState.seasons = [];
    harness.dashboardState.tournaments = [];
    harness.contextToggle.dataset.mode = "tournament";

    harness.orchestration.populateMatchFormOptions();

    const openButton = harness.contextToggle.querySelector<HTMLButtonElement>('button[data-value="open"]');
    const seasonButton = harness.contextToggle.querySelector<HTMLButtonElement>('button[data-value="season"]');
    const tournamentButton = harness.contextToggle.querySelector<HTMLButtonElement>('button[data-value="tournament"]');

    expect(openButton?.disabled).toBe(false);
    expect(seasonButton?.disabled).toBe(true);
    expect(tournamentButton?.disabled).toBe(true);
    expect(harness.contextToggle.dataset.mode).toBe("open");
    expect(harness.formSeasonSelect.value).toBe("");
    expect(harness.formTournamentSelect.value).toBe("");
  });

  it("rejects season and tournament payloads when no target is selected", () => {
    const seasonHarness = createHarness();
    seasonHarness.contextToggle.dataset.mode = "season";
    seasonHarness.formSeasonSelect.value = "";
    seasonHarness.scoreInputs[0].teamA.value = "11";
    seasonHarness.scoreInputs[0].teamB.value = "8";

    expect(() => seasonHarness.orchestration.collectMatchPayload()).toThrow(
      "Select a season before creating a season match.",
    );

    const tournamentHarness = createHarness();
    tournamentHarness.contextToggle.dataset.mode = "tournament";
    tournamentHarness.formTournamentSelect.value = "";
    tournamentHarness.scoreInputs[0].teamA.value = "11";
    tournamentHarness.scoreInputs[0].teamB.value = "8";

    expect(() => tournamentHarness.orchestration.collectMatchPayload()).toThrow(
      "Select a tournament before creating a tournament match.",
    );
  });

  it("preserves a selected remote open-match player when rebuilding player selects", () => {
    const dashboardState = createDashboardStateStub();
    const tournamentPlannerState = createTournamentPlannerStateStub();
    const teamA1Select = document.createElement("select");
    const teamA2Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamB2Select = document.createElement("select");

    [teamA1Select, teamA2Select, teamB1Select, teamB2Select].forEach((select) => {
      addSelectOptions(select, [""]);
    });

    teamA1Select.append(new Option("Alice", "user_a"));
    teamA1Select.value = "user_a";
    teamB1Select.dataset.pendingValue = "user_remote";

    const orchestration = createFormOrchestration({
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
      matchTypeSelect: Object.assign(document.createElement("select"), { value: "singles" }),
      formatTypeSelect: Object.assign(document.createElement("select"), { value: "single_game" }),
      pointsToWinSelect: Object.assign(document.createElement("select"), { value: "11" }),
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect: document.createElement("select"),
      matchBracketSelect: document.createElement("select"),
      tournamentSeasonSelect: document.createElement("select"),
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
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
      getAllowedMatchPlayerIds: () => null,
      getMatchPlayerEntries: () => [
        { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
        { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
        { userId: "user_remote", displayName: "Cruz Novak", avatarUrl: null, elo: 1123, rank: Number.MAX_SAFE_INTEGER },
      ],
      formatDate: (value) => value,
      t: (key) => key,
    });

    orchestration.populateMatchFormOptions();

    expect(teamB1Select.value).toBe("user_remote");
    expect(Array.from(teamB1Select.options).some((option) => option.value === "user_remote")).toBe(true);
    expect(teamB1Select.dataset.pendingValue).toBeUndefined();
  });

});
