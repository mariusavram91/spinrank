vi.mock("../../../src/ui/features/createScreens/builders", () => ({
  buildMatchScreen: vi.fn(() => ({ matchMarker: "match-screen" })),
  buildSeasonCheckboxField: vi.fn((input: HTMLInputElement, labelKey: string) => {
    const label = document.createElement("label");
    label.dataset.labelKey = labelKey;
    label.append(input);
    return label;
  }),
  buildSeasonScreen: vi.fn(() => ({ seasonMarker: "season-screen" })),
  buildTournamentScreen: vi.fn(() => ({ tournamentMarker: "tournament-screen" })),
}));

vi.mock("../../../src/ui/features/dashboard/shell", () => ({
  buildDashboardHeader: vi.fn(() => ({ dashboardHeader: document.createElement("div") })),
  attachDashboardLayout: vi.fn(),
}));

vi.mock("../../../src/ui/shared/components/sharePanel", () => ({
  buildSharePanel: vi.fn((segmentType: "season" | "tournament") => ({
    section: document.createElement("section"),
    createButton: document.createElement("button"),
    copyButton: document.createElement("button"),
    status: document.createElement("p"),
    qrCanvas: document.createElement("canvas"),
    qrWrapper: document.createElement("div"),
    copyFeedback: Object.assign(document.createElement("span"), { textContent: segmentType }),
    animationTimer: null,
  })),
}));

import { assembleAppScreens } from "../../../src/ui/features/app/screenAssembly";
import {
  buildMatchScreen,
  buildSeasonCheckboxField,
  buildSeasonScreen,
  buildTournamentScreen,
} from "../../../src/ui/features/createScreens/builders";
import { attachDashboardLayout, buildDashboardHeader } from "../../../src/ui/features/dashboard/shell";
import { buildSharePanel } from "../../../src/ui/shared/components/sharePanel";

const createSelect = () => document.createElement("select");
const createButton = () => document.createElement("button");

