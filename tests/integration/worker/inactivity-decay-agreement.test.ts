import { handleGetProfileSegmentSummaries } from "../../../worker/src/actions/getProfileSegmentSummaries";
import { handleGetSegmentLeaderboard } from "../../../worker/src/actions/getSegmentLeaderboard";
import { getAchievementOverview } from "../../../worker/src/services/achievements";
import { computeSeasonEffectiveState } from "../../../worker/src/services/season-decay";
import { SEASON_RULES_EPOCH_ISO } from "../../../worker/src/services/season-rules";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import { createFixedRuntime } from "../../helpers/worker/make-test-env";
import type { UserRow } from "../../../worker/src/types";

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const EPOCH_MS = Date.parse(SEASON_RULES_EPOCH_ISO);
const SIX_WEEKS_OUT = new Date(EPOCH_MS + 6 * WEEK_MS).toISOString();
const SIX_WEEKS_IN = new Date(EPOCH_MS - 6 * WEEK_MS).toISOString();

async function seedSeasonSegment(args: {
  context: Awaited<ReturnType<typeof createWorkerTestContext>>;
  seasonId: string;
  userId: string;
  elo: number;
  rating: number;
  rd: number;
  attendancePenalty: number;
  lastMatchAt: string;
  matchesPlayed: number;
  nowIso: string;
}) {
  await args.context.env.DB.prepare(
    `
      INSERT INTO elo_segments (
        id, segment_type, segment_id, user_id, elo, matches_played, matches_played_equivalent, wins, losses,
        streak, best_win_streak, highest_score, last_match_at, updated_at, season_glicko_rating,
        season_glicko_rd, season_conservative_rating, season_attended_weeks, season_total_weeks,
        season_attendance_penalty
      )
      VALUES (?1, 'season', ?2, ?3, ?4, ?5, ?5, ?5, 0, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, 8, ?12)
    `,
  )
    .bind(
      `seg_${args.seasonId}_${args.userId}`,
      args.seasonId,
      args.userId,
      args.elo,
      args.matchesPlayed,
      args.elo,
      args.lastMatchAt,
      args.nowIso,
      args.rating,
      args.rd,
      Math.round(args.rating - 2 * args.rd),
      args.attendancePenalty,
    )
    .run();
}

describe("worker integration: inactivity decay agrees across read surfaces", () => {
  it("reports the same decayed season score on the leaderboard, profile and achievements", async () => {
    const context = await createWorkerTestContext({
      runtime: createFixedRuntime(SIX_WEEKS_OUT),
    });
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const nowIso = context.env.runtime.nowIso();
      const { seasonId } = await (async () => {
        await context.env.DB.prepare(
          `
            INSERT INTO seasons (id, name, start_date, end_date, is_active, status, base_elo_mode,
              participant_ids_json, created_by_user_id, created_at, completed_at, is_public)
            VALUES ('season_decay', 'Decay Season', '2026-11-01', '2026-12-31', 1, 'active', 'carry_over',
              '["user_a","user_b"]', 'user_a', ?1, NULL, 1)
          `,
        )
          .bind(nowIso)
          .run();
        return { seasonId: "season_decay" };
      })();

      // Alice has not played for six weeks; Bob played this week.
      await seedSeasonSegment({
        context,
        seasonId,
        userId: "user_a",
        elo: 1400,
        rating: 1400,
        rd: 97,
        attendancePenalty: 56,
        lastMatchAt: SIX_WEEKS_IN,
        matchesPlayed: 12,
        nowIso,
      });
      await seedSeasonSegment({
        context,
        seasonId,
        userId: "user_b",
        elo: 1300,
        rating: 1300,
        rd: 90,
        attendancePenalty: 0,
        lastMatchAt: SIX_WEEKS_OUT,
        matchesPlayed: 12,
        nowIso,
      });

      const owner = (await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`)
        .bind("user_a")
        .first<UserRow>()) as UserRow;

      const leaderboard = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_decay_leaderboard",
          payload: { segmentType: "season", segmentId: seasonId },
        },
        owner,
        context.env,
      );
      expect(leaderboard.ok).toBe(true);

      const profile = await handleGetProfileSegmentSummaries(
        {
          action: "getProfileSegmentSummaries",
          requestId: "req_decay_profile",
          payload: { seasonIds: [seasonId] },
        },
        owner,
        context.env,
      );
      expect(profile.ok).toBe(true);

      const expected = computeSeasonEffectiveState({
        rating: 1400,
        rd: 97,
        lastMatchAt: SIX_WEEKS_IN,
        storedAttendancePenalty: 56,
        nowIso,
        seasonEndDate: "2026-12-31",
      });

      // The absence is long enough to be visible, so this is not a no-op assertion.
      expect(expected.weeksIdle).toBe(6);
      expect(expected.rd).toBeGreaterThan(97);

      const leaderboardEntry = leaderboard.data?.leaderboard.find((entry) => entry.userId === "user_a");
      expect(leaderboardEntry?.seasonScore).toBe(expected.score);
      expect(leaderboardEntry?.seasonGlickoRd).toBe(expected.rd);
      expect(leaderboardEntry?.seasonConservativeRating).toBe(expected.conservativeRating);
      expect(leaderboardEntry?.seasonAttendancePenalty).toBe(expected.appliedAttendancePenalty);

      const profileSummary = profile.data?.summaries.find((summary) => summary.segmentId === seasonId);
      expect(profileSummary?.seasonScore).toBe(expected.score);

      // A player who played this week must be untouched by the transform.
      const bob = leaderboard.data?.leaderboard.find((entry) => entry.userId === "user_b");
      expect(bob?.seasonScore).toBe(1300 - 2 * 90);
      expect(bob?.seasonGlickoRd).toBe(90);

      const achievements = await getAchievementOverview(context.env, "user_a");
      expect(achievements.items.length).toBeGreaterThan(0);
    } finally {
      await context.cleanup();
    }
  }, 40000);
});
