import { createParticipantEditors } from "../../../src/ui/features/app/participantEditors";
import type { DashboardState, TournamentPlannerState } from "../../../src/ui/shared/types/app";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createDashboardState = (): DashboardState =>
  ({
    players: [
      { userId: "user_a", displayName: "Alice", avatarUrl: null, elo: 1200, rank: 1 },
      { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, rank: 2 },
      { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, rank: 3 },
    ],
    seasons: [{ id: "season_1", participantIds: ["user_a", "user_b", "user_c"], status: "active", name: "Spring" }],
    tournaments: [
      {
        id: "tournament_1",
        participantIds: ["user_a", "user_b"],
        status: "active",
        seasonId: "season_1",
        bracketStatus: "draft",
      },
    ],
    editingSeasonParticipantIds: ["user_a"],
    editingSeasonId: "season_1",
    seasonParticipantQuery: "",
    seasonParticipantResults: [],
    seasonParticipantSearchLoading: false,
    seasonParticipantSearchError: "",
  } as unknown as DashboardState);

const createTournamentPlannerState = (): TournamentPlannerState =>
  ({
    participantIds: ["user_a", "user_b"],
    participantQuery: "",
    participantResults: [],
    participantSearchLoading: false,
    participantSearchError: "",
    firstRoundMatches: [{ id: "m1", leftPlayerId: "user_a", rightPlayerId: "user_b" }],
    rounds: [{ title: "Final", matches: [{ id: "m1", leftPlayerId: "user_a", rightPlayerId: "user_b" }] }],
    tournamentId: "tournament_1",
    error: "",
  } as unknown as TournamentPlannerState);

const createHarness = () => {
  const dashboardState = createDashboardState();
  const tournamentPlannerState = createTournamentPlannerState();
  const seasonParticipantList = document.createElement("div");
  const seasonParticipantSearchInput = document.createElement("input");
  const seasonParticipantResults = document.createElement("div");
  const participantList = document.createElement("div");
  const participantSearchInput = document.createElement("input");
  const participantSearchResults = document.createElement("div");
  const bracketBoard = document.createElement("div");
  const tournamentSeasonSelect = document.createElement("select");
  tournamentSeasonSelect.append(new Option("Spring", "season_1"));
  tournamentSeasonSelect.value = "season_1";
  const loadTournamentSelect = document.createElement("select");
  loadTournamentSelect.append(new Option("Saved", "tournament_1"));
  loadTournamentSelect.value = "tournament_1";

  const args = {
    dashboardState,
    tournamentPlannerState,
    getEditingSeason: () => dashboardState.seasons[0],
    getEditingTournament: () => dashboardState.tournaments[0],
    getSessionUserId: () => "user_a",
    isLockedSeason: vi.fn().mockReturnValue(false),
    isLockedTournament: vi.fn().mockReturnValue(false),
    seasonParticipantList,
    seasonParticipantSearchInput,
    seasonParticipantResults,
    participantList,
    participantSearchInput,
    participantSearchResults,
    bracketBoard,
    tournamentSeasonSelect,
    loadTournamentSelect,
    setTournamentSharePanelTargetId: vi.fn(),
    syncDashboardState: vi.fn(),
    runAuthedAction: vi.fn().mockImplementation(async (action: string) => {
      if (action === "searchParticipants") {
        return {
          participants: [
            { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, isSuggested: true },
            { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, isSuggested: true },
          ],
        };
      }
      if (action === "getSegmentLeaderboard") {
        return {
          leaderboard: [],
          stats: null,
          updatedAt: "",
        };
      }
      throw new Error(`Unexpected action ${action}`);
    }),
    renderPlayerNames: (playerIds: string[], players: DashboardState["players"]) =>
      playerIds
        .map((playerId) => players.find((player) => player.userId === playerId)?.displayName || playerId)
        .join(" / "),
    findPlayer: (playerId: string | null | undefined, players: DashboardState["players"]) =>
      players.find((player) => player.userId === playerId),
    advanceTournamentBye: vi.fn().mockResolvedValue(undefined),
    prefillMatchFromTournamentPairing: vi.fn(),
    assetsBaseUrl: "/",
    t: (key: string) => key,
  };

  return {
    args,
    editors: createParticipantEditors(args),
    seasonParticipantResults,
    participantSearchInput,
    participantSearchResults,
    bracketBoard,
    loadTournamentSelect,
  };
};

