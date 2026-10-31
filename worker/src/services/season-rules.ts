/**
 * Season scoring rules shared by the write path (`elo.ts`) and the read-time
 * inactivity transform (`season-decay.ts`).
 *
 * They live in one module so the score formula cannot drift between the two
 * paths — the stored column and the live computation must agree on deploy day.
 */

/**
 * Deployment date of the inactivity change. Idle time is measured from here, so
 * no player is charged for absence that predates the rule. Moving this earlier
 * would let idle weeks accrue retroactively and break the "zero scores move on
 * deploy day" guarantee.
 */
export const SEASON_RULES_EPOCH_ISO = "2026-10-31T00:00:00.000Z";

export const MINIMUM_SEASON_SCORE = 200;

export function calculateSeasonConservativeRating(rating: number, rd: number): number {
  return Math.round(rating - 2 * rd);
}

export function calculateAppliedAttendancePenalty(conservativeRating: number, attendancePenalty: number): number {
  const maxPenalty = Math.max(0, conservativeRating - MINIMUM_SEASON_SCORE);
  return Math.min(Math.max(0, attendancePenalty), maxPenalty);
}
