import {
  calculateAppliedAttendancePenalty,
  calculateSeasonConservativeRating,
  SEASON_RULES_EPOCH_ISO,
} from "./season-rules";

/** Standard Glicko `c`: roughly one RD point per week of absence for a settled player. */
export const INACTIVITY_RD_PER_WEEK = 10;

/**
 * Ceiling on absence-driven RD growth. This is a bound on *growth*, not a clamp
 * on the value: the outer `max(rd, ...)` guarantees a player already above the
 * cap is never pulled down to it.
 */
export const INACTIVITY_RD_CAP = 250;

const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;
const SEASON_END_OF_DAY = "T23:59:59.000Z";

export interface SeasonEffectiveState {
  rating: number;
  rd: number;
  weeksIdle: number;
  conservativeRating: number;
  appliedAttendancePenalty: number;
  score: number;
}

/**
 * Read-time transform that adds absence-driven uncertainty to a stored season
 * state. Absence produces no match event, so this cannot be stored without a
 * write job against historical rows; it is applied where scores are read.
 */
export function computeSeasonEffectiveState(args: {
  rating: number;
  rd: number;
  lastMatchAt: string | null;
  storedAttendancePenalty: number;
  nowIso: string;
  /** Clamps growth once a season has closed. Omit only when no end date exists. */
  seasonEndDate: string | null;
}): SeasonEffectiveState {
  const weeksIdle = countIdleWeeks(args);
  const rd = growRdForIdleWeeks(args.rd, weeksIdle);
  const conservativeRating = calculateSeasonConservativeRating(args.rating, rd);
  const appliedAttendancePenalty = calculateAppliedAttendancePenalty(
    conservativeRating,
    args.storedAttendancePenalty,
  );

  return {
    rating: args.rating,
    rd,
    weeksIdle,
    conservativeRating,
    appliedAttendancePenalty,
    score: conservativeRating - appliedAttendancePenalty,
  };
}

function countIdleWeeks(args: {
  lastMatchAt: string | null;
  nowIso: string;
  seasonEndDate: string | null;
}): number {
  // A player with no recorded match has no demonstrated state to defend. The
  // empty-string form is what `elo_segments.last_match_at` stores for a no-show.
  const lastMatchMs = args.lastMatchAt ? Date.parse(args.lastMatchAt) : Number.NaN;
  if (!Number.isFinite(lastMatchMs)) {
    return 0;
  }

  const nowMs = Date.parse(args.nowIso);
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  const endMs = args.seasonEndDate ? Date.parse(`${args.seasonEndDate}${SEASON_END_OF_DAY}`) : Number.NaN;
  const anchorMs = Number.isFinite(endMs) ? Math.min(nowMs, endMs) : nowMs;
  // Measuring from the epoch keeps a season's pre-epoch weeks out of the count,
  // so a season that closed before it can never accumulate idle time at all.
  const idleStartMs = Math.max(lastMatchMs, Date.parse(SEASON_RULES_EPOCH_ISO));

  return Math.max(0, Math.floor((anchorMs - idleStartMs) / WEEK_IN_MS));
}

function growRdForIdleWeeks(rd: number, weeksIdle: number): number {
  const grownRd = Math.sqrt(rd * rd + INACTIVITY_RD_PER_WEEK ** 2 * weeksIdle);
  // The outer `max` is load-bearing: `min` alone would reduce any RD above the
  // cap, including every never-played player sitting at the 350 default.
  return Math.max(rd, Math.min(INACTIVITY_RD_CAP, grownRd));
}
