import { createLockHelpers } from "../../../src/ui/features/app/locks";
import type { DashboardState, TournamentPlannerState } from "../../../src/ui/shared/types/app";

const makeHarness = (overrides?: {
  dashboardState?: Partial<DashboardState>;
  tournamentPlannerState?: Partial<TournamentPlannerState>;
  activeBracketMatchId?: string | null;
  isLockedSeason?: (season: any) => boolean;
  isLockedTournament?: (tournament: any) => boolean;
}) => {
  const formSeasonSelect = document.createElement("select");
  const formTournamentSelect = document.createElement("select");
  const submitMatchButton = document.createElement("button");
  const matchLockNotice = document.createElement("div");

  const seasonOption = document.createElement("option");
  seasonOption.value = "season_1";
  formSeasonSelect.append(seasonOption);
  formSeasonSelect.value = "season_1";

  const tournamentOption = document.createElement("option");
  tournamentOption.value = "tournament_1";
  formTournamentSelect.append(tournamentOption);

  const dashboardState = {
    seasons: [{ id: "season_1", status: "active" }],
    tournaments: [{ id: "tournament_1", status: "active" }],
    matchSubmitting: false,
    loading: false,
    ...overrides?.dashboardState,
  } as DashboardState;

  const tournamentPlannerState = {
    rounds: [],
    ...overrides?.tournamentPlannerState,
  } as TournamentPlannerState;

  const helpers = createLockHelpers({
    dashboardState,
    tournamentPlannerState,
    formSeasonSelect,
    formTournamentSelect,
    submitMatchButton,
    matchLockNotice,
    getActiveTournamentBracketMatchId: () => overrides?.activeBracketMatchId ?? null,
    isLockedSeason: overrides?.isLockedSeason ?? (() => false),
    isLockedTournament: overrides?.isLockedTournament ?? (() => false),
    t: (key) => key,
  });

  return {
    helpers,
    formTournamentSelect,
    submitMatchButton,
    matchLockNotice,
  };
};

describe("match lock helpers", () => {
  it("blocks tournament matches when no eligible bracket match is selected", () => {
    const harness = makeHarness({ activeBracketMatchId: null });
    harness.formTournamentSelect.value = "tournament_1";

    harness.helpers.syncMatchFormLockState();

    expect(harness.submitMatchButton.disabled).toBe(true);
    expect(harness.matchLockNotice.hidden).toBe(false);
    expect(harness.matchLockNotice.textContent).toBe("matchBracketNoEligible");
  });

  it("surfaces locked tournament and bracket states", () => {
    const lockedTournament = makeHarness({
      activeBracketMatchId: "match_1",
      isLockedTournament: () => true,
    });
    lockedTournament.formTournamentSelect.value = "tournament_1";
    lockedTournament.helpers.syncMatchFormLockState();
    expect(lockedTournament.matchLockNotice.textContent).toBe("matchLockTournamentComplete");

    const lockedBracket = makeHarness({
      activeBracketMatchId: "match_2",
      tournamentPlannerState: {
        rounds: [{
          title: "Final",
          matches: [{
            id: "match_2",
            leftPlayerId: "user_1",
            rightPlayerId: "user_2",
            locked: true,
            createdMatchId: null,
          }],
        }],
      },
    });
    lockedBracket.formTournamentSelect.value = "tournament_1";
    lockedBracket.helpers.syncMatchFormLockState();
    expect(lockedBracket.matchLockNotice.textContent).toBe("matchLockBracketLocked");
  });

  it("detects tournament progress from completed or advanced matches", () => {
    const completed = makeHarness({
      tournamentPlannerState: {
        rounds: [{
          title: "Round 1",
          matches: [{
            id: "match_1",
            leftPlayerId: "user_1",
            rightPlayerId: "user_2",
            createdMatchId: "created_1",
          }],
        }],
      },
    });
    expect(completed.helpers.hasTournamentProgress()).toBe(true);

    const advanced = makeHarness({
      tournamentPlannerState: {
        rounds: [
          { title: "Round 1", matches: [{ id: "match_1", leftPlayerId: null, rightPlayerId: null }] },
          { title: "Round 2", matches: [{ id: "match_2", leftPlayerId: "user_1", rightPlayerId: null }] },
        ],
      },
    });
    expect(advanced.helpers.hasTournamentProgress()).toBe(true);
  });
});