describe("participant editors", () => {
  it("loads season search results and adds a participant through the rendered result row", async () => {
    const harness = createHarness();

    harness.editors.renderSeasonEditor();
    await flush();

    expect(harness.args.runAuthedAction).toHaveBeenCalledWith("searchParticipants", {
      segmentType: "season",
      query: "",
      limit: 12,
    });
    expect(harness.seasonParticipantResults.querySelectorAll("[data-testid='participant-add-button']")).toHaveLength(2);

    (harness.seasonParticipantResults.querySelector("[data-testid='participant-add-button']") as HTMLButtonElement).click();

    expect(harness.args.dashboardState.editingSeasonParticipantIds).toEqual(["user_a", "user_b"]);
    expect(harness.args.syncDashboardState).toHaveBeenCalled();
  });

  it("keeps the current user in tournament participants and prevents removing them", async () => {
    const harness = createHarness();
    harness.args.tournamentPlannerState.participantIds = ["user_b"];

    harness.editors.renderTournamentPlanner();
    await flush();

    expect(harness.args.tournamentPlannerState.participantIds).toEqual(["user_a", "user_b"]);

    const currentUserChip = harness.args.participantList.querySelector(
      "[data-participant-id='user_a'] [data-testid='participant-remove-button']",
    ) as HTMLButtonElement | null;

    expect(currentUserChip?.disabled).toBe(true);
  });

  it("disables removing season participants who already played at least one season match", async () => {
    const harness = createHarness();
    harness.args.dashboardState.editingSeasonParticipantIds = ["user_a", "user_b", "user_c"];
    vi.mocked(harness.args.runAuthedAction).mockImplementation(async (action: string) => {
      if (action === "searchParticipants") {
        return {
          participants: [
            { userId: "user_b", displayName: "Bob", avatarUrl: null, elo: 1180, isSuggested: true },
            { userId: "user_c", displayName: "Cara", avatarUrl: null, elo: 1160, isSuggested: true },
          ],
        };
      }
      if (action === "getSegmentLeaderboard") {
        return {
          leaderboard: [
            {
              userId: "user_b",
              displayName: "Bob",
              avatarUrl: null,
              elo: 1180,
              wins: 1,
              losses: 0,
              streak: 1,
              rank: 1,
              matchEquivalentPlayed: 1,
            },
            {
              userId: "user_c",
              displayName: "Cara",
              avatarUrl: null,
              elo: 1160,
              wins: 0,
              losses: 0,
              streak: 0,
              rank: 2,
              matchEquivalentPlayed: 0,
            },
          ],
          stats: null,
          updatedAt: "",
        };
      }
      throw new Error(`Unexpected action ${action}`);
    });

    harness.editors.renderSeasonEditor();
    await flush();

    const playedParticipantButton = harness.args.seasonParticipantList.querySelector(
      "[data-participant-id='user_b'] [data-testid='participant-remove-button']",
    ) as HTMLButtonElement | null;
    const notPlayedParticipantButton = harness.args.seasonParticipantList.querySelector(
      "[data-participant-id='user_c'] [data-testid='participant-remove-button']",
    ) as HTMLButtonElement | null;

    expect(playedParticipantButton?.disabled).toBe(true);
    expect(notPlayedParticipantButton?.disabled).toBe(false);
  });

  it("renders tournament bracket actions and routes create-match clicks into the composer prefill", async () => {
    const harness = createHarness();

    harness.editors.renderTournamentPlanner();
    await flush();

    const createMatchButton = [...harness.bracketBoard.querySelectorAll("button")].find(
      (button) => button.textContent === harness.args.t("createMatch"),
    ) as HTMLButtonElement | undefined;

    expect(createMatchButton).toBeDefined();
    createMatchButton?.click();

    expect(harness.args.prefillMatchFromTournamentPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "m1",
        leftPlayerId: "user_a",
        rightPlayerId: "user_b",
      }),
    );
  });

  it("locks tournament participant editing once the bracket has started", async () => {
    const harness = createHarness();
    harness.args.dashboardState.tournaments[0].bracketStatus = "in_progress";

    harness.editors.renderTournamentPlanner();
    await flush();

    expect(harness.participantSearchInput.disabled).toBe(true);
    const removeButton = harness.args.participantList.querySelector(
      "[data-participant-id='user_b'] [data-testid='participant-remove-button']",
    ) as HTMLButtonElement | null;
    expect(removeButton?.disabled).toBe(true);
    const addButton = harness.participantSearchResults.querySelector(
      "[data-testid='participant-add-button']",
    ) as HTMLButtonElement | null;
    expect(addButton?.disabled).toBe(true);
  });

  it("refreshes tournament search results when the query changes", async () => {
    const harness = createHarness();

    harness.editors.renderTournamentPlanner();
    await flush();
    vi.mocked(harness.args.runAuthedAction).mockClear();

    harness.participantSearchInput.value = "Cara";
    harness.participantSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();

    expect(harness.args.runAuthedAction).toHaveBeenCalledWith("searchParticipants", {
      segmentType: "tournament",
      query: "Cara",
      seasonId: "season_1",
      limit: 12,
    });
    expect(harness.participantSearchResults.querySelectorAll("[data-testid='participant-search-result']")).toHaveLength(1);
  });
});
