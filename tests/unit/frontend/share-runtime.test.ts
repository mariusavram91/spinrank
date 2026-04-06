import { createShareRuntime } from "../../../src/ui/features/app/shareRuntime";
import type { DashboardState, SharePanelElements } from "../../../src/ui/shared/types/app";

const createSharePanel = (): SharePanelElements => ({
  section: document.createElement("section"),
  createButton: document.createElement("button"),
  copyButton: document.createElement("button"),
  status: document.createElement("p"),
  qrCanvas: document.createElement("canvas"),
  qrWrapper: document.createElement("div"),
  copyFeedback: document.createElement("span"),
  animationTimer: null,
});

const createHarness = (overrides?: {
  dashboardState?: Partial<DashboardState>;
  editingSeason?: any;
  editingTournament?: any;
  isLockedSeason?: (season: any) => boolean;
  isLockedTournament?: (tournament: any) => boolean;
}) => {
  const seasonForm = document.createElement("form");
  const tournamentPanel = document.createElement("section");
  const seasonActionsWrapper = document.createElement("div");
  const tournamentActionsWrapper = document.createElement("div");
  seasonForm.append(seasonActionsWrapper);
  tournamentPanel.append(tournamentActionsWrapper);

  const dashboardState = {
    sharePanelSeasonTargetId: "",
    sharePanelTournamentTargetId: "",
    ...overrides?.dashboardState,
  } as DashboardState;

  const runtime = createShareRuntime({
    dashboardState,
    seasonForm,
    tournamentPanel,
    getSeasonActionsWrapper: () => seasonActionsWrapper,
    getTournamentActionsWrapper: () => tournamentActionsWrapper,
    getEditingSeason: () => overrides?.editingSeason,
    getEditingTournament: () => overrides?.editingTournament,
    isLockedSeason: overrides?.isLockedSeason ?? (() => false),
    isLockedTournament: overrides?.isLockedTournament ?? (() => false),
  });

  return {
    runtime,
    seasonForm,
    tournamentPanel,
    seasonActionsWrapper,
    tournamentActionsWrapper,
  };
};

describe("share runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies through the clipboard api when available", async () => {
    const harness = createHarness();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await harness.runtime.copyTextToClipboard("https://example.test/share");

    expect(writeText).toHaveBeenCalledWith("https://example.test/share");
    vi.unstubAllGlobals();
  });

  it("falls back to execCommand and rejects empty values", async () => {
    const harness = createHarness();
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await harness.runtime.copyTextToClipboard("share-value");
    expect(execCommand).toHaveBeenCalledWith("copy");

    await expect(harness.runtime.copyTextToClipboard("")).rejects.toThrow("Nothing to copy.");
  });

  it("shows transient copy feedback", () => {
    const harness = createHarness();
    const notice = document.createElement("span");

    harness.runtime.showCopyFeedback("season", notice, "Copied");
    expect(notice.textContent).toBe("Copied");

    vi.advanceTimersByTime(2000);
    expect(notice.textContent).toBe("");
  });

  it("mounts and unmounts share panels based on target ids and lock state", () => {
    const seasonPanel = createSharePanel();
    const tournamentPanel = createSharePanel();

    const harness = createHarness({
      dashboardState: {
        sharePanelSeasonTargetId: "season_1",
        sharePanelTournamentTargetId: "tournament_1",
      },
    });

    harness.runtime.updateSeasonSharePanelVisibility(seasonPanel);
    harness.runtime.updateTournamentSharePanelVisibility(tournamentPanel);
    expect(harness.seasonForm.firstElementChild).toBe(seasonPanel.section);
    expect(harness.tournamentPanel.firstElementChild).toBe(tournamentPanel.section);

    const lockedHarness = createHarness({
      dashboardState: {
        sharePanelSeasonTargetId: "season_1",
        sharePanelTournamentTargetId: "tournament_1",
      },
      editingSeason: { id: "season_1" },
      editingTournament: { id: "tournament_1" },
      isLockedSeason: () => true,
      isLockedTournament: () => true,
    });

    lockedHarness.runtime.updateSeasonSharePanelVisibility(seasonPanel);
    lockedHarness.runtime.updateTournamentSharePanelVisibility(tournamentPanel);
    expect(lockedHarness.seasonForm.contains(seasonPanel.section)).toBe(false);
    expect(lockedHarness.tournamentPanel.contains(tournamentPanel.section)).toBe(false);
  });
});
