import worker from "../../../worker/src/index";
import { signSessionToken } from "../../../worker/src/auth";
import { handleCreateMatch } from "../../../worker/src/actions/createMatch";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { ApiRequest, CreateSeasonPayload, UserRow } from "../../../worker/src/types";

describe("worker router/index", () => {
  const makeApiRequest = (
    requestId: string,
    action: string,
    payload: Record<string, unknown>,
    sessionToken?: string,
  ): Request =>
    new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, requestId, payload, sessionToken }),
    });

  it("exposes the health endpoint and rejects malformed API bodies", async () => {
    const context = await createWorkerTestContext();
    try {
      const health = await worker.fetch(new Request("https://example.test/health"), context.env);
      expect(health.status).toBe(200);
      const healthPayload = await health.json();
      expect(healthPayload.ok).toBe(true);

      const bad = await worker.fetch(
        new Request("https://example.test/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json",
        }),
        context.env,
      );
      expect(bad.status).toBe(400);
      const errorPayload = await bad.json();
      expect(errorPayload.error?.message).toContain("invalid JSON");
    } finally {
      await context.cleanup();
    }
  });

  it("routes createSeason through /api", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "owner", displayName: "Owner" });
      await seedUser(context.env, { id: "friend", displayName: "Friend" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("owner")
        .first<UserRow>();

      if (!owner) {
        throw new Error("Owner missing");
      }

      const { token } = await signSessionToken(owner.id, context.env);
      const request = makeApiRequest(
        "req_api_create_season",
        "createSeason",
        {
          name: "API Season",
          startDate: "2026-04-01",
          endDate: "2026-05-01",
          isActive: true,
          baseEloMode: "carry_over",
          participantIds: ["friend"],
          isPublic: false,
        },
        token,
      );

      const response = await worker.fetch(request, context.env);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data?.season.name).toBe("API Season");
      expect(body.data?.season.participantIds).toEqual(["owner", "friend"]);
    } finally {
      await context.cleanup();
    }
  });

  it("routes getSegmentLeaderboard after matches are recorded", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_a", displayName: "Alice" });
      await seedUser(context.env, { id: "user_b", displayName: "Bob" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_a")
        .first<UserRow>();

      if (!owner) {
        throw new Error("Owner missing");
      }

      const seasonPayload: ApiRequest<"createSeason", CreateSeasonPayload> = {
        action: "createSeason",
        requestId: "req_setup_season",
        payload: {
          name: "Leaderboard Season",
          startDate: "2026-04-01",
          endDate: "2026-05-01",
          isActive: true,
          baseEloMode: "carry_over",
          participantIds: ["user_b"],
          isPublic: true,
        },
      };

      const seasonResponse = await handleCreateSeason(seasonPayload, owner, context.env);
      const seasonId = seasonResponse.data?.season.id;
      expect(seasonId).toBeDefined();

      const matchResponse = await handleCreateMatch(
        {
          action: "createMatch",
          requestId: "req_setup_match",
          payload: {
            matchType: "singles",
            formatType: "single_game",
            pointsToWin: 11,
            teamAPlayerIds: ["user_a"],
            teamBPlayerIds: ["user_b"],
            score: [{ teamA: 11, teamB: 6 }],
            winnerTeam: "A",
            playedAt: "2026-04-05T12:00:00.000Z",
            seasonId,
          },
        },
        owner,
        context.env,
      );

      expect(matchResponse.ok).toBe(true);

      const { token } = await signSessionToken(owner.id, context.env);
      const leaderboardRequest = makeApiRequest(
        "req_api_segment",
        "getSegmentLeaderboard",
        { segmentType: "season", segmentId: seasonId },
        token,
      );

      const leaderboardResponse = await worker.fetch(leaderboardRequest, context.env);
      const payload = await leaderboardResponse.json();
      expect(payload.ok).toBe(true);
      expect(Array.isArray(payload.data?.leaderboard)).toBe(true);
      expect(payload.data?.leaderboard.some((entry: { userId: string }) => entry.userId === "user_a")).toBe(true);
    } finally {
      await context.cleanup();
    }
  });
});
