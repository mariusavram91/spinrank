import { createDraftRenderers } from "../../../src/ui/features/dashboard/renderers/drafts";
import type { DashboardState, TournamentPlannerState } from "../../../src/ui/shared/types/app";

describe("draft renderers", () => {
  it("uses selected option labels for searched players missing from dashboard players", () => {
    const teamA1Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamAOption = document.createElement("option");
    teamAOption.value = "user_search";
    teamAOption.textContent = "Cara Search (1160)";
    teamAOption.selected = true;
    teamA1Select.append(teamAOption);
    const teamBOption = document.createElement("option");
    teamBOption.value = "user_known";
    teamBOption.textContent = "Bob Known (1180)";
    teamBOption.selected = true;
    teamB1Select.append(teamBOption);

    const scoreInputs = [
      {
        teamA: document.createElement("input"),
        teamB: document.createElement("input"),
        teamALabel: document.createElement("span"),
        teamBLabel: document.createElement("span"),
      },
    ];

    const renderers = createDraftRenderers({
      dashboardState: {
        players: [{ userId: "user_known", displayName: "Bob Known", avatarUrl: null, elo: 1180, rank: 1 }],
      } as DashboardState,
      tournamentPlannerState: {} as TournamentPlannerState,
      matchOutcome: document.createElement("div"),
      seasonSummary: document.createElement("div"),
      tournamentSummary: document.createElement("div"),
      seasonStartDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsPublicInput: document.createElement("input"),
      seasonIsActiveInput: document.createElement("input"),
      tournamentSeasonSelect: document.createElement("select"),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      matchTypeSelect: Object.assign(document.createElement("select"), { value: "singles" }),
      formatTypeSelect: Object.assign(document.createElement("select"), { value: "single_game" }),
      pointsToWinSelect: Object.assign(document.createElement("select"), { value: "11" }),
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect: document.createElement("select"),
      winnerTeamSelect: document.createElement("select"),
      teamA1Select,
      teamA2Select: document.createElement("select"),
      teamB1Select,
      teamB2Select: document.createElement("select"),
      scoreInputs,
      renderPlayerNames: (playerIds, players) =>
        playerIds
          .map((playerId) => players.find((player) => player.userId === playerId)?.displayName || playerId)
          .join(" / "),
      buildUniquePlayerList: (values) => values.filter(Boolean),
      getMatchFeedContextLabel: () => "",
      t: (key) => key,
    });

    renderers.renderMatchDraftSummary();

    expect(scoreInputs[0]?.teamALabel.textContent).toBe("Cara Search");
    expect(scoreInputs[0]?.teamBLabel.textContent).toBe("Bob Known");
  });

  it("uses current select labels for mixed doubles teams instead of raw ids", () => {
    const teamA1Select = document.createElement("select");
    const teamA2Select = document.createElement("select");
    const teamB1Select = document.createElement("select");
    const teamB2Select = document.createElement("select");

    teamA1Select.append(new Option("Nora Klein (1268)", "user_nora"));
    teamA2Select.append(new Option("Kai Schmidt (1261)", "user_kai"));
    teamB1Select.append(new Option("Cruz Novak (1123)", "user_cruz"));
    teamB2Select.append(new Option("Kai Schmidt (1261)", "user_kai"));

    teamA1Select.value = "user_nora";
    teamA2Select.value = "user_kai";
    teamB1Select.value = "user_cruz";
    teamB2Select.value = "user_kai";

    const scoreInputs = [
      {
        teamA: document.createElement("input"),
        teamB: document.createElement("input"),
        teamALabel: document.createElement("span"),
        teamBLabel: document.createElement("span"),
      },
    ];

    const renderers = createDraftRenderers({
      dashboardState: {
        players: [{ userId: "user_kai", displayName: "Kai Schmidt", avatarUrl: null, elo: 1261, rank: 1 }],
      } as DashboardState,
      tournamentPlannerState: {} as TournamentPlannerState,
      matchOutcome: document.createElement("div"),
      seasonSummary: document.createElement("div"),
      tournamentSummary: document.createElement("div"),
      seasonStartDateInput: document.createElement("input"),
      seasonBaseEloSelect: document.createElement("select"),
      seasonIsPublicInput: document.createElement("input"),
      seasonIsActiveInput: document.createElement("input"),
      tournamentSeasonSelect: document.createElement("select"),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      matchTypeSelect: Object.assign(document.createElement("select"), { value: "doubles" }),
      formatTypeSelect: Object.assign(document.createElement("select"), { value: "single_game" }),
      pointsToWinSelect: Object.assign(document.createElement("select"), { value: "11" }),
      formSeasonSelect: document.createElement("select"),
      formTournamentSelect: document.createElement("select"),
      winnerTeamSelect: document.createElement("select"),
      teamA1Select,
      teamA2Select,
      teamB1Select,
      teamB2Select,
      scoreInputs,
      renderPlayerNames: (playerIds, players) =>
        playerIds
          .map((playerId) => players.find((player) => player.userId === playerId)?.displayName || playerId)
          .join(" / "),
      buildUniquePlayerList: (values) => values.filter(Boolean),
      getMatchFeedContextLabel: () => "",
      t: (key) => key,
    });

    renderers.renderMatchDraftSummary();

    expect(scoreInputs[0]?.teamBLabel.textContent).toBe("Cruz Novak / Kai Schmidt");
  });
});
