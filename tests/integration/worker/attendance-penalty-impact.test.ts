import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleGetMatches } from "../../../worker/src/actions/getMatches";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { UserRow } from "../../../worker/src/types";

const BASE = { matchType: "singles" as const, formatType: "single_game" as const, pointsToWin: 11 as const };

describe("worker integration: attendance penalty in match impact", () => {
  it("charges a missed-week gap once, on the first match back, and reports the gap length", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });
      const owner = (
        await context.env.DB.prepare("SELECT * FROM users WHERE id = ?1").bind("user_a").first<UserRow>()
      ) as UserRow;

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_attendance_season",
          payload: {
            name: "Attendance Season",
            startDate: "2026-06-10",
            endDate: null,
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_b"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );
      const seasonId = seasonResponse.data?.season.id;

      // Post-cutoff season (1 free miss). week 0 played, weeks 1-2 missed, weeks 3-5 played.
      const dates = [
        "2026-06-11T10:00:00.000Z",
        "2026-07-01T10:00:00.000Z",
        "2026-07-08T10:00:00.000Z",
        "2026-07-15T10:00:00.000Z",
      ];
      for (const [index, playedAt] of dates.entries()) {
        await handleCreateMatch(
          {
            action: "createMatch",
            requestId: `req_attendance_match_${index}`,
            payload: {
              ...BASE,
              teamAPlayerIds: ["user_a"],
              teamBPlayerIds: ["user_b"],
              score: [{ teamA: 11, teamB: 7 }],
              winnerTeam: "A",
              playedAt,
              seasonId,
            },
          },
          owner,
          context.env,
        );
      }

      const response = await handleGetMatches(
        {
          action: "getMatches",
          requestId: "req_attendance_get",
          payload: { filter: "recent", limit: 10, includeImpact: true },
        },
        owner,
        context.env,
      );
      expect(response.ok).toBe(true);

      const byPlayedAt = new Map(
        (response.data?.matches ?? []).map((match) => [match.playedAt, match.ratingImpact?.seasonBreakdown ?? null]),
      );

      // Opening match: nothing missed yet.
      expect(byPlayedAt.get("2026-06-11T10:00:00.000Z")).toMatchObject({
        attendancePenaltyBefore: 0,
        attendancePenaltyAfter: 0,
        attendanceMissedWeeks: 0,
      });

      // First match back after the two-week gap: the whole charge lands here, once.
      expect(byPlayedAt.get("2026-07-01T10:00:00.000Z")).toMatchObject({
        attendancePenaltyBefore: 0,
        attendancePenaltyAfter: 8,
        attendanceMissedWeeks: 2,
        scoreBefore: 782,
        scoreAfter: 891,
      });

      // Matches immediately after: no new gap, no new penalty.
      expect(byPlayedAt.get("2026-07-08T10:00:00.000Z")).toMatchObject({
        attendancePenaltyBefore: 8,
        attendancePenaltyAfter: 8,
        attendanceMissedWeeks: 0,
      });
      expect(byPlayedAt.get("2026-07-15T10:00:00.000Z")).toMatchObject({
        attendancePenaltyBefore: 8,
        attendancePenaltyAfter: 8,
        attendanceMissedWeeks: 0,
      });
    } finally {
      await context.cleanup();
    }
  }, 30000);
});
