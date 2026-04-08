vi.mock("../../../src/ui/shared/i18n/runtime", () => ({
  bindLocalizedText: vi.fn((element: HTMLElement, key: string) => {
    element.textContent = key;
  }),
  registerTranslation: vi.fn((callback: () => void) => {
    callback();
  }),
  t: vi.fn((key: string) => key),
}));

vi.mock("../../../src/ui/shared/components/formLayout", () => ({
  buildField: vi.fn((labelKey: string, control: HTMLElement) => {
    const label = document.createElement("label");
    label.dataset.labelKey = labelKey;
    label.append(control);
    return label;
  }),
  createPanelSection: vi.fn((_titleKey: string, ...children: HTMLElement[]) => {
    const section = document.createElement("section");
    section.append(...children);
    return section;
  }),
}));

import { buildMatchScreen } from "../../../src/ui/features/createScreens/builders";

const createSelect = (values: string[]): HTMLSelectElement => {
  const select = document.createElement("select");
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value || "empty";
    select.append(option);
  });
  return select;
};

const createMatchScreenArgs = () => {
  const formSeasonSelect = createSelect(["", "season_1"]);
  const formTournamentSelect = createSelect(["", "tournament_1"]);
  const teamA1Select = createSelect(["", "player_a1"]);
  const teamA2Select = createSelect(["", "player_a2"]);
  const teamB1Select = createSelect(["", "player_b1"]);
  const teamB2Select = createSelect(["", "player_b2"]);

  teamA1Select.value = "player_a1";
  teamA2Select.value = "player_a2";
  teamB1Select.value = "player_b1";
  teamB2Select.value = "player_b2";
  teamA1Select.dataset.pendingValue = "player_a1";
  teamA2Select.dataset.pendingValue = "player_a2";
  teamB1Select.dataset.pendingValue = "player_b1";
  teamB2Select.dataset.pendingValue = "player_b2";
  formSeasonSelect.value = "season_1";
  formTournamentSelect.value = "tournament_1";

  return {
    screen: document.createElement("section"),
    composerPanel: document.createElement("section"),
    composerTop: document.createElement("div"),
    composerHeading: document.createElement("div"),
    composerTitle: document.createElement("h3"),
    composerMeta: document.createElement("p"),
    closeCreateMatchButton: document.createElement("button"),
    matchQuickBar: document.createElement("div"),
    matchOutcome: document.createElement("p"),
    matchLockNotice: document.createElement("p"),
    matchForm: document.createElement("form"),
    composerStatus: document.createElement("p"),
    suggestMatchButton: document.createElement("button"),
    matchTypeSelect: createSelect(["singles", "doubles"]),
    formatTypeSelect: createSelect(["single_game", "best_of_3"]),
    pointsToWinSelect: createSelect(["11", "21"]),
    formSeasonSelect,
    formTournamentSelect,
    matchBracketSelect: createSelect([""]),
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    winnerTeamSelect: createSelect(["A", "B"]),
    scoreInputs: [
      {
        teamA: document.createElement("input"),
        teamB: document.createElement("input"),
        teamALabel: document.createElement("span"),
        teamBLabel: document.createElement("span"),
      },
    ],
    submitMatchButton: document.createElement("button"),
  };
};

describe("match screen builders", () => {
  it("clears selected players when changing match context", () => {
    const args = createMatchScreenArgs();
    const seasonChange = vi.fn();
    const tournamentChange = vi.fn();
    args.formSeasonSelect.addEventListener("change", seasonChange);
    args.formTournamentSelect.addEventListener("change", tournamentChange);

    const { contextToggle } = buildMatchScreen(args);
    const seasonButton = contextToggle.querySelector<HTMLButtonElement>('button[data-value="season"]');
    const openButton = contextToggle.querySelector<HTMLButtonElement>('button[data-value="open"]');

    seasonButton?.click();

    expect(args.teamA1Select.value).toBe("");
    expect(args.teamA2Select.value).toBe("");
    expect(args.teamB1Select.value).toBe("");
    expect(args.teamB2Select.value).toBe("");
    expect(args.teamA1Select.dataset.pendingValue).toBeUndefined();
    expect(args.teamA2Select.dataset.pendingValue).toBeUndefined();
    expect(args.teamB1Select.dataset.pendingValue).toBeUndefined();
    expect(args.teamB2Select.dataset.pendingValue).toBeUndefined();
    expect(args.formTournamentSelect.value).toBe("");
    expect(seasonChange).toHaveBeenCalledTimes(1);

    args.teamA1Select.value = "player_a1";
    args.teamB1Select.value = "player_b1";

    openButton?.click();

    expect(args.teamA1Select.value).toBe("");
    expect(args.teamB1Select.value).toBe("");
    expect(args.formSeasonSelect.value).toBe("");
    expect(args.formTournamentSelect.value).toBe("");
    expect(seasonChange).toHaveBeenCalledTimes(2);
    expect(tournamentChange).toHaveBeenCalledTimes(0);
  });
});
