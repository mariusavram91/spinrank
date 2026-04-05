import { handleTestBootstrapRequest, isTestBootstrapRequest } from "../../../worker/src/testAuth";
import { makeTestEnv } from "../../helpers/worker/make-test-env";

describe("worker test auth helpers", () => {
  it("matches only the local bootstrap endpoint", () => {
    expect(isTestBootstrapRequest(new Request("https://example.test/test/bootstrap-user", { method: "POST" }))).toBe(true);
    expect(isTestBootstrapRequest(new Request("https://example.test/test/bootstrap-user", { method: "GET" }))).toBe(false);
    expect(isTestBootstrapRequest(new Request("https://example.test/api", { method: "POST" }))).toBe(false);
  });

  it("returns not found when test auth is disabled", async () => {
    const response = await handleTestBootstrapRequest(
      new Request("https://example.test/test/bootstrap-user", {
        method: "POST",
        headers: {
          "x-test-auth-secret": "test-auth-secret",
        },
      }),
      makeTestEnv({
        APP_ENV: "dev",
      }),
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error?.message).toContain("Not found");
  });

  it("rejects invalid request JSON before touching the database", async () => {
    const response = await handleTestBootstrapRequest(
      new Request("https://example.test/test/bootstrap-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-auth-secret": "test-auth-secret",
        },
        body: "{not-json",
      }),
      makeTestEnv(),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error?.message).toContain("invalid JSON");
  });

  it("returns a server error when the session secret is missing", async () => {
    const response = await handleTestBootstrapRequest(
      new Request("https://example.test/test/bootstrap-user", {
        method: "POST",
        headers: {
          "x-test-auth-secret": "test-auth-secret",
        },
      }),
      makeTestEnv({
        APP_SESSION_SECRET: "",
      }),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error?.message).toContain("APP_SESSION_SECRET is not configured");
  });
});
