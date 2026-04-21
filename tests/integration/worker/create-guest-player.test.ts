import { handleCreateGuestPlayer } from "../../../worker/src/actions/createGuestPlayer";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

describe("worker integration: createGuestPlayer", () => {
  it("creates a guest player with minimal identity fields", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "owner", displayName: "Owner" });
      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("owner").first<any>();

      const response = await handleCreateGuestPlayer(
        {
          action: "createGuestPlayer",
          requestId: "req_create_guest_open",
          payload: {
            displayName: "Guest One",
          },
        },
        owner,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.participant).toMatchObject({
        displayName: "Guest One",
        elo: 1200,
        avatarUrl: null,
      });

      const guestId = response.data?.participant.userId;
      const guest = await context.env.DB.prepare(
        `
          SELECT provider, provider_user_id, email, display_name, global_elo, wins, losses
          FROM users
          WHERE id = ?1
        `,
      )
        .bind(guestId)
        .first<{
          provider: string;
          provider_user_id: string;
          email: string | null;
          display_name: string;
          global_elo: number;
          wins: number;
          losses: number;
        }>();

      expect(guest).toMatchObject({
        provider: "guest",
        email: null,
        display_name: "Guest One",
        global_elo: 1200,
        wins: 0,
        losses: 0,
      });
      expect(guest?.provider_user_id).toMatch(/^guest_uuid_/);
    } finally {
      await context.cleanup();
    }
  });

  it("adds the guest as a participant when a season id is supplied", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "owner", displayName: "Owner" });
      await seedUser(context.env, { id: "friend", displayName: "Friend" });
      const owner = await context.env.DB.prepare(`SELECT * FROM users WHERE id = ?1`).bind("owner").first<any>();

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_guest_player_season",
          payload: {
            name: "Season One",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["friend"],
            isPublic: true,
          },
        },
        owner,
        context.env,
      );

      const seasonId = seasonResponse.data?.season.id;
      const guestResponse = await handleCreateGuestPlayer(
        {
          action: "createGuestPlayer",
          requestId: "req_create_guest_season",
          payload: {
            displayName: "Season Guest",
            seasonId,
          },
        },
        owner,
        context.env,
      );

      expect(guestResponse.ok).toBe(true);
      expect(guestResponse.data?.seasonId).toBe(seasonId);
      expect(guestResponse.data?.seasonParticipantIds).toContain("owner");
      expect(guestResponse.data?.seasonParticipantIds).toContain("friend");
      expect(guestResponse.data?.seasonParticipantIds).toContain(guestResponse.data?.participant.userId ?? "");

      const season = await context.env.DB.prepare(
        `
          SELECT participant_ids_json
          FROM seasons
          WHERE id = ?1
        `,
      )
        .bind(seasonId)
        .first<{ participant_ids_json: string }>();
      const participantIds = JSON.parse(season?.participant_ids_json || "[]") as string[];
      expect(participantIds).toContain(guestResponse.data?.participant.userId ?? "");
    } finally {
      await context.cleanup();
    }
  });
});