describe("screen assembly", () => {
  it("assembles dashboard and editor screens with default season options and share panels", () => {
    const replaceOptions = vi.fn();
    const result = assembleAppScreens({
      replaceOptions,
      t: (key) => key,
      welcomeTitle: document.createElement("h2"),
      refreshButton: createButton(),
      welcomeText: document.createElement("p"),
      dashboard: document.createElement("section"),
      progressPanel: document.createElement("section"),
      dashboardStatus: document.createElement("p"),
      viewGrid: document.createElement("div"),
      leaderboardPanel: document.createElement("section"),
      matchesPanel: document.createElement("section"),
      seasonBaseEloSelect: createSelect(),
      seasonIsActiveInput: document.createElement("input"),
      seasonIsPublicInput: document.createElement("input"),
      createMatchScreen: document.createElement("section"),
      composerPanel: document.createElement("section"),
      composerTop: document.createElement("div"),
      composerHeading: document.createElement("div"),
      composerTitle: document.createElement("h3"),
      composerMeta: document.createElement("p"),
      closeCreateMatchButton: createButton(),
      matchQuickBar: document.createElement("div"),
      matchOutcome: document.createElement("p"),
      matchLockNotice: document.createElement("p"),
      matchForm: document.createElement("form"),
      composerStatus: document.createElement("p"),
      suggestMatchButton: createButton(),
      matchTypeSelect: createSelect(),
      formatTypeSelect: createSelect(),
      pointsToWinSelect: createSelect(),
      formSeasonSelect: createSelect(),
      formTournamentSelect: createSelect(),
      matchBracketSelect: createSelect(),
      teamA1Select: createSelect(),
      teamA2Select: createSelect(),
      teamB1Select: createSelect(),
      teamB2Select: createSelect(),
      winnerTeamSelect: createSelect(),
      scoreInputs: [
        {
          teamA: document.createElement("input"),
          teamB: document.createElement("input"),
          teamALabel: document.createElement("span"),
          teamBLabel: document.createElement("span"),
        },
      ],
      submitMatchButton: createButton(),
      createTournamentScreen: document.createElement("section"),
      tournamentPanel: document.createElement("section"),
      tournamentTop: document.createElement("div"),
      tournamentHeading: document.createElement("div"),
      tournamentTitle: document.createElement("h3"),
      tournamentMeta: document.createElement("p"),
      closeCreateTournamentButton: createButton(),
      tournamentQuickBar: document.createElement("div"),
      tournamentInsights: document.createElement("div"),
      participantSection: document.createElement("div"),
      participantLabel: document.createElement("span"),
      participantSearchInput: document.createElement("input"),
      participantSearchResults: document.createElement("div"),
      participantList: document.createElement("div"),
      suggestTournamentButton: createButton(),
      saveTournamentButton: createButton(),
      deleteTournamentButton: createButton(),
      tournamentStatus: document.createElement("p"),
      loadTournamentSelect: createSelect(),
      resetTournamentDraftButton: createButton(),
      tournamentSeasonSelect: createSelect(),
      tournamentNameInput: document.createElement("input"),
      tournamentDateInput: document.createElement("input"),
      bracketBoard: document.createElement("div"),
      createSeasonScreen: document.createElement("section"),
      seasonPanel: document.createElement("section"),
      seasonTop: document.createElement("div"),
      seasonHeading: document.createElement("div"),
      seasonTitle: document.createElement("h3"),
      seasonMeta: document.createElement("p"),
      closeCreateSeasonButton: createButton(),
      seasonQuickBar: document.createElement("div"),
      seasonInsights: document.createElement("div"),
      seasonForm: document.createElement("form"),
      seasonStatus: document.createElement("p"),
      loadSeasonSelect: createSelect(),
      resetSeasonDraftButton: createButton(),
      seasonNameInput: document.createElement("input"),
      seasonStartDateInput: document.createElement("input"),
      seasonEndDateInput: document.createElement("input"),
      seasonParticipantSection: document.createElement("div"),
      seasonParticipantLabel: document.createElement("span"),
      seasonParticipantSearchInput: document.createElement("input"),
      seasonParticipantResults: document.createElement("div"),
      seasonParticipantList: document.createElement("div"),
      submitSeasonButton: createButton(),
      deleteSeasonButton: createButton(),
    });

    expect(buildDashboardHeader).toHaveBeenCalled();
    expect(attachDashboardLayout).toHaveBeenCalled();
    expect(replaceOptions).toHaveBeenCalledWith(
      expect.any(HTMLSelectElement),
      [
        { value: "carry_over", label: "carryOverElo" },
        { value: "reset_1200", label: "resetElo" },
      ],
      "carry_over",
      "carryOverElo",
    );
    expect(buildSeasonCheckboxField).toHaveBeenCalledTimes(2);
    expect(buildSeasonCheckboxField).toHaveBeenNthCalledWith(1, expect.any(HTMLInputElement), "seasonActiveLabel");
    expect(buildSeasonCheckboxField).toHaveBeenNthCalledWith(2, expect.any(HTMLInputElement), "seasonPublicLabel");
    expect(buildMatchScreen).toHaveBeenCalled();
    expect(buildTournamentScreen).toHaveBeenCalled();
    expect(buildSeasonScreen).toHaveBeenCalled();
    expect(buildSharePanel).toHaveBeenNthCalledWith(1, "season");
    expect(buildSharePanel).toHaveBeenNthCalledWith(2, "tournament");
    expect(result).toMatchObject({
      matchMarker: "match-screen",
      tournamentMarker: "tournament-screen",
      seasonMarker: "season-screen",
    });
    expect(result.seasonSharePanelInstance.copyFeedback.textContent).toBe("season");
    expect(result.tournamentSharePanelInstance.copyFeedback.textContent).toBe("tournament");
  });
});
