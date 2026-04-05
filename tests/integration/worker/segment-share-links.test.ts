import type { TournamentBracketRound, UserRow } from "../../../worker/src/types";
import { handleCreateSeason } from "../../../worker/src/actions/createSeason";
import { handleCreateTournament } from "../../../worker/src/actions/createTournament";
import { handleCreateSegmentShareLink } from "../../../worker/src/actions/createSegmentShareLink";
import { handleRedeemSegmentShareLink } from "../../../worker/src/actions/redeemSegmentShareLink";
import { createFixedRuntime } from "../../helpers/worker/make-test-env";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";

const rounds: TournamentBracketRound[] = [
  {
    title: "Final",
    matches: [
      {
        id: "share_final",
        leftPlayerId: "user_owner",
        rightPlayerId: "user_friend",
        createdMatchId: null,
        winnerPlayerId: null,
        locked: false,
        isFinal: true,
      },
    ],
  },
];

describe("worker integration: segment share links", () => {
  it("creates a season share link and lets a new participant redeem it", async () => {
    const context = await createWorkerTestContext({
      runtime: createFixedRuntime("2026-04-05T12:00:00.000Z", ["uuid_share_link", "uuid_audit"]),
    });
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });
      await seedUser(context.env, { id: "user_guest", displayName: "Guest" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_owner")
        .first<UserRow>();
      const guest = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_guest")
        .first<UserRow>();

      if (!owner || !guest) {
        throw new Error("Required users were not seeded");
      }

      const seasonResponse = await handleCreateSeason(
        {
          action: "createSeason",
          requestId: "req_create_share_season",
          payload: {
            name: "Shared Season",
            startDate: "2026-04-01",
            endDate: "2026-05-01",
            isActive: true,
            baseEloMode: "carry_over",
            participantIds: ["user_friend"],
            isPublic: false,
          },
        },
        owner,
        context.env,
      );

      const seasonId = seasonResponse.data?.season.id;
      expect(seasonId).toBeTruthy();

      const createResponse = await handleCreateSegmentShareLink(
        {
          action: "createSegmentShareLink",
          requestId: "req_create_share_link",
          payload: {
            segmentType: "season",
            segmentId: seasonId!,
          },
        },
        owner,
        context.env,
      );

      expect(createResponse.ok).toBe(true);
      expect(createResponse.data?.expiresAt).toBe("2026-04-10T12:00:00.000Z");
      expect(createResponse.data?.shareToken).toMatch(/^uuid_/);
      expect(createResponse.data?.url).toBe(
        `http://localhost:5173?shareToken=${createResponse.data?.shareToken}`,
      );

      const redeemResponse = await handleRedeemSegmentShareLink(
        {
          action: "redeemSegmentShareLink",
          requestId: "req_redeem_share_link",
          payload: {
            shareToken: createResponse.data!.shareToken,
          },
        },
        guest,
        context.env,
      );

      expect(redeemResponse.ok).toBe(true);
      expect(redeemResponse.data).toEqual({
        segmentType: "season",
        segmentId: seasonId,
        segmentName: "Shared Season",
        joined: true,
      });

      const seasonRow = await context.env.DB.prepare(
        `
          SELECT participant_ids_json
          FROM seasons
          WHERE id = ?1
        `,
      )
        .bind(seasonId)
        .first<{ participant_ids_json: string }>();
      const seasonParticipants = await context.env.DB.prepare(
        `
          SELECT user_id
          FROM season_participants
          WHERE season_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind(seasonId)
        .all<{ user_id: string }>();
      const shareLinkRow = await context.env.DB.prepare(
        `
          SELECT share_token, consumed_by_user_id, consumed_at
          FROM segment_share_links
          WHERE segment_id = ?1
        `,
      )
        .bind(seasonId)
        .first<{ share_token: string; consumed_by_user_id: string; consumed_at: string }>();
      const dedupRow = await context.env.DB.prepare(
        `
          SELECT action, request_id, target_id
          FROM request_dedup
          WHERE request_id = ?1
        `,
      )
        .bind("req_create_share_link")
        .first<{ action: string; request_id: string; target_id: string }>();

      expect(JSON.parse(seasonRow!.participant_ids_json)).toEqual(["user_owner", "user_friend", "user_guest"]);
      expect(seasonParticipants.results.map((row) => row.user_id)).toEqual([
        "user_friend",
        "user_guest",
        "user_owner",
      ]);
      expect(shareLinkRow).toMatchObject({
        share_token: createResponse.data!.shareToken,
        consumed_by_user_id: "user_guest",
        consumed_at: "2026-04-05T12:00:00.000Z",
      });
      expect(dedupRow).toEqual({
        action: "createSegmentShareLink",
        request_id: "req_create_share_link",
        target_id: `season:${seasonId}`,
      });
    } finally {
      await context.cleanup();
    }
  });

  it("creates a tournament share link and prevents second redemption after use", async () => {
    const context = await createWorkerTestContext({
      runtime: createFixedRuntime("2026-04-05T12:00:00.000Z", ["uuid_tournament_share"]),
    });
    try {
      await seedUser(context.env, { id: "user_owner", displayName: "Owner" });
      await seedUser(context.env, { id: "user_friend", displayName: "Friend" });
      await seedUser(context.env, { id: "user_guest", displayName: "Guest" });

      const owner = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_owner")
        .first<UserRow>();
      const guest = await context.env.DB.prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("user_guest")
        .first<UserRow>();

      if (!owner || !guest) {
        throw new Error("Required users were not seeded");
      }

      const tournamentResponse = await handleCreateTournament(
        {
          action: "createTournament",
          requestId: "req_create_share_tournament",
          payload: {
            name: "Shared Tournament",
            participantIds: ["user_owner", "user_friend"],
            rounds,
            seasonId: null,
          },
        },
        owner,
        context.env,
      );

      const tournamentId = tournamentResponse.data?.tournament.id;
      expect(tournamentId).toBeTruthy();

      const createResponse = await handleCreateSegmentShareLink(
        {
          action: "createSegmentShareLink",
          requestId: "req_create_tournament_share_link",
          payload: {
            segmentType: "tournament",
            segmentId: tournamentId!,
          },
        },
        owner,
        context.env,
      );

      expect(createResponse.ok).toBe(true);
      expect(createResponse.data?.shareToken).toMatch(/^uuid_/);

      const firstRedeem = await handleRedeemSegmentShareLink(
        {
          action: "redeemSegmentShareLink",
          requestId: "req_first_redeem",
          payload: {
            shareToken: createResponse.data!.shareToken,
          },
        },
        guest,
        context.env,
      );

      expect(firstRedeem.ok).toBe(true);
      expect(firstRedeem.data).toEqual({
        segmentType: "tournament",
        segmentId: tournamentId,
        segmentName: "Shared Tournament",
        joined: true,
      });

      const secondRedeem = await handleRedeemSegmentShareLink(
        {
          action: "redeemSegmentShareLink",
          requestId: "req_second_redeem",
          payload: {
            shareToken: createResponse.data!.shareToken,
          },
        },
        owner,
        context.env,
      );

      expect(secondRedeem.ok).toBe(false);
      expect(secondRedeem.error?.message).toContain("already been used");

      const tournamentParticipants = await context.env.DB.prepare(
        `
          SELECT user_id
          FROM tournament_participants
          WHERE tournament_id = ?1
          ORDER BY user_id ASC
        `,
      )
        .bind(tournamentId)
        .all<{ user_id: string }>();

      expect(tournamentParticipants.results.map((row) => row.user_id)).toEqual([
        "user_friend",
        "user_guest",
        "user_owner",
      ]);
    } finally {
      await context.cleanup();
    }
  });
});
