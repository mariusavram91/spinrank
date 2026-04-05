import worker from "../../../worker/src/index";
import { createWorkerTestContext } from "../../helpers/worker/test-context";

describe("worker integration: test auth bootstrap route", () => {
  it("bootstraps a local test user and returns an app session", async () => {
    const context = await createWorkerTestContext();
    try {
      const response = await worker.fetch(
        new Request("https://example.test/test/bootstrap-user", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-auth-secret": context.env.TEST_AUTH_SECRET!,
          },
          body: JSON.stringify({
            userId: "test_bootstrap_user",
            displayName: "Bootstrap User",
          }),
        }),
        context.env,
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ok).toBe(true);
      expect(payload.data?.user).toMatchObject({
        id: "test_bootstrap_user",
        displayName: "Bootstrap User",
      });
      expect(typeof payload.data?.sessionToken).toBe("string");

      const user = await context.env.DB.prepare(
        `
          SELECT id, display_name, provider_user_id
          FROM users
          WHERE id = ?1
        `,
      )
        .bind("test_bootstrap_user")
        .first<{ id: string; display_name: string; provider_user_id: string }>();

      expect(user).toEqual({
        id: "test_bootstrap_user",
        display_name: "Bootstrap User",
        provider_user_id: "test:test_bootstrap_user",
      });
    } finally {
      await context.cleanup();
    }
  });

  it("rejects requests with an invalid bootstrap secret", async () => {
    const context = await createWorkerTestContext();
    try {
      const response = await worker.fetch(
        new Request("https://example.test/test/bootstrap-user", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-auth-secret": "wrong-secret",
          },
          body: JSON.stringify({
            userId: "blocked_user",
          }),
        }),
        context.env,
      );

      expect(response.status).toBe(401);
      const payload = await response.json();
      expect(payload.ok).toBe(false);
      expect(payload.error?.message).toContain("invalid test auth secret");
    } finally {
      await context.cleanup();
    }
  });
});
