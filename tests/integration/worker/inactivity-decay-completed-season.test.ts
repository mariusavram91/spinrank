import { rebuildAchievementsForUsers } from "../../../worker/src/services/achievements";
import { handleGetSegmentLeaderboard } from "../../../worker/src/actions/getSegmentLeaderboard";
import { SEASON_RULES_EPOCH_ISO } from "../../../worker/src/services/season-rules";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import { createFixedRuntime } from "../../helpers/worker/make-test-env";
import type { UserRow } from "../../../worker/src/types";

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const EPOCH_MS = Date.parse(SEASON_RULES_EPOCH_ISO);
const LONG_AFTER_EPOCH = new Date(EPOCH_MS + 30 * WEEK_MS).toISOString();

async function insertCompletedSeasonSegment(args: {
  context: Awaited<ReturnType<typeof createWorkerTestContext>>;
  userId: string;
  rating: number;
  rd: number;
  attendancePenalty: number;
  lastMatchAt: string;
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
      VALUES (?1, 'season', 'season_closed', ?2, ?3, 12, 12, 8, 4, 1, 3, ?4, ?5, ?6, ?7, ?8, ?9, 4, 8, ?10)
    `,
  )
    .bind(
      `seg_closed_${args.userId}`,
      args.userId,
      args.rating,
      0,
      args.lastMatchAt,
      args.nowIso,
      args.rating,
      args.rd,
      Math.round(args.rating - 2 * args.rd),
      args.attendancePenalty,
    )
    .run();
}

async function podiumForUser(
  context: Awaited<ReturnType<typeof createWorkerTestContext>>,
  userId: string,
): Promise<number> {
  await rebuildAchievementsForUsers(context.env, [userId]);
  const row = await context.env.DB.prepare(
    `SELECT progress_value FROM user_achievements WHERE user_id = ?1 AND achievement_key = 'season_podium'`,
  )
    .bind(userId)
    .first<{ progress_value: number }>();
  return Number(row?.progress_value ?? 0);
}

describe("worker integration: decay never rewrites a completed season", () => {
  it("keeps a completed season's podium stable many weeks after the epoch", async () => {
    const context = await createWorkerTestContext({ runtime: createFixedRuntime(LONG_AFTER_EPOCH) });
    try {
      const nowIso = context.env.runtime.nowIso();
      const players = [
        { id: "user_first", displayName: "First" },
        { id: "user_second", displayName: "Second" },
        { id: "user_third", displayName: "Third" },
        { id: "user_fourth", displayName: "Fourth" },
      ];
      for (const player of players) {
        await seedUser(context.env, { id: player.id, displayName: player.displayName });
      }

      await context.env.DB.prepare(
        `
          INSERT INTO seasons (id, name, start_date, end_date, is_active, status, base_elo_mode,
            participant_ids_json, created_by_user_id, created_at, completed_at, is_public)
          VALUES ('season_closed', 'Closed Season', '2026-08-01', '2026-10-15', 0, 'completed', 'carry_over',
            '["user_first","user_second","user_third","user_fourth"]', 'user_first',
            ?1, '2026-10-15T23:59:59.000Z', 1)
        `,
      )
        .bind(nowIso)
        .run();

      // Four players who all stopped playing before the season closed. Scores
      // below are 1340 / 1230 / 1064 / 1010, so Third is on the podium and
      // Fourth is not. The season closed before the epoch, so a clamp on the
      // growth window is what keeps those scores still.
      const segments = [
        { id: "user_first", rating: 1500, rd: 80, attendancePenalty: 0 },
        { id: "user_second", rating: 1400, rd: 85, attendancePenalty: 0 },
        { id: "user_third", rating: 1300, rd: 90, attendancePenalty: 56 },
        { id: "user_fourth", rating: 1290, rd: 90, attendancePenalty: 100 },
      ];
      for (const segment of segments) {
        await insertCompletedSeasonSegment({
          context,
          userId: segment.id,
          rating: segment.rating,
          rd: segment.rd,
          attendancePenalty: segment.attendancePenalty,
          lastMatchAt: "2026-10-01T10:00:00.000Z",
          nowIso,
        });
      }

      expect(await podiumForUser(context, "user_third")).toBe(1);
      expect(await podiumForUser(context, "user_fourth")).toBe(0);

      // The stored score must survive intact through the leaderboard, which is
      // the surface that would move first if growth were not clamped.
      const owner = (await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`)
        .bind("user_first")
        .first<UserRow>()) as UserRow;
      const leaderboard = await handleGetSegmentLeaderboard(
        {
          action: "getSegmentLeaderboard",
          requestId: "req_closed_leaderboard",
          payload: { segmentType: "season", segmentId: "season_closed" },
        },
        owner,
        context.env,
      );
      expect(leaderboard.ok).toBe(true);

      const third = leaderboard.data?.leaderboard.find((entry) => entry.userId === "user_third");
      expect(third?.seasonScore).toBe(1300 - 2 * 90 - 56);
      expect(third?.seasonGlickoRd).toBe(90);
    } finally {
      await context.cleanup();
    }
  }, 40000);
});
