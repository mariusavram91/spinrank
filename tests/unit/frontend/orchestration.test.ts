import { createDashboardSelectors, createFormStatusOrchestration, createShareOrchestration } from "../../../src/ui/features/app/orchestration";
import type { SharePanelElements, TournamentPlannerState } from "../../../src/ui/shared/types/app";

const createSharePanel = (): SharePanelElements =>
  ({
    section: document.createElement("section"),
    createButton: document.createElement("button"),
    copyButton: document.createElement("button"),
    status: document.createElement("p"),
    qrWrapper: document.createElement("div"),
    qrCanvas: document.createElement("canvas"),
    copyFeedback: document.createElement("span"),
    animationTimer: null,
  });

describe("app orchestration helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects current dashboard entities and controls the loading overlay", () => {
    const setGlobalLoadingDom = vi.fn();
    const dashboardState = {
      selectedSeasonId: "season_1",
      selectedTournamentId: "tournament_1",
      editingSeasonId: "season_2",
      seasons: [{ id: "season_1" }, { id: "season_2" }],
      tournaments: [{ id: "tournament_1" }],
    };
    const tournamentPlannerState = { tournamentId: "tournament_1" };

    const selectors = createDashboardSelectors({
      dashboardState,
      tournamentPlannerState,
      getSeasonId: (season) => season.id,
      getTournamentId: (tournament) => tournament.id,
      setGlobalLoadingDom,
      t: () => "Loading…",
    });

    selectors.setGlobalLoading(true);
    selectors.setGlobalLoading(false, "Saving");

    expect(setGlobalLoadingDom).toHaveBeenNthCalledWith(1, true, "Loading…");
    expect(setGlobalLoadingDom).toHaveBeenNthCalledWith(2, false, "Saving");
    expect(selectors.getSelectedSeason()).toEqual({ id: "season_1" });
    expect(selectors.getSelectedTournament()).toEqual({ id: "tournament_1" });
    expect(selectors.getEditingSeason()).toEqual({ id: "season_2" });
    expect(selectors.getEditingTournament()).toEqual({ id: "tournament_1" });
  });

  it("clears form statuses after their timeout", () => {
    const dashboardState = {
      profileFormMessage: "Saved profile",
      matchFormError: "Bad score",
      matchFormMessage: "",
      seasonFormError: "",
      seasonFormMessage: "Saved season",
      tournamentFormMessage: "Saved tournament",
    };
    const tournamentPlannerState = { error: "Planner error" } as TournamentPlannerState;
    const syncDashboardState = vi.fn();

    const orchestration = createFormStatusOrchestration({
      dashboardState,
      tournamentPlannerState,
      syncDashboardState,
    });

    orchestration.scheduleFormStatusHide("profile", true);
    orchestration.scheduleFormStatusHide("match", true);
    orchestration.scheduleFormStatusHide("season", true);
    orchestration.scheduleFormStatusHide("tournament", true);
    vi.advanceTimersByTime(5000);

    expect(dashboardState.profileFormMessage).toBe("");
    expect(dashboardState.matchFormError).toBe("");
    expect(dashboardState.seasonFormMessage).toBe("");
    expect(dashboardState.tournamentFormMessage).toBe("");
    expect(tournamentPlannerState.error).toBe("");
    expect(syncDashboardState).toHaveBeenCalledTimes(4);
  });

  it("formats share state, animates panels, and updates share ui", () => {
    const dashboardState = {
      sharePanelSeasonTargetId: "",
      sharePanelTournamentTargetId: "",
      shareErrors: { "season:season_1": "No share" },
      shareLoadingSegmentKey: "tournament:tournament_1",
      shareCache: {
        "season:season_1": {
          url: "https://example.test/share/season_1",
        },
      },
      shareNotice: "",
      shareAlertMessage: "",
    };
    const syncDashboardState = vi.fn();
    const renderShareQr = vi.fn().mockResolvedValue(undefined);
    const setShareAlertVisible = vi.fn();

    const orchestration = createShareOrchestration({
      dashboardState,
      syncDashboardState,
      renderShareQr,
      t: (key) =>
        ({
          shareExpired: "Expired",
          shareExpiresInDays: "Expires in {days} days",
          shareExpiresInHours: "Expires in {hours} hours",
          shareExpiresInMinutes: "Expires in {minutes} minutes",
          shareNoSegment: "Select a segment",
        })[key],
      setShareAlertVisible,
    });

    orchestration.setSeasonSharePanelTargetId("season_1");
    orchestration.setTournamentSharePanelTargetId("tournament_1");
    expect(orchestration.getSeasonShareTargetId()).toBe("season_1");
    expect(orchestration.getTournamentShareTargetId()).toBe("tournament_1");
    expect(orchestration.buildSegmentShareKey("season", "season_1")).toBe("season:season_1");
    expect(orchestration.formatShareExpiration("2026-04-08T12:00:00.000Z")).toBe("Expires in 2 days");
    expect(orchestration.formatShareExpiration("2026-04-06T14:00:00.000Z")).toBe("Expires in 2 hours");
    expect(orchestration.formatShareExpiration("2026-04-06T12:15:00.000Z")).toBe("Expires in 15 minutes");
    expect(orchestration.formatShareExpiration("2026-04-06T11:59:00.000Z")).toBe("Expired");

    const panel = createSharePanel();
    orchestration.animateSharePanel(panel);
    expect(panel.section.classList.contains("share-panel--pulse")).toBe(true);
    vi.advanceTimersByTime(700);
    expect(panel.section.classList.contains("share-panel--pulse")).toBe(false);

    orchestration.updateSharePanelElements(
      panel,
      "season",
      "season_1",
      "",
      vi.fn(),
    );
    expect(panel.copyButton.disabled).toBe(false);
    expect(panel.status.textContent).toBe("No share");
    expect(renderShareQr).toHaveBeenCalledWith(panel.qrCanvas, "https://example.test/share/season_1");

    orchestration.showShareAlert("Shared");
    expect(setShareAlertVisible).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(6000);
    expect(dashboardState.shareAlertMessage).toBe("");
    expect(setShareAlertVisible).toHaveBeenLastCalledWith(false);
  });
});
