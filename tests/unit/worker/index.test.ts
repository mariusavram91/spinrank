import worker from "../../../worker/src/index";
import { makeTestEnv } from "../../helpers/worker/make-test-env";

describe("worker fetch entrypoint", () => {
  it("returns a server error when the session secret is missing", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "health", requestId: "req_secret", payload: {} }),
      }),
      makeTestEnv({ APP_SESSION_SECRET: "" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("serves CORS preflight responses", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api", {
        method: "OPTIONS",
        headers: { origin: "https://preview.spinrank.test" },
      }),
      makeTestEnv({ APP_ENV: "dev" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://preview.spinrank.test");
    expect(await response.text()).toBe("");
  });

  it("rejects avatar requests without a user id and unknown routes", async () => {
    const avatarResponse = await worker.fetch(
      new Request("https://example.test/avatar/"),
      makeTestEnv(),
    );
    expect(avatarResponse.status).toBe(400);
    await expect(avatarResponse.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST", message: "Missing avatar user id." },
    });

    const notFound = await worker.fetch(
      new Request("https://example.test/missing"),
      makeTestEnv(),
    );
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND", message: "Not found." },
    });
  });

  it("returns request-scoped health responses through /api", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "health", requestId: "req_health", payload: {} }),
      }),
      makeTestEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      requestId: "req_health",
      data: { status: "ok", version: "cloudflare-worker" },
    });
  });

  it("rate limits repeated API requests from the same client", async () => {
    const env = makeTestEnv();
    const requestFactory = () =>
      new Request("https://example.test/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "rate-limit-client",
        },
        body: JSON.stringify({ action: "health", requestId: "req_health", payload: {} }),
      });

    for (let index = 0; index < 60; index += 1) {
      const response = await worker.fetch(requestFactory(), env);
      expect(response.status).toBe(200);
    }

    const limited = await worker.fetch(requestFactory(), env);

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});
