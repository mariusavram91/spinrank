import { handleUpdateProfile } from "../../../worker/src/actions/updateProfile";
import type { UserRow } from "../../../worker/src/types";
import { createWorkerTestContext } from "../../helpers/worker/test-context";

describe("worker updateProfile action", () => {
  it("updates the signed-in user's display name", async () => {
    const context = await createWorkerTestContext();

    try {
      await context.env.DB.prepare(
        `
          INSERT INTO users (
            id, provider, provider_user_id, email, display_name, avatar_url,
            global_elo, wins, losses, streak, created_at, updated_at
          )
          VALUES (?1, 'google', ?2, ?3, ?4, ?5, 1200, 0, 0, 0, ?6, ?6)
        `,
      )
        .bind(
          "user_1",
          "google-user-1",
          "alice@example.com",
          "Alice",
          "https://example.com/alice.png",
          "2026-04-05T12:00:00.000Z",
        )
        .run();

      const sessionUser = await context.env.DB
        .prepare("SELECT * FROM users WHERE id = ?1")
        .bind("user_1")
        .first<UserRow>();

      const response = await handleUpdateProfile(
        {
          action: "updateProfile",
          requestId: "req_update_profile",
          payload: { displayName: "Alice Cooper", locale: "de" },
        },
        sessionUser!,
        context.env,
      );

      expect(response.ok).toBe(true);
      expect(response.data?.user.displayName).toBe("Alice Cooper");
      expect(response.data?.user.locale).toBe("de");

      const persisted = await context.env.DB
        .prepare("SELECT display_name, locale FROM users WHERE id = ?1")
        .bind("user_1")
        .first<{ display_name: string; locale: string }>();
      expect(persisted?.display_name).toBe("Alice Cooper");
      expect(persisted?.locale).toBe("de");
    } finally {
      await context.cleanup();
    }
  });
});
