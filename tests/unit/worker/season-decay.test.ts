import {
  computeSeasonEffectiveState,
  INACTIVITY_RD_CAP,
  INACTIVITY_RD_PER_WEEK,
} from "../../../worker/src/services/season-decay";
import { SEASON_RULES_EPOCH_ISO } from "../../../worker/src/services/season-rules";

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const EPOCH_MS = Date.parse(SEASON_RULES_EPOCH_ISO);

function atWeeksAfterEpoch(weeks: number): string {
  return new Date(EPOCH_MS + weeks * WEEK_MS).toISOString();
}

function scoreOf(args: {
  rating: number;
  rd: number;
  lastMatchAt: string | null;
  storedAttendancePenalty?: number;
  weeksIdle: number;
  seasonEndDate?: string | null;
}) {
  return computeSeasonEffectiveState({
    rating: args.rating,
    rd: args.rd,
    lastMatchAt: args.lastMatchAt,
    storedAttendancePenalty: args.storedAttendancePenalty ?? 0,
    nowIso: atWeeksAfterEpoch(args.weeksIdle),
    seasonEndDate: args.seasonEndDate ?? null,
  });
}

describe("season decay", () => {
  it("pins the standard Glicko c constant", () => {
    expect(INACTIVITY_RD_PER_WEEK).toBe(10);
    expect(INACTIVITY_RD_CAP).toBe(250);
  });

  it("reports zero idle weeks when the last match is after the epoch", () => {
    const state = scoreOf({ rating: 1400, rd: 90, lastMatchAt: atWeeksAfterEpoch(2), weeksIdle: 2 });

    expect(state.weeksIdle).toBe(0);
    expect(state.rd).toBe(90);
    expect(state.score).toBe(1400 - 2 * 90);
  });

  it("reports zero idle weeks on the epoch itself", () => {
    const state = computeSeasonEffectiveState({
      rating: 1400,
      rd: 90,
      lastMatchAt: atWeeksAfterEpoch(-5),
      storedAttendancePenalty: 0,
      nowIso: SEASON_RULES_EPOCH_ISO,
      seasonEndDate: null,
    });

    expect(state.weeksIdle).toBe(0);
    expect(state.rd).toBe(90);
  });

  it("never shrinks an RD already above the cap, even at zero idle weeks", () => {
    const state = scoreOf({ rating: 1200, rd: 350, lastMatchAt: atWeeksAfterEpoch(-1), weeksIdle: 0 });

    expect(state.rd).toBe(350);
    expect(state.conservativeRating).toBe(1200 - 2 * 350);
  });

  it("keeps a high RD at its stored value for short absences", () => {
    expect(scoreOf({ rating: 1200, rd: 350, lastMatchAt: atWeeksAfterEpoch(-3), weeksIdle: 2 }).rd).toBe(350);
  });

  it("never pulls a mid-range RD down to the cap", () => {
    expect(scoreOf({ rating: 1400, rd: 300, lastMatchAt: atWeeksAfterEpoch(-1), weeksIdle: 40 }).rd).toBe(300);
  });

  it("grows a settled RD by the documented amount over four idle weeks", () => {
    const state = scoreOf({ rating: 1425, rd: 97.2, lastMatchAt: atWeeksAfterEpoch(-4), weeksIdle: 4 });

    expect(state.weeksIdle).toBe(4);
    expect(state.rd).toBeCloseTo(99.24, 2);
  });

  it("caps absence-driven growth at the constant", () => {
    expect(scoreOf({ rating: 1400, rd: 100, lastMatchAt: atWeeksAfterEpoch(-525), weeksIdle: 525 }).rd).toBe(
      INACTIVITY_RD_CAP,
    );
    expect(scoreOf({ rating: 1400, rd: 100, lastMatchAt: atWeeksAfterEpoch(-5000), weeksIdle: 5000 }).rd).toBe(
      INACTIVITY_RD_CAP,
    );
  });

  it("leaves a player with no recorded match at their stored RD", () => {
    expect(scoreOf({ rating: 1200, rd: 350, lastMatchAt: null, weeksIdle: 40 }).rd).toBe(350);
    expect(scoreOf({ rating: 1200, rd: 350, lastMatchAt: "", weeksIdle: 40 }).rd).toBe(350);
  });

  it("costs a settled player about one point per idle week", () => {
    const one = scoreOf({ rating: 1400, rd: 97, lastMatchAt: atWeeksAfterEpoch(-1), weeksIdle: 1 });
    const twelve = scoreOf({ rating: 1400, rd: 97, lastMatchAt: atWeeksAfterEpoch(-12), weeksIdle: 12 });
    const perWeek = (1400 - 2 * 97 - twelve.score) / 12;

    expect(1400 - 2 * 97 - one.score).toBe(1);
    expect(perWeek).toBeGreaterThan(0.9);
    expect(perWeek).toBeLessThan(1.1);
  });

  it("stops growing once the season has ended", () => {
    const seasonEndDate = "2026-11-22";
    const atEnd = scoreOf({ rating: 1400, rd: 90, lastMatchAt: atWeeksAfterEpoch(-1), weeksIdle: 3, seasonEndDate });
    const muchLater = scoreOf({ rating: 1400, rd: 90, lastMatchAt: atWeeksAfterEpoch(-1), weeksIdle: 300, seasonEndDate });

    expect(muchLater).toEqual(atEnd);
  });

  it("holds a completed season at its stored score indefinitely", () => {
    const state = scoreOf({
      rating: 1400,
      rd: 90,
      lastMatchAt: "2026-10-01T10:00:00.000Z",
      storedAttendancePenalty: 8,
      weeksIdle: 500,
      seasonEndDate: "2026-11-01",
    });

    expect(state.weeksIdle).toBe(0);
    expect(state.rd).toBe(90);
    expect(state.score).toBe(1400 - 2 * 90 - 8);
  });

  it("leaves the rating untouched so absence never re-prices the next match", () => {
    expect(scoreOf({ rating: 1437, rd: 90, lastMatchAt: atWeeksAfterEpoch(-6), weeksIdle: 6 }).rating).toBe(1437);
  });

  it("holds the score at the minimum once growth reaches it", () => {
    // Without absence growth this player sits 10 points clear of the minimum;
    // the larger RD lowers the conservative rating below it, so the stored
    // penalty is capped at the remaining headroom instead of overpaying.
    const state = scoreOf({
      rating: 1400,
      rd: 90,
      lastMatchAt: atWeeksAfterEpoch(-40),
      storedAttendancePenalty: 1010,
      weeksIdle: 40,
    });

    expect(state.rd).toBeGreaterThan(90);
    expect(state.conservativeRating).toBeLessThan(1010 + 200);
    expect(state.appliedAttendancePenalty).toBe(state.conservativeRating - 200);
    expect(state.score).toBe(200);
  });

  it("keeps the stored penalty when the player is well clear of the minimum", () => {
    const state = scoreOf({ rating: 1400, rd: 90, storedAttendancePenalty: 56, lastMatchAt: atWeeksAfterEpoch(-2), weeksIdle: 2 });

    expect(state.appliedAttendancePenalty).toBe(56);
    expect(state.score).toBe(state.conservativeRating - 56);
  });
});
