import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleSearchParticipants } from "../../../worker/src/actions/searchParticipants";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: searchParticipants", () => {
  it("supports larger related-player result sets for open and season suggestions", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });

      const relatedIds: string[] = [];
      for (let index = 0; index < 30; index += 1) {
        const userId = `user_${index.toString().padStart(2, "0")}`;
        relatedIds.push(userId);
        await seedUser(context.env, { id: userId, displayName: `Player ${index.toString().padStart(2, "0")}` });
      }

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_owner")
        .first<any>();

      await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_season",
          payload: {
            name: "Wide Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: relatedIds,
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const response = await handleSearchParticipants(
        {
          action: "searchParticipants",
          requestId: "req_search_participants",
          payload: {
            segmentType: "season",
            limit: 100,
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.participants).toHaveLength(30);
    } finally {
      await context.cleanup();
    }
  }, 30000);
});
