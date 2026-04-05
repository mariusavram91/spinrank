import { parseApiRequest, routeApiRequest } from "../../../worker/src/router";
import { signSessionToken } from "../../../worker/src/auth";
import { makeTestEnv } from "../../helpers/worker/make-test-env";
import { createWorkerTestContext, seedUser } from "../../helpers/worker/test-context";
import type { ApiRequest } from "../../../worker/src/types";

describe("worker router helpers", () => {
  it("rejects missing, oversized, malformed, and schema-invalid request bodies", async () => {
    await expect(
      parseApiRequest(
        new Request("https://example.test/api", {
          method: "POST",
          body: "",
        }),
      ),
    ).rejects.toThrow("Missing request body.");

    await expect(
      parseApiRequest(
        new Request("https://example.test/api", {
          method: "POST",
          body: "x".repeat(32 * 1024 + 1),
        }),
      ),
    ).rejects.toThrow("32KB limit");

    await expect(
      parseApiRequest(
        new Request("https://example.test/api", {
          method: "POST",
          body: "{not-json",
        }),
      ),
    ).rejects.toThrow("invalid JSON");

    await expect(
      parseApiRequest(
        new Request("https://example.test/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "unknownAction",
            requestId: "req_bad",
            payload: {},
          }),
        }),
      ),
    ).rejects.toThrow("Malformed request:");
  });

  it("returns an auth error for protected actions without a session", async () => {
    const response = await routeApiRequest(
      {
        action: "getSeasons",
        requestId: "req_auth",
        payload: {},
      } as ApiRequest<"getSeasons">,
      makeTestEnv(),
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Missing session token." },
    });
  });

  it("returns not found for unknown actions after authenticating the user", async () => {
    const context = await createWorkerTestContext();
    try {
      await seedUser(context.env, { id: "user_1", displayName: "Ada" });
      const { token } = await signSessionToken("user_1", context.env);

      const response = await routeApiRequest(
        {
          action: "unknownAction",
          requestId: "req_unknown",
          payload: {},
          sessionToken: token,
        } as ApiRequest<any>,
        context.env,
      );

      expect(response).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown action: unknownAction" },
      });
    } finally {
      await context.cleanup();
    }
  });
});
